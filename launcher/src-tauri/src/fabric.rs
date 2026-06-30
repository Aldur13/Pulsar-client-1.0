use serde::Deserialize;
use std::path::{Path, PathBuf};

use crate::config;
use crate::download::library_path;
use crate::progress::Progress;
use crate::util::download_verified;

#[derive(Debug, Deserialize)]
pub struct FabricLibrary {
    pub name: String,
    pub url: String,
}

#[derive(Debug, Deserialize)]
pub struct FabricLibraries {
    pub client: Vec<FabricLibrary>,
    pub common: Vec<FabricLibrary>,
}

#[derive(Debug, Deserialize)]
pub struct FabricProfileJson {
    #[allow(dead_code)]
    pub id: String,
    #[serde(rename = "mainClass")]
    pub main_class: String,
    pub libraries: FabricLibraries,
}

pub async fn fetch_fabric_profile(
    client: &reqwest::Client,
    mc_version: &str,
    loader_version: &str,
) -> Result<FabricProfileJson, String> {
    let url = format!(
        "{}/versions/loader/{mc_version}/{loader_version}/profile/json",
        config::FABRIC_META_BASE_URL
    );
    client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("failed to fetch Fabric profile: {e}"))?
        .json::<FabricProfileJson>()
        .await
        .map_err(|e| format!("failed to parse Fabric profile json: {e}"))
}

pub async fn download_fabric_libraries(
    client: &reqwest::Client,
    profile: &FabricProfileJson,
    libraries_root: &Path,
    progress: &Progress,
) -> Result<Vec<PathBuf>, String> {
    let mut classpath_paths = Vec::new();
    let all_libs: Vec<&FabricLibrary> = profile
        .libraries
        .client
        .iter()
        .chain(profile.libraries.common.iter())
        .collect();

    let total = all_libs.len() as u64;
    progress.emit_phase("fabric-libraries", 0, total);

    for (idx, lib) in all_libs.into_iter().enumerate() {
        let rel_path = library_path(&lib.name)
            .ok_or_else(|| format!("cannot resolve path for fabric library {}", lib.name))?;
        let dest = libraries_root.join(&rel_path);
        let rel_path_str = rel_path.to_string_lossy().replace('\\', "/");
        let url = format!("{}/{rel_path_str}", lib.url.trim_end_matches('/'));
        download_verified(client, &url, &dest, None, None, |_| {}).await?;
        classpath_paths.push(dest);
        progress.emit_phase("fabric-libraries", (idx + 1) as u64, total);
    }

    Ok(classpath_paths)
}
