import { Router } from "express";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NEWS_PATH = path.join(__dirname, "..", "data", "news.json");

const router = Router();

router.get("/", async (req, res) => {
  try {
    const raw = await readFile(NEWS_PATH, "utf-8");
    res.json(JSON.parse(raw));
  } catch (err) {
    console.error("[news] failed to read news:", err);
    res.status(500).json({ error: "failed to load news" });
  }
});

export default router;
