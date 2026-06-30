import jwt from "jsonwebtoken";

function requireAuth(req, res, next) {
  const token = req.cookies?.pulsar_session;
  if (!token) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, username: payload.username };
    next();
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
}

export { requireAuth };
