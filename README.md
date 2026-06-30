# Pulsar Client

A desktop Minecraft launcher (Tauri + React) that manages a pinned vanilla + Fabric
install, auto-injects a fixed mod loadout (Sodium, Iris, Lithium, custom mods) plus
user-uploaded mods, and talks to a Pulsar backend for auth, mod manifests, cosmetics,
server list, news, and friends.

## Structure

```
launcher/          Tauri app (Rust backend in src-tauri/, React frontend in src/)
backend/           Node + Express + Neo4j API
docs/              Architecture & setup notes
```

## Quick start

### Backend

```
cd backend
cp .env.example .env   # fill in Neo4j + Microsoft OAuth credentials
npm install
npm run dev
```

### Launcher

```
cd launcher
npm install
npm run tauri dev
```

See `docs/SETUP.md` for full setup (Neo4j, Azure AD app registration, version pinning).
