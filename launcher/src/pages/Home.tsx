import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getInstallStatus,
  installOrUpdate,
  launchGame,
  onInstallProgress,
  type InstallProgressEvent,
  type InstallStatus,
} from "../lib/tauri";
import { useAuth } from "../lib/auth";

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<InstallStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<InstallProgressEvent | null>(null);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getInstallStatus()
      .then(setStatus)
      .catch((e) => setError(String(e)))
      .finally(() => setLoadingStatus(false));
  }, []);

  useEffect(() => {
    const unlistenPromise = onInstallProgress(setProgress);
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const fullyInstalled =
    !!status && status.vanillaInstalled && status.fabricInstalled && status.modsInstalled;

  const handleInstall = async () => {
    setError(null);
    setInstalling(true);
    setProgress(null);
    try {
      await installOrUpdate();
      const refreshed = await getInstallStatus();
      setStatus(refreshed);
    } catch (e) {
      setError(String(e));
    } finally {
      setInstalling(false);
    }
  };

  const handlePlay = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    setError(null);
    setLaunching(true);
    try {
      await launchGame(user.username, user.id, user.accessToken);
    } catch (e) {
      setError(String(e));
    } finally {
      setLaunching(false);
    }
  };

  const percent =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : 0;

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-8 pt-16 text-center">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100">Pulsar Client</h1>
        {status && (
          <p className="mt-2 text-sm text-zinc-400">
            Minecraft {status.pinnedVersion} + Fabric — locked
          </p>
        )}
      </div>

      {!user && (
        <p className="rounded-md border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-400">
          Log in with Microsoft to launch the game.
        </p>
      )}

      {loadingStatus ? (
        <p className="text-zinc-500">Checking install status...</p>
      ) : installing ? (
        <div className="w-full max-w-md">
          <div className="mb-2 flex justify-between text-sm text-zinc-400">
            <span>{progress?.phase ?? "Preparing..."}</span>
            <span>{percent}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-violet-600 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      ) : fullyInstalled ? (
        <button
          onClick={handlePlay}
          disabled={launching}
          className="rounded-lg bg-violet-600 px-12 py-4 text-xl font-bold text-white shadow-lg shadow-violet-900/40 hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {launching ? "Launching..." : "Play"}
        </button>
      ) : (
        <button
          onClick={handleInstall}
          className="rounded-lg bg-violet-600 px-12 py-4 text-xl font-bold text-white shadow-lg shadow-violet-900/40 hover:bg-violet-500"
        >
          Install
        </button>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
