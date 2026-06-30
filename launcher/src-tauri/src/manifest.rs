use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::Duration;

use crate::config;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestMod {
    pub id: String,
    pub name: String,
    pub version: String,
    pub url: String,
    #[serde(default)]
    pub sha1: String,
    #[serde(default)]
    pub locked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModManifest {
    #[serde(rename = "minecraftVersion")]
    pub minecraft_version: String,
    #[serde(rename = "fabricLoaderVersion")]
    pub fabric_loader_version: String,
    #[serde(rename = "fabricInstallerVersion")]
    pub fabric_installer_version: String,
    pub mods: Vec<ManifestMod>,
}

impl ModManifest {
    pub fn embedded_default() -> Self {
        serde_json::from_str(config::DEFAULT_MANIFEST_JSON)
            .expect("embedded default-manifest.json must be valid JSON")
    }
}

pub async fn fetch_remote_manifest(client: &reqwest::Client) -> Result<ModManifest, String> {
    let resp = client
        .get(config::BACKEND_MANIFEST_URL)
        .timeout(Duration::from_secs(5))
        .send()
        .await
        .map_err(|e| format!("failed to reach backend manifest endpoint: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!(
            "backend manifest endpoint returned status {}",
            resp.status()
        ));
    }

    resp.json::<ModManifest>()
        .await
        .map_err(|e| format!("failed to parse backend manifest JSON: {e}"))
}

pub fn load_cached_manifest(cache_path: &Path) -> Option<ModManifest> {
    let data = std::fs::read_to_string(cache_path).ok()?;
    serde_json::from_str(&data).ok()
}

pub fn save_cached_manifest(cache_path: &Path, manifest: &ModManifest) -> std::io::Result<()> {
    if let Some(parent) = cache_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let data = serde_json::to_string_pretty(manifest)?;
    std::fs::write(cache_path, data)
}

pub async fn resolve_manifest(client: &reqwest::Client) -> ModManifest {
    match fetch_remote_manifest(client).await {
        Ok(manifest) => {
            let _ = save_cached_manifest(&config::manifest_cache_path(), &manifest);
            manifest
        }
        Err(_) => load_cached_manifest(&config::manifest_cache_path())
            .unwrap_or_else(ModManifest::embedded_default),
    }
}
