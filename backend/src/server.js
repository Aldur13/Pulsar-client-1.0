import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

import { initSchema } from "./db/neo4j.js";
import { seedCapes } from "./routes/cosmetics.js";

import authRouter from "./routes/auth.js";
import modsRouter from "./routes/mods.js";
import cosmeticsRouter from "./routes/cosmetics.js";
import serversRouter from "./routes/servers.js";
import newsRouter from "./routes/news.js";
import friendsRouter from "./routes/friends.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/api/auth", authRouter);
app.use("/api/mods", modsRouter);
app.use("/api/cosmetics", cosmeticsRouter);
app.use("/api/servers", serversRouter);
app.use("/api/news", newsRouter);
app.use("/api/friends", friendsRouter);

const PORT = process.env.PORT || 8787;

// Don't let a Neo4j outage prevent the HTTP server from starting - in dev the
// user may well start the backend before `docker compose up -d` brings Neo4j
// up. initSchema()/seedCapes() log a warning and retry in the background.
async function start() {
  await initSchema();
  await seedCapes();

  app.listen(PORT, () => {
    console.log(`[server] Pulsar Client backend listening on port ${PORT}`);
  });
}

start();
