use std::path::Path;

use crate::config;
use crate::download::{
    download_assets, download_client_jar, download_libraries, fetch_version_json, VersionJson,
};
use crate::fabric::{download_fabric_libraries, fetch_fabric_profile, FabricProfileJson};
use crate::manifest::ModManifest;
use crate::mods::sync_locked_mods;
use crate::progress::Progress;

pub struct InstalledVersion {
    pub version_json: VersionJson,
    pub fabric_profile: FabricProfileJson,
    pub vanilla_library_paths: Vec<std::path::PathBuf>,
    pub fabric_library_paths: Vec<std::path::PathBuf>,
    pub client_jar: std::path::PathBuf,
}

pub fn is_vanilla_installed(instance_dir: &Path) -> bool {
    let client_jar = config::versions_dir(instance_dir)
        .join(config::PINNED_MINECRAFT_VERSION)
        .join(format!("{}.jar", config::PINNED_MINECRAFT_VERSION));
    client_jar.exists()
}

pub fn is_fabric_installed(instance_dir: &Path) -> bool {
    let marker = config::versions_dir(instance_dir).join(config::fabric_profile_id(
        config::PINNED_MINECRAFT_VERSION,
        config::PINNED_FABRIC_LOADER_VERSION,
    ));
    marker.exists()
}

pub fn are_locked_mods_installed(instance_dir: &Path, manifest: &ModManifest) -> bool {
    let mods_dir = config::mods_dir(instance_dir);
    manifest
        .mods
        .iter()
        .filter(|m| m.locked)
        .all(|m| mods_dir.join(format!("{}.jar", m.id)).exists())
}

pub async fn run_full_install(
    client: &reqwest::Client,
    instance_dir: &Path,
    manifest: &ModManifest,
    progress: &Progress,
) -> Result<InstalledVersion, String> {
    progress.emit_phase("manifest", 0, 1);
    let version_json = fetch_version_json(client, config::PINNED_MINECRAFT_VERSION).await?;
    progress.emit_phase("manifest", 1, 1);

    let versions_root = config::versions_dir(instance_dir);
    let libraries_root = config::libraries_dir(instance_dir);
    let natives_root = config::natives_dir(instance_dir);
    let assets_root = config::assets_dir(instance_dir);

    let client_jar = download_client_jar(client, &version_json, &versions_root, progress).await?;

    let vanilla_library_paths = download_libraries(
        client,
        &version_json.libraries,
        &libraries_root,
        &natives_root,
        progress,
    )
    .await?;

    download_assets(client, &version_json, &assets_root, progress).await?;

    progress.emit_phase("fabric-profile", 0, 1);
    let fabric_profile = fetch_fabric_profile(
        client,
        config::PINNED_MINECRAFT_VERSION,
        config::PINNED_FABRIC_LOADER_VERSION,
    )
    .await?;
    progress.emit_phase("fabric-profile", 1, 1);

    let fabric_library_paths =
        download_fabric_libraries(client, &fabric_profile, &libraries_root, progress).await?;

    let fabric_marker = versions_root.join(config::fabric_profile_id(
        config::PINNED_MINECRAFT_VERSION,
        config::PINNED_FABRIC_LOADER_VERSION,
    ));
    std::fs::write(&fabric_marker, "installed").map_err(|e| e.to_string())?;

    progress.emit_phase("mods", 0, 1);
    sync_locked_mods(client, instance_dir, manifest).await?;
    progress.emit_phase("mods", 1, 1);

    progress.emit_phase("done", 1, 1);

    Ok(InstalledVersion {
        version_json,
        fabric_profile,
        vanilla_library_paths,
        fabric_library_paths,
        client_jar,
    })
}

pub async fn ensure_installed(
    client: &reqwest::Client,
    instance_dir: &Path,
    manifest: &ModManifest,
    progress: &Progress,
) -> Result<InstalledVersion, String> {
    if is_vanilla_installed(instance_dir)
        && is_fabric_installed(instance_dir)
        && are_locked_mods_installed(instance_dir, manifest)
    {
        let version_json = fetch_version_json(client, config::PINNED_MINECRAFT_VERSION).await?;
        let fabric_profile = fetch_fabric_profile(
            client,
            config::PINNED_MINECRAFT_VERSION,
            config::PINNED_FABRIC_LOADER_VERSION,
        )
        .await?;

        let libraries_root = config::libraries_dir(instance_dir);
        let vanilla_library_paths = version_json
            .libraries
            .iter()
            .filter(|lib| crate::download::rules_allow(&lib.rules))
            .filter_map(|lib| lib.downloads.as_ref().and_then(|d| d.artifact.as_ref()).map(|a| (lib, a)))
            .map(|(lib, artifact)| {
                artifact
                    .path
                    .clone()
                    .map(std::path::PathBuf::from)
                    .or_else(|| crate::download::library_path(&lib.name))
                    .map(|p| libraries_root.join(p))
            })
            .collect::<Option<Vec<_>>>()
            .unwrap_or_default();

        let fabric_library_paths = fabric_profile
            .libraries
            .client
            .iter()
            .chain(fabric_profile.libraries.common.iter())
            .filter_map(|lib| crate::download::library_path(&lib.name))
            .map(|p| libraries_root.join(p))
            .collect();

        let client_jar = config::versions_dir(instance_dir)
            .join(&version_json.id)
            .join(format!("{}.jar", version_json.id));

        return Ok(InstalledVersion {
            version_json,
            fabric_profile,
            vanilla_library_paths,
            fabric_library_paths,
            client_jar,
        });
    }

    run_full_install(client, instance_dir, manifest, progress).await
}
