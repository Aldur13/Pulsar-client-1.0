import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface InstallStatus {
  vanillaInstalled: boolean;
  fabricInstalled: boolean;
  modsInstalled: boolean;
  pinnedVersion: string;
}

export interface ModEntry {
  id: string;
  name: string;
  version: string;
  locked: boolean;
  enabled: boolean;
}

export interface InstallProgressEvent {
  phase: string;
  current: number;
  total: number;
}

export interface LauncherSettings {
  memory_gb: number;
  game_dir: string;
}

export function getInstallStatus(): Promise<InstallStatus> {
  return invoke<InstallStatus>("get_install_status");
}

export function installOrUpdate(): Promise<void> {
  return invoke<void>("install_or_update");
}

export function onInstallProgress(
  callback: (event: InstallProgressEvent) => void,
): Promise<UnlistenFn> {
  return listen<InstallProgressEvent>("install-progress", (e) => callback(e.payload));
}

export function launchGame(
  username: string,
  uuid: string,
  accessToken: string,
): Promise<void> {
  return invoke<void>("launch_game", {
    username,
    uuid,
    access_token: accessToken,
  });
}

export function listMods(): Promise<ModEntry[]> {
  return invoke<ModEntry[]>("list_mods");
}

export function uploadMod(filePath: string): Promise<ModEntry> {
  return invoke<ModEntry>("upload_mod", { file_path: filePath });
}

export function toggleMod(id: string, enabled: boolean): Promise<void> {
  return invoke<void>("toggle_mod", { id, enabled });
}

export function removeMod(id: string): Promise<void> {
  return invoke<void>("remove_mod", { id });
}

export function getSettings(): Promise<LauncherSettings> {
  return invoke<LauncherSettings>("get_settings");
}

export function setSettings(settings: LauncherSettings): Promise<void> {
  return invoke<void>("set_settings", { settings });
}

export function refreshManifest(): Promise<void> {
  return invoke<void>("refresh_manifest");
}
