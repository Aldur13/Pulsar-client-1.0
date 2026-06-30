import { useEffect, useState } from "react";
import {
  addFriend,
  getFriends,
  getOnlineFriends,
  type Friend,
  type FriendPresence,
} from "../lib/api";

export default function Friends() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [presence, setPresence] = useState<FriendPresence>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newFriend, setNewFriend] = useState("");
  const [adding, setAdding] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const [friendList, presenceMap] = await Promise.all([
        getFriends(),
        getOnlineFriends().catch(() => ({}) as FriendPresence),
      ]);
      setFriends(friendList);
      setPresence(presenceMap);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const handleAdd = async () => {
    if (!newFriend.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await addFriend(newFriend.trim());
      setNewFriend("");
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-bold text-zinc-100">Friends</h1>

      <div className="mb-6 flex gap-2">
        <input
          value={newFriend}
          onChange={(e) => setNewFriend(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Username"
          className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-violet-500 focus:outline-none"
        />
        <button
          onClick={handleAdd}
          disabled={adding}
          className="rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Add friend
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
      {loading && <p className="text-zinc-500">Loading friends...</p>}

      <ul className="flex flex-col gap-2">
        {friends.map((friend) => (
          <li
            key={friend.id}
            className="flex items-center gap-3 rounded-md border border-zinc-800 bg-zinc-900 px-4 py-3"
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                presence[friend.id] ? "bg-emerald-500" : "bg-zinc-600"
              }`}
            />
            <span className="font-medium text-zinc-200">{friend.username}</span>
          </li>
        ))}
      </ul>

      {!loading && friends.length === 0 && (
        <p className="text-sm text-zinc-600">No friends added yet.</p>
      )}
    </div>
  );
}
