import { Router } from "express";
import { getSession } from "../db/neo4j.js";
import { requireAuth } from "../middleware/session.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const session = getSession();
  try {
    const result = await session.run(
      "MATCH (me:User {id: $uid})-[:FRIENDS_WITH]-(f:User) RETURN f",
      { uid: req.user.id }
    );
    res.json(result.records.map((r) => r.get("f").properties));
  } catch (err) {
    console.error("[friends] failed to list friends:", err);
    res.status(503).json({ error: "friends service unavailable" });
  } finally {
    await session.close();
  }
});

router.post("/add", requireAuth, async (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: "username is required" });
  }

  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (a:User {id: $uid})
       MATCH (b:User {username: $username})
       WHERE a.id <> b.id
       MERGE (a)-[:FRIENDS_WITH]-(b)
       RETURN b`,
      { uid: req.user.id, username }
    );

    if (result.records.length === 0) {
      return res.status(404).json({ error: "user not found" });
    }

    res.json(result.records[0].get("b").properties);
  } catch (err) {
    console.error("[friends] failed to add friend:", err);
    res.status(503).json({ error: "friends service unavailable" });
  } finally {
    await session.close();
  }
});

// Real presence requires the Paper server plugin to report who's online;
// out of scope for this pass, so this is a stub.
router.get("/online", requireAuth, async (req, res) => {
  res.json({});
});

export default router;
