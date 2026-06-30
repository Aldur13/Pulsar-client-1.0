# Pulsar Client

A desktop Minecraft launcher (Tauri + React) that manages a pinned vanilla + Fabric
install, auto-injects a fixed mod loadout (Sodium, Iris, Lithium, custom mods) plus
user-uploaded mods, and talks to a Pulsar backend for auth, mod manifests, cosmetics,
server list, news, and friends.

## Structure

```
launcher/          Tauri app (Rust backend in src-tauri/, React frontend in src/)
backend/           Node + Express + Neo4j API
docs/              Setup notes
```

## Quick start

### 1. Neo4j

```
cd backend
docker compose up -d   # starts neo4j:5 on bolt://localhost:7687 (neo4j/changeme)
```

### 2. Backend

```
cd backend
cp .env.example .env   # fill in MS_CLIENT_ID / MS_CLIENT_SECRET (see docs/SETUP.md)
npm install
npm run dev
```

Runs on `http://localhost:8787`. Boots fine even if Neo4j isn't up yet (routes that
need it return 503 until the DB is reachable); retries the connection in the background.

### 3. Launcher

```
cd launcher
npm install
npm run tauri dev
```

Opens the Tauri window against `http://localhost:1420`. Requires the backend running
for login, mod manifest, cosmetics, servers, news, and friends — the install/launch
pipeline itself (vanilla MC + Fabric download, mod injection, Java process launch)
works independently of the backend (falls back to an embedded default mod manifest).

See `docs/SETUP.md` for Azure AD app registration and known limitations.

## Pinned version

Minecraft `1.21.4` + Fabric Loader `0.16.10`, defined in one place
(`backend/src/data/mod-manifest.json`, mirrored as a fallback in
`launcher/src-tauri/src/config.rs`). The launcher never exposes a version picker —
update the manifest centrally to roll out a new pinned version/mod set without
rebuilding the launcher.
