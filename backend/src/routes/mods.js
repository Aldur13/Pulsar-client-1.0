import { Router } from "express";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.join(__dirname, "..", "data", "mod-manifest.json");

const router = Router();

router.get("/manifest", async (req, res) => {
  try {
    const raw = await readFile(MANIFEST_PATH, "utf-8");
    res.json(JSON.parse(raw));
  } catch (err) {
    console.error("[mods] failed to read manifest:", err);
    res.status(500).json({ error: "failed to load mod manifest" });
  }
});

export default router;
