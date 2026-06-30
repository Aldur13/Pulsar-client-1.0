export const BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "http://localhost:8787";

export interface AuthUser {
  id: string;
  username: string;
}

export interface ManifestMod {
  id: string;
  name: string;
  version: string;
  url: string;
  sha1: string;
  locked: boolean;
}

export interface ModManifest {
  minecraftVersion: string;
  fabricLoaderVersion: string;
  fabricInstallerVersion: string;
  mods: ManifestMod[];
}

export interface Cape {
  id: string;
  name: string;
  imageUrl: string;
}

export interface Server {
  id: string;
  name: string;
  address: string;
  motd: string;
  playersOnline: number;
  maxPlayers: number;
  icon: string;
}

export interface NewsItem {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
}

export interface Friend {
  id: string;
  username: string;
}

export type FriendPresence = Record<string, boolean>;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} failed with ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export function getMicrosoftLoginUrl(): string {
  return `${BACKEND_URL}/api/auth/microsoft/login`;
}

export async function getMe(): Promise<AuthUser | null> {
  try {
    return await request<AuthUser>("/api/auth/me");
  } catch {
    return null;
  }
}

export function logout(): Promise<void> {
  return request<void>("/api/auth/logout", { method: "POST" });
}

export function getModManifest(): Promise<ModManifest> {
  return request<ModManifest>("/api/mods/manifest");
}

export function getCapes(): Promise<Cape[]> {
  return request<Cape[]>("/api/cosmetics/capes");
}

export function getEquippedCape(userId: string): Promise<Cape | null> {
  return request<Cape | null>(`/api/cosmetics/equipped/${encodeURIComponent(userId)}`);
}

export function equipCape(capeId: string): Promise<void> {
  return request<void>("/api/cosmetics/equip", {
    method: "POST",
    body: JSON.stringify({ capeId }),
  });
}

export function getServers(): Promise<Server[]> {
  return request<Server[]>("/api/servers");
}

export function getNews(): Promise<NewsItem[]> {
  return request<NewsItem[]>("/api/news");
}

export function getFriends(): Promise<Friend[]> {
  return request<Friend[]>("/api/friends");
}

export function addFriend(username: string): Promise<void> {
  return request<void>("/api/friends/add", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

export function getOnlineFriends(): Promise<FriendPresence> {
  return request<FriendPresence>("/api/friends/online");
}
