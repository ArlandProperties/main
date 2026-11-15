import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { openDatabase } from "../server/db.js";
import { createApp } from "../server/app.js";
import { seed } from "../server/seed.js";
import { modules, recordHubFeatureCatalog } from "../shared/modules.js";
let dir, db, server, base, cookie, pool, schema, records, ownerId;
async function call(path, { method = "GET", body, session = cookie } = {}) {
  const r = await fetch(base + "/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Arcland-Request": "1",
      ...(session ? { cookie: session } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
before(async () => {
  dir = mkdtempSync(join(tmpdir(), "arcland-hub-"));
  let url;
  if (process.env.TEST_DATABASE_URL) {
    pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
    schema = "hub_" + randomUUID().replaceAll("-", "");
    await pool.query('CREATE SCHEMA "' + schema + '"');
    const u = new URL(process.env.TEST_DATABASE_URL);
    u.searchParams.set("options", "-c search_path=" + schema);
    url = u.toString();
  }
  db = await openDatabase({ url, file: join(dir, "hub.sqlite") });
  server = createApp(db, { setupToken: "hub-test-setup" }).listen(
    0,
    "127.0.0.1",
  );
  await new Promise((r) => server.once("listening", r));
  base = "http://127.0.0.1:" + server.address().port;
  const login = await call("/auth/setup", {
    method: "POST",
    body: {
      setupToken: "hub-test-setup",
      name: "Hub Admin",
      email: "hub@example.com",
      password: "hub-test-password",
    },
  });
  cookie = login.cookie;
  ownerId = login.data.user.id;
  await db.transaction(seed);
  records = (await call("/bootstrap")).data.records;
});
after(async () => {
  await new Promise((r) => server.close(r));
  await db.close();
  if (pool) {
    await pool.query('DROP SCHEMA "' + schema + '" CASCADE');
    await pool.end();
  }
  rmSync(dir, { recursive: true, force: true });
});
test("700 new workflow entries are explicit and unique", () => {
  assert.equal(recordHubFeatureCatalog.length, 700);
  assert.equal(new Set(recordHubFeatureCatalog.map((f) => f.id)).size, 700);
  for (const m of modules)
    assert.equal(
      recordHubFeatureCatalog.filter((f) => f.module === m.id).length,
      35,
    );
});
for (const m of modules)
  test(
    m.label +
      ": record workspace tags, follow-ups, reviews, checklists, links, following, pins and completeness",
    async () => {
      const r = records.find((r) => r.module === m.id),
        target =
          records.find((t) => t.id !== r.id && t.module === "tasks") ||
          records.find((t) => t.id !== r.id);
      const base = `/record-hub/${m.id}/${r.id}`;
      let hub = (await call(base)).data;
      assert.equal(hub.version, 0);
      const change = async (operation, fields = {}) => {
        const result = await call(base, {
          method: "POST",
          body: { operation, version: hub.version, ...fields },
        });
        assert.equal(result.status, 200, JSON.stringify(result.data));
        hub = (await call(base)).data;
      };
      await change("addTag", { tag: "Priority" });
      assert.deepEqual(hub.data.tags, ["priority"]);
      let index = (await call("/module-hub/" + m.id)).data;
      assert.ok(
        index.records.some((x) => x.id === r.id && x.tags.includes("priority")),
      );
      await call("/module-hub/" + m.id + "/rename-tag", {
        method: "POST",
        body: { from: "priority", to: "review" },
      });
      hub = (await call(base)).data;
      assert.deepEqual(hub.data.tags, ["review"]);
      await change("removeTag", { tag: "review" });
      assert.deepEqual(hub.data.tags, []);
      await change("followUpDate", { date: "2000-01-01" });
      assert.equal(hub.health.overdue, true);
      await change("followUpPriority", { priority: "High" });
      await change("assignFollowUp", { assigneeId: ownerId });
      assert.equal(hub.data.followUp.assigneeId, ownerId);
      await change("clearFollowUp");
      assert.equal(hub.health.overdue, false);
      await change("requestReview");
      assert.equal(hub.data.review.status, "Pending");
      await change("reviewReason", { reason: "Reviewed internal details" });
      await change("approveReview");
      assert.equal(hub.data.review.status, "Approved");
      await change("requestChanges", { reason: "Please verify the details" });
      assert.equal(hub.data.review.status, "Changes requested");
      await change("addChecklist", { text: "Verify record details" });
      let item = hub.data.checklist[0];
      await change("editChecklist", {
        itemId: item.id,
        text: "Verify all details",
      });
      assert.equal(hub.data.checklist[0].text, "Verify all details");
      await change("completeChecklist", { itemId: item.id, done: true });
      assert.equal(hub.health.checklistDone, 1);
      await change("removeChecklist", { itemId: item.id });
      assert.equal(hub.health.checklistTotal, 0);
      await change("addLink", { targetId: target.id });
      assert.equal(hub.related[0].id, target.id);
      const inbound = (await call(`/record-hub/${target.module}/${target.id}`))
        .data.inbound;
      assert.ok(inbound.some((x) => x.id === r.id));
      await change("removeLink", { targetId: target.id });
      assert.equal(hub.related.length, 0);
      assert.equal(
        (await call(base + "/follow", { method: "POST", body: {} })).status,
        200,
      );
      hub = (await call(base)).data;
      assert.equal(hub.following, true);
      await change("pin");
      assert.equal(hub.data.pinned, true);
      index = (await call("/module-hub/" + m.id)).data;
      assert.ok(index.followed.includes(r.id));
      assert.ok(index.records.find((x) => x.id === r.id).pinned);
      const updates = (await call("/hub/updates")).data.updates;
      assert.ok(updates.some((x) => x.id === r.id));
      assert.equal(
        (
          await call("/hub/updates/read", {
            method: "POST",
            body: { ids: [r.id] },
          })
        ).status,
        200,
      );
      assert.ok(
        !(await call("/hub/updates")).data.updates.some((x) => x.id === r.id),
      );
      await change("unpin");
      assert.equal(hub.data.pinned, false);
      assert.equal(
        (await call(base + "/follow", { method: "DELETE", body: {} })).status,
        200,
      );
      hub = (await call(base)).data;
      assert.equal(hub.following, false);
      assert.equal(typeof hub.health.complete, "boolean");
    },
  );
test("workspace optimistic locking and malformed actions are rejected", async () => {
  const r = records.find((r) => r.module === "tasks"),
    base = `/record-hub/tasks/${r.id}`;
  const h = (await call(base)).data;
  assert.equal(
    (
      await call(base, {
        method: "POST",
        body: { operation: "pin", version: h.version - 1 },
      })
    ).status,
    409,
  );
  for (const patch of [
    { operation: "followUpDate", date: "2026-02-30" },
    { operation: "followUpPriority", priority: "Bad" },
    { operation: "assignFollowUp", assigneeId: "missing" },
    { operation: "addLink", targetId: r.id },
    { operation: "addLink", targetId: {} },
    { operation: "addChecklist", text: "" },
    { operation: "unknown" },
  ])
    assert.equal(
      (
        await call(base, {
          method: "POST",
          body: { version: h.version, ...patch },
        })
      ).status,
      400,
    );
});
test("viewer access is read-only and tenant/agent hub access is denied", async () => {
  const tenant = records.find((r) => r.module === "tenants"),
    property = records.find((r) => r.module === "properties");
  for (const [role, profile] of [
    ["viewer", {}],
    ["tenant", { tenantId: tenant.id }],
    ["agent", { propertyIds: [property.id] }],
  ]) {
    assert.equal(
      (
        await call("/users", {
          method: "POST",
          body: {
            name: role,
            email: role + "@hub.example",
            password: "hub-member-password",
            role,
            profile,
          },
        })
      ).status,
      201,
    );
    const session = (
      await call("/auth/login", {
        method: "POST",
        session: null,
        body: { email: role + "@hub.example", password: "hub-member-password" },
      })
    ).cookie;
    const r = records.find((r) => r.module === "tasks"),
      path = `/record-hub/tasks/${r.id}`;
    const h = await call(path, { session });
    assert.equal(h.status, role === "viewer" ? 200 : 403);
    assert.equal(
      (
        await call(path, {
          method: "POST",
          session,
          body: { operation: "pin", version: 0 },
        })
      ).status,
      403,
    );
    if (role === "viewer") {
      assert.equal(
        (await call(path + "/follow", { method: "POST", session, body: {} }))
          .status,
        200,
      );
      assert.equal((await call("/hub/updates", { session })).status, 200);
    } else assert.equal((await call("/hub/updates", { session })).status, 403);
  }
});
