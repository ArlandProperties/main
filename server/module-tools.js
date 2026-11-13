import { randomUUID } from "node:crypto";
import { getModule, fail, decode } from "./validation.js";
import { scopedRecords } from "./access.js";
export function installModuleTools(app, db) {
  const now = () => new Date().toISOString();
  async function record(req) {
    const m = getModule(req.params.module);
    if (req.user.role === "tenant") fail("Staff access required", 403);
    const all = (await db.query("SELECT * FROM records")).map(decode);
    const r = scopedRecords(req.user, all).find(
      (r) => r.id === req.params.id && r.module === m.id,
    );
    if (!r) fail("Record not found", 404);
    if (req.user.role === "agent")
      fail("This collaboration tool requires company staff access", 403);
    return r;
  }
  app.get("/api/preferences/:module", async (req, res) => {
    getModule(req.params.module);
    if (req.user.role === "tenant") fail("Staff access required", 403);
    const [r] = await db.query(
      "SELECT data FROM preferences WHERE user_id=$1 AND module=$2",
      [req.user.id, req.params.module],
    );
    res.json(r ? JSON.parse(r.data) : {});
  });
  app.put("/api/preferences/:module", async (req, res) => {
    getModule(req.params.module);
    if (req.user.role === "tenant") fail("Staff access required", 403);
    const p = req.body;
    if (
      !p ||
      typeof p !== "object" ||
      Array.isArray(p) ||
      JSON.stringify(p).length > 50000
    )
      fail("Invalid preferences");
    const allowed = ["density", "pageSize", "columns", "bookmarks", "views"];
    if (Object.keys(p).some((k) => !allowed.includes(k)))
      fail("Unknown preference");
    if (p.density && !["compact", "comfortable"].includes(p.density))
      fail("Invalid density");
    if (p.pageSize && ![12, 24, 48, 100].includes(p.pageSize))
      fail("Invalid page size");
    const schema = getModule(req.params.module);
    if (
      p.columns &&
      (!Array.isArray(p.columns) ||
        p.columns.some((k) => !schema.fields.some((f) => f.key === k)))
    )
      fail("Invalid columns");
    if (
      p.bookmarks &&
      (!Array.isArray(p.bookmarks) ||
        p.bookmarks.length > 1000 ||
        p.bookmarks.some((id) => typeof id !== "string" || id.length > 100))
    )
      fail("Invalid bookmarks");
    if (
      p.views &&
      (!Array.isArray(p.views) ||
        p.views.length > 20 ||
        p.views.some(
          (v) =>
            !v ||
            typeof v.name !== "string" ||
            !v.name.trim() ||
            v.name.length > 60 ||
            !v.view ||
            typeof v.view !== "object" ||
            Object.values(v.view).some(
              (x) => !["string", "boolean", "number"].includes(typeof x),
            ),
        ))
    )
      fail("Invalid saved views");
    await db.exec(
      "INSERT INTO preferences (user_id,module,data) VALUES ($1,$2,$3) ON CONFLICT (user_id,module) DO UPDATE SET data=excluded.data",
      [req.user.id, req.params.module, JSON.stringify(p)],
    );
    res.json({ ok: true });
  });
  app.get("/api/record-tools/:module/:id", async (req, res) => {
    await record(req);
    const comments = await db.query(
      "SELECT id,author_name,body,created_at FROM comments WHERE record_id=$1 ORDER BY created_at",
      [req.params.id],
    );
    const history = await db.query(
      "SELECT id,actor_name,action,detail,created_at FROM audit WHERE record_id=$1 AND module=$2 ORDER BY created_at DESC LIMIT 100",
      [req.params.id, req.params.module],
    );
    res.json({ comments, history });
  });
  app.post("/api/record-tools/:module/:id/comments", async (req, res) => {
    await record(req);
    if (!["admin", "manager"].includes(req.user.role))
      fail("Editing access required", 403);
    const text = req.body.body;
    if (
      typeof text !== "string" ||
      text.trim().length < 1 ||
      text.length > 5000
    )
      fail("Comments need 1–5000 characters");
    const time = now();
    await db.transaction(async (tx) => {
      await tx.exec(
        "INSERT INTO comments (id,record_id,author_id,author_name,body,created_at) VALUES ($1,$2,$3,$4,$5,$6)",
        [
          randomUUID(),
          req.params.id,
          req.user.id,
          req.user.name,
          text.trim(),
          time,
        ],
      );
      await tx.exec(
        "INSERT INTO audit (id,actor_id,actor_name,action,module,record_id,detail,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          randomUUID(),
          req.user.id,
          req.user.name,
          "Added internal comment",
          req.params.module,
          req.params.id,
          "Internal comment added",
          time,
        ],
      );
    });
    res.status(201).json({ ok: true });
  });
}
