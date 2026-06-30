import { useEffect, useState } from "react";
import { getNews, type NewsItem } from "../lib/api";

export default function News() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getNews()
      .then(setItems)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-zinc-100">News</h1>

      {loading && <p className="text-zinc-500">Loading news...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex flex-col gap-4">
        {items.map((item) => (
          <article
            key={item.id}
            className="rounded-md border border-zinc-800 bg-zinc-900 p-4"
          >
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <h2 className="font-semibold text-zinc-100">{item.title}</h2>
              <span className="shrink-0 text-xs text-zinc-500">
                {new Date(item.publishedAt).toLocaleDateString()}
              </span>
            </div>
            <p className="whitespace-pre-line text-sm text-zinc-400">{item.body}</p>
          </article>
        ))}
      </div>

      {!loading && items.length === 0 && (
        <p className="text-sm text-zinc-600">No news yet.</p>
      )}
    </div>
  );
}
