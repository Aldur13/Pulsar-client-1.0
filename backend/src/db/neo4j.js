import neo4j from "neo4j-driver";

const uri = process.env.NEO4J_URI || "bolt://localhost:7687";
const user = process.env.NEO4J_USER || "neo4j";
const password = process.env.NEO4J_PASSWORD || "changeme";

const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

function getSession() {
  return driver.session();
}

const CONSTRAINTS = [
  "CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE",
  "CREATE CONSTRAINT cape_id_unique IF NOT EXISTS FOR (c:Cape) REQUIRE c.id IS UNIQUE",
  "CREATE CONSTRAINT server_id_unique IF NOT EXISTS FOR (s:Server) REQUIRE s.id IS UNIQUE",
];

// Neo4j may not be up yet when the backend boots in dev (the user often starts
// them in either order). We never want a missing database to take down the whole
// API process, so failures here are logged and retried in the background instead
// of thrown — routes that touch the DB will simply error per-request until it's reachable.
async function initSchema({ retry = true } = {}) {
  const session = getSession();
  try {
    for (const statement of CONSTRAINTS) {
      await session.run(statement);
    }
    console.log("[neo4j] schema constraints ensured");
    return true;
  } catch (err) {
    console.warn(
      `[neo4j] could not initialize schema (${err.message}). Is Neo4j running? Retrying in background...`
    );
    if (retry) {
      setTimeout(() => {
        initSchema().catch(() => {});
      }, 5000);
    }
    return false;
  } finally {
    await session.close();
  }
}

export { driver, getSession, initSchema };
