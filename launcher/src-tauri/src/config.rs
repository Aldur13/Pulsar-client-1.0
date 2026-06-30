use std::path::PathBuf;

pub const PINNED_MINECRAFT_VERSION: &str = "1.21.4";
pub const PINNED_FABRIC_LOADER_VERSION: &str = "0.16.10";
pub const PINNED_FABRIC_INSTALLER_VERSION: &str = "1.0.1";

pub const BACKEND_MANIFEST_URL: &str = "http://localhost:8787/api/mods/manifest";
pub const MOJANG_VERSION_MANIFEST_URL: &str =
    "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json";
pub const FABRIC_META_BASE_URL: &str = "https://meta.fabricmc.net/v2";

pub const DEFAULT_MANIFEST_JSON: &str = include_str!("../data/default-manifest.json");

pub fn app_data_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(std::env::temp_dir)
        .join("PulsarClient")
}

pub fn default_instance_dir() -> PathBuf {
    app_data_dir().join("instance")
}

pub fn versions_dir(instance_dir: &std::path::Path) -> PathBuf {
    instance_dir.join("versions")
}

pub fn libraries_dir(instance_dir: &std::path::Path) -> PathBuf {
    instance_dir.join("libraries")
}

pub fn natives_dir(instance_dir: &std::path::Path) -> PathBuf {
    instance_dir
        .join("natives")
        .join(PINNED_MINECRAFT_VERSION)
}

pub fn assets_dir(instance_dir: &std::path::Path) -> PathBuf {
    instance_dir.join("assets")
}

pub fn mods_dir(instance_dir: &std::path::Path) -> PathBuf {
    instance_dir.join("mods")
}

pub fn mods_disabled_dir(instance_dir: &std::path::Path) -> PathBuf {
    instance_dir.join("mods-disabled")
}

pub fn mods_state_path(instance_dir: &std::path::Path) -> PathBuf {
    instance_dir.join("mods-state.json")
}

pub fn settings_path() -> PathBuf {
    app_data_dir().join("settings.json")
}

pub fn manifest_cache_path() -> PathBuf {
    app_data_dir().join("manifest-cache.json")
}

pub fn fabric_profile_id(mc_version: &str, loader_version: &str) -> String {
    format!("fabric-loader-{loader_version}-{mc_version}")
}
