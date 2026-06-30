use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

use crate::config;
use crate::download::{rules_allow, ArgEntry, VersionJson};
use crate::settings::Settings;

pub struct LaunchContext {
    pub version_json: VersionJson,
    pub fabric_main_class: String,
    pub vanilla_library_paths: Vec<PathBuf>,
    pub fabric_library_paths: Vec<PathBuf>,
    pub client_jar: PathBuf,
}

fn classpath_separator() -> &'static str {
    if cfg!(target_os = "windows") {
        ";"
    } else {
        ":"
    }
}

fn build_classpath(ctx: &LaunchContext) -> String {
    let mut entries: Vec<String> = Vec::new();
    for p in &ctx.vanilla_library_paths {
        entries.push(p.to_string_lossy().to_string());
    }
    for p in &ctx.fabric_library_paths {
        entries.push(p.to_string_lossy().to_string());
    }
    entries.push(ctx.client_jar.to_string_lossy().to_string());
    entries.join(classpath_separator())
}

fn substitute(template: &str, vars: &HashMap<&str, String>) -> String {
    let mut result = template.to_string();
    for (key, value) in vars {
        result = result.replace(&format!("${{{key}}}"), value);
    }
    result
}

fn arg_strings_from_entry(entry: &ArgEntry, vars: &HashMap<&str, String>) -> Vec<String> {
    match entry {
        ArgEntry::Plain(s) => vec![substitute(s, vars)],
        ArgEntry::Conditional { rules, value } => {
            let parsed_rules: Option<Vec<crate::download::Rule>> =
                serde_json::from_value(serde_json::Value::Array(rules.clone())).ok();
            if !rules_allow(&parsed_rules) {
                return Vec::new();
            }
            match value {
                serde_json::Value::String(s) => vec![substitute(s, vars)],
                serde_json::Value::Array(arr) => arr
                    .iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| substitute(s, vars))
                    .collect(),
                _ => Vec::new(),
            }
        }
    }
}

fn legacy_game_args(minecraft_arguments: &str, vars: &HashMap<&str, String>) -> Vec<String> {
    minecraft_arguments
        .split_whitespace()
        .map(|s| substitute(s, vars))
        .collect()
}

pub fn build_game_args(
    ctx: &LaunchContext,
    instance_dir: &Path,
    username: &str,
    uuid: &str,
    access_token: &str,
) -> Vec<String> {
    let mut vars: HashMap<&str, String> = HashMap::new();
    vars.insert("auth_player_name", username.to_string());
    vars.insert("version_name", ctx.version_json.id.clone());
    vars.insert("game_directory", instance_dir.to_string_lossy().to_string());
    vars.insert(
        "assets_root",
        config::assets_dir(instance_dir).to_string_lossy().to_string(),
    );
    vars.insert(
        "game_assets",
        config::assets_dir(instance_dir).to_string_lossy().to_string(),
    );
    vars.insert("assets_index_name", ctx.version_json.asset_index.id.clone());
    vars.insert("auth_uuid", uuid.to_string());
    vars.insert("auth_access_token", access_token.to_string());
    vars.insert("user_type", "msa".to_string());
    vars.insert("version_type", "release".to_string());
    vars.insert("auth_xuid", uuid.to_string());
    vars.insert("clientid", "pulsar-client".to_string());

    if let Some(arguments) = &ctx.version_json.arguments {
        arguments
            .game
            .iter()
            .flat_map(|e| arg_strings_from_entry(e, &vars))
            .collect()
    } else if let Some(legacy) = &ctx.version_json.minecraft_arguments {
        legacy_game_args(legacy, &vars)
    } else {
        vec![
            "--username".into(), username.to_string(),
            "--version".into(), ctx.version_json.id.clone(),
            "--gameDir".into(), instance_dir.to_string_lossy().to_string(),
            "--assetsDir".into(), config::assets_dir(instance_dir).to_string_lossy().to_string(),
            "--assetIndex".into(), ctx.version_json.asset_index.id.clone(),
            "--uuid".into(), uuid.to_string(),
            "--accessToken".into(), access_token.to_string(),
            "--userType".into(), "msa".to_string(),
            "--versionType".into(), "release".to_string(),
        ]
    }
}

pub fn build_jvm_args(
    ctx: &LaunchContext,
    instance_dir: &Path,
    settings: &Settings,
) -> Vec<String> {
    let natives_path = config::natives_dir(instance_dir);
    let classpath = build_classpath(ctx);

    let mut vars: HashMap<&str, String> = HashMap::new();
    vars.insert("natives_directory", natives_path.to_string_lossy().to_string());
    vars.insert("launcher_name", "PulsarClient".to_string());
    vars.insert("launcher_version", "1.0.0".to_string());
    vars.insert("classpath", classpath.clone());

    let mut args = vec![format!("-Xmx{}G", settings.memory_gb)];

    if let Some(arguments) = &ctx.version_json.arguments {
        let jvm_args: Vec<String> = arguments
            .jvm
            .iter()
            .flat_map(|e| arg_strings_from_entry(e, &vars))
            .collect();
        args.extend(jvm_args);
    } else {
        args.push(format!("-Djava.library.path={}", natives_path.to_string_lossy()));
    }

    if !args.iter().any(|a| a == "-cp" || a.starts_with("-Djava.class.path")) {
        args.push("-cp".to_string());
        args.push(classpath);
    }

    args
}

pub async fn launch_minecraft(
    app_handle: AppHandle,
    ctx: LaunchContext,
    instance_dir: PathBuf,
    settings: Settings,
    username: String,
    uuid: String,
    access_token: String,
) -> Result<(), String> {
    let mut jvm_args = build_jvm_args(&ctx, &instance_dir, &settings);
    let main_class = ctx.fabric_main_class.clone();
    let game_args = build_game_args(&ctx, &instance_dir, &username, &uuid, &access_token);

    jvm_args.push(main_class);
    jvm_args.extend(game_args);

    std::fs::create_dir_all(&instance_dir).map_err(|e| e.to_string())?;

    let mut child = Command::new("java")
        .args(&jvm_args)
        .current_dir(&instance_dir)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to spawn java process: {e}. Is Java installed and on PATH?"))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    if let Some(stdout) = stdout {
        let handle = app_handle.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = handle.emit("game-log", line);
            }
        });
    }

    if let Some(stderr) = stderr {
        let handle = app_handle.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = handle.emit("game-log", line);
            }
        });
    }

    tokio::spawn(async move {
        let _ = child.wait().await;
    });

    Ok(())
}
