import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  listMods,
  removeMod,
  toggleMod,
  uploadMod,
  type ModEntry,
} from "../lib/tauri";

export default function Mods() {
  const [mods, setMods] = useState<ModEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const result = await listMods();
      setMods(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const handleToggle = async (mod: ModEntry) => {
    try {
      await toggleMod(mod.id, !mod.enabled);
      await reload();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleRemove = async (mod: ModEntry) => {
    if (mod.locked) return;
    try {
      await removeMod(mod.id);
      await reload();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleUpload = async () => {
    setError(null);
    const filePath = await open({
      filters: [{ name: "Mod", extensions: ["jar"] }],
    });
    if (!filePath || Array.isArray(filePath)) return;
    setUploading(true);
    try {
      await uploadMod(filePath);
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(false);
    }
  };

  const lockedMods = mods.filter((m) => m.locked);
  const userMods = mods.filter((m) => !m.locked);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-100">Mods</h1>
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? "Uploading..." : "Upload Mod"}
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-zinc-500">Loading mods...</p>
      ) : (
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Core Mods (locked)
            </h2>
            <ul className="flex flex-col gap-2">
              {lockedMods.map((mod) => (
                <li
                  key={mod.id}
                  className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-900 px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <LockIcon />
                    <span className="font-medium text-zinc-200">{mod.name}</span>
                    <span className="text-sm text-zinc-500">{mod.version}</span>
                  </div>
                </li>
              ))}
              {lockedMods.length === 0 && (
                <li className="text-sm text-zinc-600">No core mods reported.</li>
              )}
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Your Mods
            </h2>
            <ul className="flex flex-col gap-2">
              {userMods.map((mod) => (
                <li
                  key={mod.id}
                  className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-900 px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-200">{mod.name}</span>
                    <span className="text-sm text-zinc-500">{mod.version}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={mod.enabled}
                        onChange={() => handleToggle(mod)}
                        className="peer sr-only"
                      />
                      <div className="h-5 w-9 rounded-full bg-zinc-700 peer-checked:bg-violet-600 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4" />
                    </label>
                    <button
                      onClick={() => handleRemove(mod)}
                      disabled={mod.locked}
                      className="rounded-md border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
              {userMods.length === 0 && (
                <li className="text-sm text-zinc-600">No user-installed mods yet.</li>
              )}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-4 w-4 text-zinc-500"
    >
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
