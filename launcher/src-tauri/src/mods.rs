use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::config;
use crate::manifest::ModManifest;
use crate::util::download_verified;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModEntry {
    pub id: String,
    pub name: String,
    pub version: String,
    pub source_url: String,
    pub locked: bool,
    pub enabled: bool,
    pub filename: String,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct ModsState {
    pub mods: Vec<ModEntry>,
}

impl ModsState {
    pub fn load(instance_dir: &Path) -> Self {
        let path = config::mods_state_path(instance_dir);
        std::fs::read_to_string(path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }

    pub fn save(&self, instance_dir: &Path) -> Result<(), String> {
        let path = config::mods_state_path(instance_dir);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let data = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        std::fs::write(path, data).map_err(|e| e.to_string())
    }

    pub fn find(&self, id: &str) -> Option<&ModEntry> {
        self.mods.iter().find(|m| m.id == id)
    }

    pub fn find_mut(&mut self, id: &str) -> Option<&mut ModEntry> {
        self.mods.iter_mut().find(|m| m.id == id)
    }
}

pub async fn sync_locked_mods(
    client: &reqwest::Client,
    instance_dir: &Path,
    manifest: &ModManifest,
) -> Result<(), String> {
    std::fs::create_dir_all(config::mods_dir(instance_dir)).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(config::mods_disabled_dir(instance_dir)).map_err(|e| e.to_string())?;

    let mut state = ModsState::load(instance_dir);

    for manifest_mod in &manifest.mods {
        if !manifest_mod.locked {
            continue;
        }
        let filename = format!("{}.jar", manifest_mod.id);
        let dest = config::mods_dir(instance_dir).join(&filename);

        download_verified(
            client,
            &manifest_mod.url,
            &dest,
            None,
            Some(&manifest_mod.sha1).filter(|s| !s.is_empty()),
            |_| {},
        )
        .await?;

        match state.find_mut(&manifest_mod.id) {
            Some(existing) => {
                existing.name = manifest_mod.name.clone();
                existing.version = manifest_mod.version.clone();
                existing.source_url = manifest_mod.url.clone();
                existing.locked = true;
                existing.filename = filename;
            }
            None => {
                state.mods.push(ModEntry {
                    id: manifest_mod.id.clone(),
                    name: manifest_mod.name.clone(),
                    version: manifest_mod.version.clone(),
                    source_url: manifest_mod.url.clone(),
                    locked: true,
                    enabled: true,
                    filename,
                });
            }
        }
    }

    state.save(instance_dir)?;
    Ok(())
}

pub fn list_mods(instance_dir: &Path) -> Vec<ModEntry> {
    ModsState::load(instance_dir).mods
}

pub fn upload_mod(instance_dir: &Path, file_path: &str) -> Result<ModEntry, String> {
    let source = Path::new(file_path);

    let ext_ok = source
        .extension()
        .map(|e| e.eq_ignore_ascii_case("jar"))
        .unwrap_or(false);
    if !ext_ok {
        return Err("only .jar files can be uploaded as mods".to_string());
    }

    let file_name = source
        .file_name()
        .ok_or("invalid file path")?
        .to_string_lossy()
        .to_string();

    let id = file_name
        .strip_suffix(".jar")
        .unwrap_or(&file_name)
        .to_string();

    std::fs::create_dir_all(config::mods_dir(instance_dir)).map_err(|e| e.to_string())?;

    let dest = config::mods_dir(instance_dir).join(&file_name);
    std::fs::copy(source, &dest).map_err(|e| format!("failed to copy mod jar: {e}"))?;

    let mut state = ModsState::load(instance_dir);

    if let Some(existing) = state.find(&id) {
        if existing.locked {
            return Err(format!("a locked mod with id '{id}' already exists"));
        }
    }

    let entry = ModEntry {
        id: id.clone(),
        name: id.clone(),
        version: "user-uploaded".to_string(),
        source_url: String::new(),
        locked: false,
        enabled: true,
        filename: file_name,
    };

    state.mods.retain(|m| m.id != id);
    state.mods.push(entry.clone());
    state.save(instance_dir)?;

    Ok(entry)
}

pub fn toggle_mod(instance_dir: &Path, id: &str, enabled: bool) -> Result<(), String> {
    let mut state = ModsState::load(instance_dir);
    let entry = state
        .find_mut(id)
        .ok_or_else(|| format!("mod '{id}' not found"))?;

    if entry.locked {
        return Err(format!("'{}' is a locked mod and cannot be toggled", entry.name));
    }

    if entry.enabled == enabled {
        return Ok(());
    }

    let enabled_path = config::mods_dir(instance_dir).join(&entry.filename);
    let disabled_path = config::mods_disabled_dir(instance_dir).join(&entry.filename);

    std::fs::create_dir_all(config::mods_disabled_dir(instance_dir)).map_err(|e| e.to_string())?;

    if enabled {
        if disabled_path.exists() {
            std::fs::rename(&disabled_path, &enabled_path).map_err(|e| e.to_string())?;
        }
    } else if enabled_path.exists() {
        std::fs::rename(&enabled_path, &disabled_path).map_err(|e| e.to_string())?;
    }

    entry.enabled = enabled;
    state.save(instance_dir)?;
    Ok(())
}

pub fn remove_mod(instance_dir: &Path, id: &str) -> Result<(), String> {
    let mut state = ModsState::load(instance_dir);
    let entry = state
        .find(id)
        .ok_or_else(|| format!("mod '{id}' not found"))?
        .clone();

    if entry.locked {
        return Err(format!("'{}' is a locked mod and cannot be removed", entry.name));
    }

    let enabled_path = config::mods_dir(instance_dir).join(&entry.filename);
    let disabled_path = config::mods_disabled_dir(instance_dir).join(&entry.filename);
    let _ = std::fs::remove_file(enabled_path);
    let _ = std::fs::remove_file(disabled_path);

    state.mods.retain(|m| m.id != id);
    state.save(instance_dir)?;
    Ok(())
}

pub fn enabled_mod_jar_paths(instance_dir: &Path) -> Vec<std::path::PathBuf> {
    ModsState::load(instance_dir)
        .mods
        .iter()
        .filter(|m| m.enabled)
        .map(|m| config::mods_dir(instance_dir).join(&m.filename))
        .collect()
}
