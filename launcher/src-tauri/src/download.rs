use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

use crate::config;
use crate::progress::Progress;
use crate::util::download_verified;

#[derive(Debug, Deserialize)]
pub struct VersionManifestV2 {
    pub versions: Vec<VersionManifestEntry>,
}

#[derive(Debug, Deserialize)]
pub struct VersionManifestEntry {
    pub id: String,
    pub url: String,
}

#[derive(Debug, Deserialize)]
pub struct OsRule {
    pub name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct Rule {
    pub action: String,
    pub os: Option<OsRule>,
}

pub fn current_os_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "osx"
    } else {
        "linux"
    }
}

pub fn rules_allow(rules: &Option<Vec<Rule>>) -> bool {
    let Some(rules) = rules else {
        return true;
    };
    if rules.is_empty() {
        return true;
    }
    let mut allowed = false;
    for rule in rules {
        let os_matches = match &rule.os {
            Some(os) => os
                .name
                .as_deref()
                .map(|n| n == current_os_name())
                .unwrap_or(true),
            None => true,
        };
        if !os_matches {
            continue;
        }
        allowed = rule.action == "allow";
    }
    allowed
}

#[derive(Debug, Deserialize)]
pub struct DownloadArtifact {
    pub url: String,
    pub sha1: Option<String>,
    pub size: Option<u64>,
    pub path: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LibraryDownloads {
    pub artifact: Option<DownloadArtifact>,
    #[serde(default)]
    pub classifiers: HashMap<String, DownloadArtifact>,
}

#[derive(Debug, Deserialize)]
pub struct NativesMap {
    #[serde(flatten)]
    pub map: HashMap<String, String>,
}

#[derive(Debug, Deserialize)]
pub struct Library {
    pub name: String,
    pub downloads: Option<LibraryDownloads>,
    pub rules: Option<Vec<Rule>>,
    pub natives: Option<HashMap<String, String>>,
    pub url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AssetIndexRef {
    pub id: String,
    pub url: String,
    pub sha1: Option<String>,
    pub size: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub struct VersionDownloads {
    pub client: DownloadArtifact,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(untagged)]
pub enum ArgEntry {
    Plain(String),
    Conditional {
        rules: Vec<serde_json::Value>,
        value: serde_json::Value,
    },
}

#[derive(Debug, Deserialize, Serialize, Clone, Default)]
pub struct VersionArguments {
    #[serde(default)]
    pub game: Vec<ArgEntry>,
    #[serde(default)]
    pub jvm: Vec<ArgEntry>,
}

#[derive(Debug, Deserialize)]
pub struct VersionJson {
    pub id: String,
    #[serde(rename = "mainClass")]
    pub main_class: String,
    pub downloads: VersionDownloads,
    pub libraries: Vec<Library>,
    #[serde(rename = "assetIndex")]
    pub asset_index: AssetIndexRef,
    pub assets: String,
    pub arguments: Option<VersionArguments>,
    #[serde(rename = "minecraftArguments")]
    pub minecraft_arguments: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AssetObject {
    pub hash: String,
    pub size: u64,
}

#[derive(Debug, Deserialize)]
pub struct AssetIndexJson {
    pub objects: HashMap<String, AssetObject>,
}

pub async fn fetch_version_json(
    client: &reqwest::Client,
    mc_version: &str,
) -> Result<VersionJson, String> {
    let manifest: VersionManifestV2 = client
        .get(config::MOJANG_VERSION_MANIFEST_URL)
        .send()
        .await
        .map_err(|e| format!("failed to fetch Mojang version manifest: {e}"))?
        .json()
        .await
        .map_err(|e| format!("failed to parse Mojang version manifest: {e}"))?;

    let entry = manifest
        .versions
        .iter()
        .find(|v| v.id == mc_version)
        .ok_or_else(|| format!("pinned Minecraft version {mc_version} not found in Mojang version manifest"))?;

    client
        .get(&entry.url)
        .send()
        .await
        .map_err(|e| format!("failed to fetch version json: {e}"))?
        .json::<VersionJson>()
        .await
        .map_err(|e| format!("failed to parse version json: {e}"))
}

pub fn library_path(name: &str) -> Option<PathBuf> {
    let segments: Vec<&str> = name.split(':').collect();
    if segments.len() < 3 {
        return None;
    }
    let group = segments[0];
    let artifact = segments[1];
    let (version, ext) = match segments[2].split_once('@') {
        Some((v, ext)) => (v, ext),
        None => (segments[2], "jar"),
    };
    let classifier_suffix = if segments.len() > 3 {
        format!("-{}", segments[3])
    } else {
        String::new()
    };
    let group_path = group.replace('.', "/");
    let file_name = format!("{artifact}-{version}{classifier_suffix}.{ext}");
    Some(PathBuf::from(group_path).join(artifact).join(version).join(file_name))
}

pub async fn download_libraries(
    client: &reqwest::Client,
    libraries: &[Library],
    libraries_root: &Path,
    natives_root: &Path,
    progress: &Progress,
) -> Result<Vec<PathBuf>, String> {
    let mut classpath_paths = Vec::new();
    let applicable: Vec<&Library> = libraries
        .iter()
        .filter(|lib| rules_allow(&lib.rules))
        .collect();

    let total = applicable.len() as u64;
    progress.emit_phase("libraries", 0, total);

    for (idx, lib) in applicable.into_iter().enumerate() {
        if let Some(downloads) = &lib.downloads {
            if let Some(artifact) = &downloads.artifact {
                let rel_path = artifact
                    .path
                    .clone()
                    .map(PathBuf::from)
                    .or_else(|| library_path(&lib.name))
                    .ok_or_else(|| format!("cannot resolve path for library {}", lib.name))?;
                let dest = libraries_root.join(&rel_path);
                download_verified(
                    client,
                    &artifact.url,
                    &dest,
                    artifact.size,
                    artifact.sha1.as_deref(),
                    |_| {},
                )
                .await?;
                classpath_paths.push(dest);
            }

            if let Some(native_key) = lib.natives.as_ref().and_then(|m| m.get(current_os_name())) {
                let native_key = native_key.replace("${arch}", if cfg!(target_pointer_width = "64") { "64" } else { "32" });
                if let Some(classifier_artifact) = downloads.classifiers.get(&native_key) {
                    let tmp_jar = libraries_root
                        .join("__natives_tmp__")
                        .join(format!("{}.jar", lib.name.replace([':', '.'], "_")));
                    download_verified(
                        client,
                        &classifier_artifact.url,
                        &tmp_jar,
                        classifier_artifact.size,
                        classifier_artifact.sha1.as_deref(),
                        |_| {},
                    )
                    .await?;
                    extract_natives_jar(&tmp_jar, natives_root)?;
                }
            }
        }

        progress.emit_phase("libraries", (idx + 1) as u64, total);
    }

    Ok(classpath_paths)
}

fn extract_natives_jar(jar_path: &Path, natives_root: &Path) -> Result<(), String> {
    std::fs::create_dir_all(natives_root).map_err(|e| e.to_string())?;
    let file = std::fs::File::open(jar_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = entry.name().to_string();
        if name.starts_with("META-INF/") || name.ends_with('/') {
            continue;
        }
        if !(name.ends_with(".so") || name.ends_with(".dll") || name.ends_with(".dylib")) {
            continue;
        }
        let out_name = Path::new(&name)
            .file_name()
            .ok_or("invalid native entry name")?;
        let out_path = natives_root.join(out_name);
        let mut out_file = std::fs::File::create(&out_path).map_err(|e| e.to_string())?;
        std::io::copy(&mut entry, &mut out_file).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub async fn download_client_jar(
    client: &reqwest::Client,
    version_json: &VersionJson,
    versions_root: &Path,
    progress: &Progress,
) -> Result<PathBuf, String> {
    progress.emit_phase("client-jar", 0, 1);
    let dest = versions_root
        .join(&version_json.id)
        .join(format!("{}.jar", version_json.id));
    download_verified(
        client,
        &version_json.downloads.client.url,
        &dest,
        version_json.downloads.client.size,
        version_json.downloads.client.sha1.as_deref(),
        |_| {},
    )
    .await?;
    progress.emit_phase("client-jar", 1, 1);
    Ok(dest)
}

pub async fn download_assets(
    client: &reqwest::Client,
    version_json: &VersionJson,
    assets_root: &Path,
    progress: &Progress,
) -> Result<(), String> {
    progress.emit_phase("asset-index", 0, 1);
    let index_dest = assets_root
        .join("indexes")
        .join(format!("{}.json", version_json.asset_index.id));
    download_verified(
        client,
        &version_json.asset_index.url,
        &index_dest,
        version_json.asset_index.size,
        version_json.asset_index.sha1.as_deref(),
        |_| {},
    )
    .await?;
    progress.emit_phase("asset-index", 1, 1);

    let index_data = std::fs::read_to_string(&index_dest).map_err(|e| e.to_string())?;
    let index: AssetIndexJson = serde_json::from_str(&index_data).map_err(|e| e.to_string())?;

    let objects_root = assets_root.join("objects");
    let total = index.objects.len() as u64;
    progress.emit_phase("assets", 0, total);

    let mut done: u64 = 0;
    for (_name, object) in index.objects.iter() {
        let prefix = &object.hash[0..2];
        let dest = objects_root.join(prefix).join(&object.hash);
        let url = format!(
            "https://resources.download.minecraft.net/{prefix}/{}",
            object.hash
        );
        download_verified(client, &url, &dest, Some(object.size), Some(&object.hash), |_| {}).await?;
        done += 1;
        if done % 10 == 0 || done == total {
            progress.emit_phase("assets", done, total);
        }
    }
    progress.emit_phase("assets", total, total);

    Ok(())
}
