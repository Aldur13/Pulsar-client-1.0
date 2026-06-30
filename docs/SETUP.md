# Setup

## Neo4j

`cd backend && docker compose up -d` starts Neo4j 5 Community with auth `neo4j/changeme`
(bolt on 7687, browser UI on 7474). Match `NEO4J_PASSWORD` in `backend/.env` to whatever
you set in `docker-compose.yml`.

## Microsoft OAuth (real login, not mocked)

The backend implements the actual Microsoft → Xbox Live → XSTS → Minecraft Services
auth chain used by the official launcher. To activate it:

1. Go to the **Azure Portal → Microsoft Entra ID → App registrations → New registration**.
2. Supported account types: **Personal Microsoft accounts only** (the backend calls the
   `/consumers/` tenant endpoint).
3. Redirect URI (platform: Web): `http://localhost:8787/api/auth/microsoft/callback`
   (must match `MS_REDIRECT_URI` in `backend/.env` exactly).
4. Under **Certificates & secrets**, create a client secret.
5. Put the Application (client) ID and secret into `backend/.env` as `MS_CLIENT_ID` /
   `MS_CLIENT_SECRET`.
6. Your app also needs the Xbox Live / Minecraft API product association that Mojang
   requires for "Minecraft" scoped apps — follow Mojang's launcher integration docs for
   the current process, since Microsoft/Mojang change this occasionally.

Until those env vars are filled in, `/api/auth/microsoft/login` will redirect using a
placeholder client ID and fail at Microsoft's login page — every other route works
without auth.

## Known limitations (flagged honestly, not papered over)

- **OAuth session handoff into the Tauri webview is incomplete.** The login flow opens
  Microsoft's login in the user's system browser (required — Microsoft blocks login
  inside embedded webviews). The backend then sets a session cookie in that *system
  browser's* cookie jar, which is a separate network stack from the Tauri webview, so
  the app can't see it by polling `/api/auth/me`. Closing the loop needs a registered
  custom URI scheme (e.g. `pulsar://auth-callback?token=...`) that the system browser
  redirects to and Tauri intercepts to hand the token back into the app. Not yet wired
  up — flagged in the Login page UI itself.
- **Mod manifest URLs/versions/hashes are placeholders.** `backend/src/data/mod-manifest.json`
  uses real Modrinth CDN URL *shapes* for Fabric API/Sodium/Iris/Lithium, but the exact
  version strings and SHA1 hashes should be verified against Modrinth before shipping.
- **No bundled JRE.** The launcher shells out to `java` on PATH. Bundling a JRE per-platform
  is a reasonable Phase 4+ follow-up.
- **Server list is mostly mock data**, except one entry which attempts a real Minecraft
  Server List Ping (handshake + status request over raw TCP) before falling back to mock
  numbers if no server is reachable — see `backend/src/routes/servers.js`.
- **Friends "online" presence is a stub.** Real presence needs a small plugin on the
  Paper server reporting who's connected; out of scope for this pass.
