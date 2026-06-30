use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize)]
pub struct InstallProgressEvent {
    pub phase: String,
    pub current: u64,
    pub total: u64,
}

#[derive(Clone)]
pub struct Progress {
    app_handle: AppHandle,
}

impl Progress {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }

    pub fn emit_phase(&self, phase: &str, current: u64, total: u64) {
        let _ = self.app_handle.emit(
            "install-progress",
            InstallProgressEvent {
                phase: phase.to_string(),
                current,
                total,
            },
        );
    }
}
