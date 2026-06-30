import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { open } from "@tauri-apps/plugin-shell";
import { getMicrosoftLoginUrl } from "../lib/api";
import { useAuth } from "../lib/auth";

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 60_000;

export default function Login() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [polling, setPolling] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (user) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleLogin = async () => {
    setTimedOut(false);
    setPolling(true);
    await open(getMicrosoftLoginUrl());

    const startedAt = Date.now();
    pollRef.current = setInterval(async () => {
      await refresh();
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        if (pollRef.current) clearInterval(pollRef.current);
        setPolling(false);
        setTimedOut(true);
      }
    }, POLL_INTERVAL_MS);
  };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 pt-24 text-center">
      <h1 className="text-2xl font-bold text-zinc-100">Sign in to Pulsar Client</h1>
      <p className="text-sm text-zinc-400">
        An official Microsoft account is required to launch the game, just like the
        vanilla Minecraft launcher.
      </p>

      <button
        onClick={handleLogin}
        disabled={polling}
        className="flex items-center gap-2 rounded-md bg-violet-600 px-5 py-2.5 font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {polling ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Waiting for browser login...
          </>
        ) : (
          "Login with Microsoft"
        )}
      </button>

      {timedOut && (
        <p className="text-sm text-amber-400">
          Didn't detect a session after 60s. See the note below — this step doesn't
          fully close the loop yet.
        </p>
      )}

      <div className="rounded-md border border-amber-700/40 bg-amber-950/30 p-4 text-left text-xs leading-relaxed text-amber-200/90">
        <p className="font-semibold text-amber-300">Known limitation</p>
        <p className="mt-1">
          This button opens the Microsoft login in your system browser (required for a
          desktop app — Tauri's webview shouldn't host the OAuth flow directly). The
          backend then sets a session cookie in that external browser. However, cookies
          set in the system browser are not shared with the Tauri webview's separate
          cookie jar, so this app polling <code>/api/auth/me</code> from inside the
          window cannot actually observe that session yet. Fully closing this loop needs
          a registered custom URI scheme (e.g. <code>pulsar://auth-callback?token=...</code>)
          that the backend redirects to instead of localhost, which is a follow-up,
          not implemented in this pass.
        </p>
      </div>
    </div>
  );
}
