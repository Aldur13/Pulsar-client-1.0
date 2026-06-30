use serde::Serialize;
use tauri::{AppHandle, Manager, State};

use crate::config;
use crate::install;
use crate::launcher::{launch_minecraft, LaunchContext};
use crate::manifest::{resolve_manifest, ModManifest};
use crate::mods::{self, ModEntry};
use crate::progress::Progress;
use crate::settings::Settings;
use crate::state::AppState;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallStatusDto {
    pub pinned_version: String,
    pub fabric_loader_version: String,
    pub vanilla_installed: bool,
    pub fabric_installed: bool,
    pub mods_installed: bool,
    pub fully_installed: bool,
}

pub type ModEntryDto = ModEntry;
pub type SettingsDto = Settings;

#[tauri::command]
pub async fn get_install_status(state: State<'_, AppState>) -> Result<InstallStatusDto, String> {
    let settings = state.settings.lock().await.clone();
    let manifest = state.manifest.lock().await.clone();
    let instance_dir = settings.instance_dir();

    let vanilla_installed = install::is_vanilla_installed(&instance_dir);
    let fabric_installed = install::is_fabric_installed(&instance_dir);
    let mods_installed = install::are_locked_mods_installed(&instance_dir, &manifest);

    Ok(InstallStatusDto {
        pinned_version: config::PINNED_MINECRAFT_VERSION.to_string(),
        fabric_loader_version: config::PINNED_FABRIC_LOADER_VERSION.to_string(),
        vanilla_installed,
        fabric_installed,
        mods_installed,
        fully_installed: vanilla_installed && fabric_installed && mods_installed,
    })
}

#[tauri::command]
pub async fn install_or_update(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let settings = state.settings.lock().await.clone();
    let manifest = state.manifest.lock().await.clone();
    let instance_dir = settings.instance_dir();
    let progress = Progress::new(app.clone());

    install::run_full_install(&state.http_client, &instance_dir, &manifest, &progress).await?;
    Ok(())
}

#[tauri::command]
pub async fn launch_game(
    app: AppHandle,
    state: State<'_, AppState>,
    username: String,
    uuid: String,
    access_token: String,
) -> Result<(), String> {
    let settings = state.settings.lock().await.clone();
    let manifest = state.manifest.lock().await.clone();
    let instance_dir = settings.instance_dir();
    let progress = Progress::new(app.clone());

    let installed =
        install::ensure_installed(&state.http_client, &instance_dir, &manifest, &progress).await?;

    let ctx = LaunchContext {
        fabric_main_class: installed.fabric_profile.main_class.clone(),
        version_json: installed.version_json,
        vanilla_library_paths: installed.vanilla_library_paths,
        fabric_library_paths: installed.fabric_library_paths,
        client_jar: installed.client_jar,
    };

    launch_minecraft(app, ctx, instance_dir, settings, username, uuid, access_token).await
}

#[tauri::command]
pub async fn list_mods(state: State<'_, AppState>) -> Result<Vec<ModEntryDto>, String> {
    let settings = state.settings.lock().await.clone();
    Ok(mods::list_mods(&settings.instance_dir()))
}

#[tauri::command]
pub async fn upload_mod(
    state: State<'_, AppState>,
    file_path: String,
) -> Result<ModEntryDto, String> {
    let settings = state.settings.lock().await.clone();
    mods::upload_mod(&settings.instance_dir(), &file_path)
}

#[tauri::command]
pub async fn toggle_mod(
    state: State<'_, AppState>,
    id: String,
    enabled: bool,
) -> Result<(), String> {
    let settings = state.settings.lock().await.clone();
    mods::toggle_mod(&settings.instance_dir(), &id, enabled)
}

#[tauri::command]
pub async fn remove_mod(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let settings = state.settings.lock().await.clone();
    mods::remove_mod(&settings.instance_dir(), &id)
}

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<SettingsDto, String> {
    Ok(state.settings.lock().await.clone())
}

#[tauri::command]
pub async fn set_settings(
    state: State<'_, AppState>,
    settings: SettingsDto,
) -> Result<(), String> {
    settings.save()?;
    *state.settings.lock().await = settings;
    Ok(())
}

#[tauri::command]
pub async fn refresh_manifest(state: State<'_, AppState>) -> Result<(), String> {
    let manifest: ModManifest = resolve_manifest(&state.http_client).await;
    *state.manifest.lock().await = manifest;
    Ok(())
}

pub fn app_setup(app: &AppHandle) {
    let state = app.state::<AppState>();
    let handle = app.clone();
    let manifest_mutex_client = state.http_client.clone();
    tauri::async_runtime::spawn(async move {
        let manifest = resolve_manifest(&manifest_mutex_client).await;
        let state = handle.state::<AppState>();
        *state.manifest.lock().await = manifest;
    });
}
