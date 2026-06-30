import { Router } from "express";
import { getSession } from "../db/neo4j.js";
import { requireAuth } from "../middleware/session.js";

const router = Router();

const SEED_CAPES = [
  { id: "cape-classic", name: "Classic Cape", imageUrl: "/cosmetics/capes/classic.png" },
  { id: "cape-pulsar", name: "Pulsar Glow", imageUrl: "/cosmetics/capes/pulsar.png" },
  { id: "cape-founder", name: "Founder's Cape", imageUrl: "/cosmetics/capes/founder.png" },
];

async function seedCapes() {
  const session = getSession();
  try {
    const existing = await session.run("MATCH (c:Cape) RETURN count(c) AS count");
    const count = existing.records[0].get("count").toNumber();
    if (count > 0) return;

    for (const cape of SEED_CAPES) {
      await session.run(
        "MERGE (c:Cape {id: $id}) SET c.name = $name, c.imageUrl = $imageUrl",
        cape
      );
    }
    console.log("[cosmetics] seeded capes");
  } catch (err) {
    console.warn("[cosmetics] could not seed capes (Neo4j unreachable?):", err.message);
  } finally {
    await session.close();
  }
}

router.get("/capes", async (req, res) => {
  const session = getSession();
  try {
    const result = await session.run("MATCH (c:Cape) RETURN c ORDER BY c.id");
    const capes = result.records.map((r) => r.get("c").properties);
    res.json(capes);
  } catch (err) {
    console.error("[cosmetics] failed to list capes:", err);
    res.status(503).json({ error: "cosmetics service unavailable" });
  } finally {
    await session.close();
  }
});

router.get("/equipped/:userId", async (req, res) => {
  const session = getSession();
  try {
    const result = await session.run(
      "MATCH (u:User {id: $userId})-[:EQUIPS]->(c:Cape) RETURN c",
      { userId: req.params.userId }
    );
    if (result.records.length === 0) {
      return res.json(null);
    }
    res.json(result.records[0].get("c").properties);
  } catch (err) {
    console.error("[cosmetics] failed to get equipped cape:", err);
    res.status(503).json({ error: "cosmetics service unavailable" });
  } finally {
    await session.close();
  }
});

router.post("/equip", requireAuth, async (req, res) => {
  const { capeId } = req.body;
  if (!capeId) {
    return res.status(400).json({ error: "capeId is required" });
  }

  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (u:User {id: $uid})
       OPTIONAL MATCH (u)-[r:EQUIPS]->(:Cape)
       DELETE r
       WITH u
       MATCH (c:Cape {id: $capeId})
       MERGE (u)-[:EQUIPS]->(c)
       RETURN c`,
      { uid: req.user.id, capeId }
    );

    if (result.records.length === 0) {
      return res.status(404).json({ error: "cape not found" });
    }

    res.json(result.records[0].get("c").properties);
  } catch (err) {
    console.error("[cosmetics] failed to equip cape:", err);
    res.status(503).json({ error: "cosmetics service unavailable" });
  } finally {
    await session.close();
  }
});

export default router;
export { seedCapes };
