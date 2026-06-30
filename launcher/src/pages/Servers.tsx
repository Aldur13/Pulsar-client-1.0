import { useEffect, useState } from "react";
import { getServers, type Server } from "../lib/api";

export default function Servers() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getServers()
      .then(setServers)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold text-zinc-100">Servers</h1>

      {loading && <p className="text-zinc-500">Loading servers...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {servers.map((server) => (
          <div
            key={server.id}
            className="flex gap-3 rounded-md border border-zinc-800 bg-zinc-900 p-4"
          >
            {server.icon ? (
              <img
                src={server.icon}
                alt={server.name}
                className="h-12 w-12 rounded-md object-cover"
              />
            ) : (
              <div className="h-12 w-12 rounded-md bg-zinc-800" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="truncate font-semibold text-zinc-100">{server.name}</h2>
                <span className="shrink-0 text-xs text-zinc-500">
                  {server.playersOnline}/{server.maxPlayers}
                </span>
              </div>
              <p className="truncate text-sm text-zinc-400">{server.motd}</p>
              <p className="truncate text-xs text-zinc-600">{server.address}</p>
            </div>
          </div>
        ))}
      </div>

      {!loading && servers.length === 0 && (
        <p className="text-sm text-zinc-600">No servers listed yet.</p>
      )}
    </div>
  );
}
