use serde::{Deserialize, Serialize};

use crate::config;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub memory_gb: u32,
    pub game_dir: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            memory_gb: 4,
            game_dir: config::default_instance_dir().to_string_lossy().to_string(),
        }
    }
}

impl Settings {
    pub fn load() -> Self {
        std::fs::read_to_string(config::settings_path())
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }

    pub fn save(&self) -> Result<(), String> {
        let path = config::settings_path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let data = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        std::fs::write(path, data).map_err(|e| e.to_string())
    }

    pub fn instance_dir(&self) -> std::path::PathBuf {
        std::path::PathBuf::from(&self.game_dir)
    }
}
