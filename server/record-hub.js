import { randomUUID } from "node:crypto";
import { fail, getModule, decode } from "./validation.js";
export const emptyHub = () => ({
  tags: [],
  followUp: { date: "", priority: "Normal", assigneeId: "" },
  review: { status: "Not requested", reason: "", by: "", at: "" },
  checklist: [],
  links: [],
  pinned: false,
});
export function installRecordHub(app, db) {
  const now = () => new Date().toISOString();
  function staff(req) {
    if (!["admin", "manager", "viewer"].includes(req.user.role))
      fail("Company staff access required", 403);
  }
  function edit(req) {
    staff(req);
    if (req.user.role === "viewer") fail("Editing access required", 403);
  }
  async function record(tx, req) {
    getModule(req.params.module);
    const [r] = await tx.query(
      "SELECT * FROM records WHERE id=$1 AND module=$2",
      [req.params.id, req.params.module],
    );
    if (!r) fail("Record not found", 404);
    return decode(r);
  }
  async function details(tx, id) {
    const [r] = await tx.query("SELECT * FROM record_hubs WHERE record_id=$1", [
      id,
    ]);
    return r
      ? { ...r, data: { ...emptyHub(), ...JSON.parse(r.data) } }
      : { record_id: id, version: 0, updated_at: "", data: emptyHub() };
  }
  async function persist(tx, id, hub, version) {
    const time = now();
    if (version === 0)
      await tx.exec(
        "INSERT INTO record_hubs (record_id,data,version,updated_at) VALUES ($1,$2,$3,$4)",
        [id, JSON.stringify(hub), 1, time],
      );
    else {
      const r = await tx.exec(
        "UPDATE record_hubs SET data=$1,version=version+1,updated_at=$2 WHERE record_id=$3 AND version=$4",
        [JSON.stringify(hub), time, id, version],
      );
      if ((r.rowCount ?? r.changes) !== 1)
        fail("Record workspace changed. Refresh and retry.", 409);
    }
  }
  async function audit(tx, req, action, name) {
    await tx.exec(
      "INSERT INTO audit (id,actor_id,actor_name,action,module,record_id,detail,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        randomUUID(),
        req.user.id,
        req.user.name,
        action,
        req.params.module,
        req.params.id || null,
        name,
        now(),
      ],
    );
  }
  const tag = (v) => {
    if (typeof v !== "string" || !v.trim() || v.trim().length > 30)
      fail("Tags need 1–30 characters");
    return v.trim().toLowerCase();
  };
  app.get("/api/hub/assignees", async (req, res) => {
    staff(req);
    res.json({
      users: await db.query(
        "SELECT id,name FROM users WHERE disabled=0 AND role IN ('admin','manager') ORDER BY name",
      ),
    });
  });
  app.get("/api/module-hub/:module", async (req, res) => {
    staff(req);
    getModule(req.params.module);
    const rows = await db.query(
      "SELECT r.id,h.data,h.version,h.updated_at FROM records r LEFT JOIN record_hubs h ON h.record_id=r.id WHERE r.module=$1",
      [req.params.module],
    );
    const followed = await db.query(
      "SELECT record_id FROM record_follows WHERE user_id=$1",
      [req.user.id],
    );
    res.json({
      records: rows.map((r) => ({
        id: r.id,
        version: r.version || 0,
        ...(r.data ? JSON.parse(r.data) : emptyHub()),
      })),
      followed: followed.map((r) => r.record_id),
    });
  });
  app.post("/api/module-hub/:module/rename-tag", async (req, res) => {
    edit(req);
    getModule(req.params.module);
    const from = tag(req.body.from),
      to = tag(req.body.to);
    let count = 0;
    await db.transaction(async (tx) => {
      const rows = await tx.query(
        "SELECT h.* FROM record_hubs h JOIN records r ON r.id=h.record_id WHERE r.module=$1",
        [req.params.module],
      );
      for (const r of rows) {
        const d = { ...emptyHub(), ...JSON.parse(r.data) };
        if (d.tags.includes(from)) {
          d.tags = [...new Set(d.tags.map((v) => (v === from ? to : v)))];
          await persist(tx, r.record_id, d, r.version);
          await audit(
            tx,
            { ...req, params: { ...req.params, id: r.record_id } },
            "Renamed record tag",
            from + " → " + to,
          );
          count++;
        }
      }
      await audit(tx, req, "Renamed module tag", from + " → " + to);
    });
    res.json({ updated: count });
  });
  app.get("/api/record-hub/:module/:id", async (req, res) => {
    staff(req);
    const r = await record(db, req),
      h = await details(db, r.id),
      all = (await db.query("SELECT * FROM records")).map(decode);
    const hubs = await db.query("SELECT record_id,data FROM record_hubs");
    const inbound = hubs
      .filter((x) => JSON.parse(x.data).links?.includes(r.id))
      .map((x) => all.find((a) => a.id === x.record_id))
      .filter(Boolean)
      .map((x) => ({ id: x.id, name: x.name, module: x.module }));
    const related = h.data.links
      .map((id) => all.find((x) => x.id === id))
      .filter(Boolean)
      .map((x) => ({
        id: x.id,
        name: x.name,
        module: x.module,
        archived: x.archived,
      }));
    const m = getModule(r.module);
    const missing = m.fields
      .filter(
        (f) =>
          f.required &&
          (r[f.key] === undefined || r[f.key] === null || r[f.key] === ""),
      )
      .map((f) => f.label);
    const followed = await db.query(
      "SELECT record_id FROM record_follows WHERE user_id=$1 AND record_id=$2",
      [req.user.id, r.id],
    );
    res.json({
      data: h.data,
      version: h.version,
      related,
      inbound,
      following: !!followed.length,
      health: {
        missing,
        complete: missing.length === 0,
        checklistDone: h.data.checklist.filter((x) => x.done).length,
        checklistTotal: h.data.checklist.length,
        overdue:
          !!h.data.followUp.date && h.data.followUp.date < now().slice(0, 10),
        unavailableLinks:
          h.data.links.length - related.filter((x) => !x.archived).length,
      },
    });
  });
  app.post("/api/record-hub/:module/:id", async (req, res) => {
    edit(req);
    const { operation, version } = req.body;
    await db.transaction(async (tx) => {
      const r = await record(tx, req),
        h = await details(tx, r.id);
      if (version !== h.version)
        fail("Record workspace changed. Refresh and retry.", 409);
      const d = h.data;
      switch (operation) {
        case "addTag": {
          const t = tag(req.body.tag);
          if (d.tags.length >= 20 && !d.tags.includes(t))
            fail("Maximum 20 tags per record");
          d.tags = [...new Set([...d.tags, t])];
          break;
        }
        case "removeTag":
          {
            const value = tag(req.body.tag);
            d.tags = d.tags.filter((t) => t !== value);
          }
          break;
        case "followUpDate": {
          const v = req.body.date;
          if (
            typeof v !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
            !Number.isFinite(Date.parse(v)) ||
            new Date(v).toISOString().slice(0, 10) !== v
          )
            fail("Choose a valid date");
          d.followUp.date = v;
          break;
        }
        case "clearFollowUp":
          d.followUp.date = "";
          break;
        case "followUpPriority":
          if (!["Low", "Normal", "High", "Urgent"].includes(req.body.priority))
            fail("Invalid priority");
          d.followUp.priority = req.body.priority;
          break;
        case "assignFollowUp": {
          const id = req.body.assigneeId;
          if (typeof id !== "string") fail("Invalid assignee");
          if (id) {
            const [u] = await tx.query(
              "SELECT id FROM users WHERE id=$1 AND disabled=0 AND role IN ('admin','manager')",
              [id],
            );
            if (!u) fail("Assignee is unavailable");
          }
          d.followUp.assigneeId = id;
          break;
        }
        case "requestReview":
          d.review = {
            ...d.review,
            status: "Pending",
            by: req.user.name,
            at: now(),
          };
          break;
        case "approveReview":
          if (!["Pending", "Changes requested"].includes(d.review.status))
            fail("Request a review first");
          d.review = {
            ...d.review,
            status: "Approved",
            by: req.user.name,
            at: now(),
          };
          break;
        case "requestChanges":
          if (!["Pending", "Approved"].includes(d.review.status))
            fail("Request a review first");
          if (
            typeof req.body.reason !== "string" ||
            req.body.reason.trim().length < 5 ||
            req.body.reason.length > 2000
          )
            fail("Explain the requested changes (5–2000 characters)");
          d.review = {
            status: "Changes requested",
            reason: req.body.reason.trim(),
            by: req.user.name,
            at: now(),
          };
          break;
        case "reviewReason":
          if (
            typeof req.body.reason !== "string" ||
            req.body.reason.length > 2000
          )
            fail("Review notes must be text under 2000 characters");
          d.review.reason = req.body.reason.trim();
          d.review.by = req.user.name;
          d.review.at = now();
          break;
        case "addChecklist":
          if (
            typeof req.body.text !== "string" ||
            !req.body.text.trim() ||
            req.body.text.length > 250
          )
            fail("Checklist text needs 1–250 characters");
          if (d.checklist.length >= 100) fail("Maximum 100 checklist items");
          d.checklist.push({
            id: randomUUID(),
            text: req.body.text.trim(),
            done: false,
          });
          break;
        case "editChecklist":
        case "completeChecklist":
        case "removeChecklist": {
          const item = d.checklist.find((x) => x.id === req.body.itemId);
          if (!item) fail("Checklist item not found", 404);
          if (operation === "removeChecklist")
            d.checklist = d.checklist.filter((x) => x.id !== item.id);
          else if (operation === "completeChecklist") {
            if (typeof req.body.done !== "boolean")
              fail("Invalid checklist state");
            item.done = req.body.done;
          } else {
            if (
              typeof req.body.text !== "string" ||
              !req.body.text.trim() ||
              req.body.text.length > 250
            )
              fail("Checklist text needs 1–250 characters");
            item.text = req.body.text.trim();
          }
          break;
        }
        case "addLink": {
          if (typeof req.body.targetId !== "string")
            fail("Choose a related record");
          if (req.body.targetId === r.id)
            fail("A record cannot link to itself");
          const [target] = await tx.query(
            "SELECT id FROM records WHERE id=$1 AND archived=0",
            [req.body.targetId || ""],
          );
          if (!target) fail("Related record is unavailable");
          if (d.links.length >= 50 && !d.links.includes(target.id))
            fail("Maximum 50 related records");
          d.links = [...new Set([...d.links, target.id])];
          break;
        }
        case "removeLink":
          d.links = d.links.filter((id) => id !== req.body.targetId);
          break;
        case "pin":
          d.pinned = true;
          break;
        case "unpin":
          d.pinned = false;
          break;
        default:
          fail("Unknown workspace operation");
      }
      await persist(tx, r.id, d, h.version);
      await audit(tx, req, "Workspace: " + operation, r.name);
    });
    res.json({ ok: true });
  });
  app.post("/api/record-hub/:module/:id/follow", async (req, res) => {
    staff(req);
    const r = await record(db, req);
    await db.exec(
      "INSERT INTO record_follows (user_id,record_id,read_at) VALUES ($1,$2,$3) ON CONFLICT (user_id,record_id) DO NOTHING",
      [req.user.id, r.id, now()],
    );
    res.json({ ok: true });
  });
  app.delete("/api/record-hub/:module/:id/follow", async (req, res) => {
    staff(req);
    const r = await record(db, req);
    await db.exec(
      "DELETE FROM record_follows WHERE user_id=$1 AND record_id=$2",
      [req.user.id, r.id],
    );
    res.json({ ok: true });
  });
  app.get("/api/hub/updates", async (req, res) => {
    staff(req);
    const rows = await db.query(
      "SELECT r.*,f.read_at,h.updated_at AS hub_updated,(SELECT MAX(a.created_at) FROM audit a WHERE a.record_id=r.id) AS audit_updated FROM record_follows f JOIN records r ON r.id=f.record_id LEFT JOIN record_hubs h ON h.record_id=r.id WHERE f.user_id=$1 ORDER BY r.updated_at DESC",
      [req.user.id],
    );
    res.json({
      updates: rows
        .map((r) => ({
          ...decode(r),
          changedAt: [r.updated_at, r.hub_updated || "", r.audit_updated || ""]
            .sort()
            .at(-1),
          readAt: r.read_at,
        }))
        .filter((r) => r.changedAt > r.readAt)
        .map((r) => ({
          id: r.id,
          module: r.module,
          name: r.name,
          changedAt: r.changedAt,
        })),
    });
  });
  app.post("/api/hub/updates/read", async (req, res) => {
    staff(req);
    const ids = req.body.ids;
    if (
      !Array.isArray(ids) ||
      ids.length > 1000 ||
      ids.some((id) => typeof id !== "string")
    )
      fail("Invalid update selection");
    await db.transaction(async (tx) => {
      for (const id of ids)
        await tx.exec(
          "UPDATE record_follows SET read_at=$1 WHERE user_id=$2 AND record_id=$3",
          [now(), req.user.id, id],
        );
    });
    res.json({ ok: true });
  });
}
