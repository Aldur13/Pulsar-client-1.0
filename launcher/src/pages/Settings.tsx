import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getSettings, setSettings, type LauncherSettings } from "../lib/tauri";

export default function Settings() {
  const [settings, setLocalSettings] = useState<LauncherSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSettings()
      .then(setLocalSettings)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const persist = async (next: LauncherSettings) => {
    setSaving(true);
    setError(null);
    try {
      await setSettings(next);
      setLocalSettings(next);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleMemoryChange = (value: number) => {
    if (!settings) return;
    setLocalSettings({ ...settings, memory_gb: value });
  };

  const handleMemoryCommit = (value: number) => {
    if (!settings) return;
    persist({ ...settings, memory_gb: value });
  };

  const handleChangeDir = async () => {
    if (!settings) return;
    const dir = await open({ directory: true });
    if (!dir || Array.isArray(dir)) return;
    persist({ ...settings, game_dir: dir });
  };

  if (loading) {
    return <p className="text-zinc-500">Loading settings...</p>;
  }

  if (!settings) {
    return <p className="text-sm text-red-400">{error ?? "Failed to load settings."}</p>;
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-bold text-zinc-100">Settings</h1>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      <div className="flex flex-col gap-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">
            Memory allocation: {settings.memory_gb} GB
          </label>
          <input
            type="range"
            min={1}
            max={32}
            step={1}
            value={settings.memory_gb}
            onChange={(e) => handleMemoryChange(Number(e.target.value))}
            onMouseUp={(e) => handleMemoryCommit(Number((e.target as HTMLInputElement).value))}
            onTouchEnd={(e) => handleMemoryCommit(Number((e.target as HTMLInputElement).value))}
            className="w-full accent-violet-600"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">
            Game directory
          </label>
          <div className="flex gap-2">
            <input
              readOnly
              value={settings.game_dir}
              className="flex-1 truncate rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300"
            />
            <button
              onClick={handleChangeDir}
              disabled={saving}
              className="rounded-md border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-60"
            >
              Change
            </button>
          </div>
        </div>

        <div className="rounded-md border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-500">
          Minecraft version is locked by Pulsar to ensure mod compatibility. There is no
          version selector here on purpose.
        </div>
      </div>
    </div>
  );
}
