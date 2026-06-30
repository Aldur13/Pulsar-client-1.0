mod commands;
mod config;
mod download;
mod fabric;
mod install;
mod launcher;
mod manifest;
mod mods;
mod progress;
mod settings;
mod state;
mod util;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .setup(|app| {
            commands::app_setup(&app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_install_status,
            commands::install_or_update,
            commands::launch_game,
            commands::list_mods,
            commands::upload_mod,
            commands::toggle_mod,
            commands::remove_mod,
            commands::get_settings,
            commands::set_settings,
            commands::refresh_manifest,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
