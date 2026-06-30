import { Router } from "express";
import jwt from "jsonwebtoken";
import {
  getAuthorizationUrl,
  fullLoginChain,
  MinecraftAuthError,
} from "../auth/microsoft.js";
import { getSession } from "../db/neo4j.js";

const router = Router();

router.get("/microsoft/login", (req, res) => {
  res.redirect(getAuthorizationUrl());
});

router.get("/microsoft/callback", async (req, res) => {
  const { code } = req.query;
  const frontendUrl = process.env.FRONTEND_URL;

  if (!code) {
    return res.redirect(`${frontendUrl}/?login=error&reason=missing_code`);
  }

  try {
    const { mcAccessToken, profile } = await fullLoginChain(code);

    const session = getSession();
    try {
      await session.run(
        "MERGE (u:User {id: $mcUuid}) SET u.username = $name, u.lastLogin = datetime()",
        { mcUuid: profile.id, name: profile.name }
      );
    } finally {
      await session.close();
    }

    // Real Minecraft access tokens are valid ~24h, so the session cookie matches that
    // lifetime rather than a long-lived 7d session. A "stay logged in" experience past
    // that would need persisting the MS refresh_token and re-running fullLoginChain to
    // mint a fresh mcAccessToken — left as a follow-up, not faked here.
    const token = jwt.sign(
      { sub: profile.id, username: profile.name, mcAccessToken },
      process.env.JWT_SECRET,
      { expiresIn: "23h" }
    );

    res.cookie("pulsar_session", token, {
      httpOnly: true,
      maxAge: 23 * 60 * 60 * 1000,
      sameSite: "lax",
    });

    res.redirect(`${frontendUrl}/?login=success`);
  } catch (err) {
    const reason =
      err instanceof MinecraftAuthError ? err.userMessage : "Login failed. Please try again.";
    console.error("[auth] login chain failed:", err);
    res.redirect(`${frontendUrl}/?login=error&reason=${encodeURIComponent(reason)}`);
  }
});

router.get("/me", (req, res) => {
  const token = req.cookies?.pulsar_session;
  if (!token) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    res.json({
      id: payload.sub,
      username: payload.username,
      accessToken: payload.mcAccessToken,
    });
  } catch {
    res.status(401).json({ error: "unauthorized" });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("pulsar_session");
  res.json({ ok: true });
});

export default router;
