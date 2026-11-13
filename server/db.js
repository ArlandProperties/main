import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import pg from "pg";
export async function openDatabase({
  url = process.env.DATABASE_URL,
  file = process.env.SQLITE_PATH || "data/arcland.sqlite",
} = {}) {
  let pool, sqlite;
  if (url) pool = new pg.Pool({ connectionString: url, max: 10 });
  else {
    if (process.env.NODE_ENV === "production")
      throw new Error("DATABASE_URL is required in production");
    mkdirSync(dirname(file), { recursive: true });
    const { DatabaseSync } = await import("node:sqlite");
    sqlite = new DatabaseSync(file);
    sqlite.exec(
      "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
    );
  }
  const make = (client) => ({
    async query(sql, args = []) {
      if (client) return (await client.query(sql, args)).rows;
      const normalized = sql.replace(/\$\d+/g, "?");
      return sqlite.prepare(normalized).all(...args);
    },
    async exec(sql, args = []) {
      if (client) return client.query(sql, args);
      return sqlite.prepare(sql.replace(/\$\d+/g, "?")).run(...args);
    },
  });
  let queue = Promise.resolve();
  const raw = make(pool);
  const enqueue = (fn) => {
    const result = queue.then(fn);
    queue = result.catch(() => {});
    return result;
  };
  const base = pool
    ? raw
    : {
        query: (...args) => enqueue(() => raw.query(...args)),
        exec: (...args) => enqueue(() => raw.exec(...args)),
      };
  base.transaction = async (fn) => {
    if (pool) {
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        await c.query("SELECT pg_advisory_xact_lock(18472931)");
        const result = await fn(make(c));
        await c.query("COMMIT");
        return result;
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    }
    return enqueue(async () => {
      try {
        sqlite.exec("BEGIN IMMEDIATE");
        const r = await fn(raw);
        sqlite.exec("COMMIT");
        return r;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    });
  };
  base.close = () => (pool ? pool.end() : enqueue(() => sqlite.close()));
  for (const sql of [
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL, disabled INTEGER NOT NULL DEFAULT 0, profile TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS activations (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, module TEXT NOT NULL, data TEXT NOT NULL, status TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS records_module_idx ON records(module,archived)`,
    `CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, action TEXT NOT NULL, module TEXT, record_id TEXT, detail TEXT NOT NULL, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS settings (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS setup_lock (id TEXT PRIMARY KEY)`,
  ])
    await base.exec(sql);
  const columns = pool
    ? await base.query(
        "SELECT column_name AS name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='users'",
      )
    : await base.query("PRAGMA table_info(users)");
  if (!columns.some((c) => c.name === "profile"))
    await base.exec(
      "ALTER TABLE users ADD COLUMN profile TEXT NOT NULL DEFAULT '{}'",
    );
  await base.exec(
    "INSERT INTO setup_lock (id) VALUES ('owner') ON CONFLICT (id) DO NOTHING",
  );
  return base;
}
