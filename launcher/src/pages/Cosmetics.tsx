import { useEffect, useState } from "react";
import { BACKEND_URL, equipCape, getCapes, getEquippedCape, type Cape } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function Cosmetics() {
  const { user } = useAuth();
  const [capes, setCapes] = useState<Cape[]>([]);
  const [equipped, setEquipped] = useState<Cape | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [equipping, setEquipping] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const capeList = await getCapes();
        if (cancelled) return;
        setCapes(capeList);
        if (user) {
          const current = await getEquippedCape(user.id);
          if (!cancelled) setEquipped(current);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleEquip = async (cape: Cape) => {
    if (!user) {
      setError("Log in to equip a cape.");
      return;
    }
    setEquipping(cape.id);
    setError(null);
    try {
      await equipCape(cape.id);
      setEquipped(cape);
    } catch (e) {
      setError(String(e));
    } finally {
      setEquipping(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-2xl font-bold text-zinc-100">Cosmetics</h1>

      {!user && (
        <p className="mb-4 rounded-md border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-400">
          Log in with Microsoft to equip capes.
        </p>
      )}
      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
      {loading && <p className="text-zinc-500">Loading capes...</p>}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {capes.map((cape) => {
          const isEquipped = equipped?.id === cape.id;
          return (
            <div
              key={cape.id}
              className={`flex flex-col items-center gap-2 rounded-md border p-4 ${
                isEquipped
                  ? "border-violet-500 bg-violet-950/30"
                  : "border-zinc-800 bg-zinc-900"
              }`}
            >
              <img
                src={`${BACKEND_URL}${cape.imageUrl}`}
                alt={cape.name}
                className="h-20 w-20 object-contain"
              />
              <span className="text-sm font-medium text-zinc-200">{cape.name}</span>
              <button
                onClick={() => handleEquip(cape)}
                disabled={isEquipped || equipping === cape.id || !user}
                className="w-full rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isEquipped ? "Equipped" : equipping === cape.id ? "Equipping..." : "Equip"}
              </button>
            </div>
          );
        })}
      </div>

      {!loading && capes.length === 0 && (
        <p className="text-sm text-zinc-600">No capes available yet.</p>
      )}
    </div>
  );
}
