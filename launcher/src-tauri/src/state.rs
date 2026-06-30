use tokio::sync::Mutex;

use crate::manifest::ModManifest;
use crate::settings::Settings;

pub struct AppState {
    pub http_client: reqwest::Client,
    pub manifest: Mutex<ModManifest>,
    pub settings: Mutex<Settings>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            http_client: reqwest::Client::new(),
            manifest: Mutex::new(ModManifest::embedded_default()),
            settings: Mutex::new(Settings::load()),
        }
    }
}
