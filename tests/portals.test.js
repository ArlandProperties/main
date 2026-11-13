import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDatabase } from "../server/db.js";
import { createApp } from "../server/app.js";
import { seed } from "../server/seed.js";
import pg from "pg";
import { randomUUID } from "node:crypto";
let pgAdmin, pgSchema;
let db,
  server,
  base,
  dir,
  adminCookie,
  tenantCookie,
  peerCookie,
  agentCookie,
  tenantId,
  peerId,
  propertyId,
  otherProperty,
  requestId;
async function call(path, { method = "GET", body, cookie = adminCookie } = {}) {
  const r = await fetch(base + "/api" + path, {
    method,
    headers: {
      "X-Arcland-Request": "1",
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
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
  dir = mkdtempSync(join(tmpdir(), "arcland-portals-"));
  let url;
  if (process.env.TEST_DATABASE_URL) {
    pgAdmin = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
    pgSchema = "portal_" + randomUUID().replaceAll("-", "");
    await pgAdmin.query('CREATE SCHEMA "' + pgSchema + '"');
    const parsed = new URL(process.env.TEST_DATABASE_URL);
    parsed.searchParams.set("options", "-c search_path=" + pgSchema);
    url = parsed.toString();
  }
  db = await openDatabase({ url, file: join(dir, "test.sqlite") });
  server = createApp(db, { setupToken: "portal-tests-setup" }).listen(
    0,
    "127.0.0.1",
  );
  await new Promise((r) => server.once("listening", r));
  base = "http://127.0.0.1:" + server.address().port;
  const r = await call("/auth/setup", {
    method: "POST",
    body: {
      setupToken: "portal-tests-setup",
      name: "Admin",
      email: "portal-admin@example.com",
      password: "portal-admin-password",
    },
  });
  adminCookie = r.cookie;
  await db.transaction(seed);
  const rows = (await call("/bootstrap")).data.records;
  tenantId = rows.find(
    (r) => r.module === "tenants" && r.name === "Olivia Bennett",
  ).id;
  peerId = rows.find(
    (r) => r.module === "tenants" && r.name === "James Wilson",
  ).id;
  propertyId = rows.find(
    (r) => r.module === "properties" && r.name === "The Willow Residences",
  ).id;
  otherProperty = rows.find(
    (r) => r.module === "properties" && r.name === "Parkside Apartments",
  ).id;
  for (const [email, role, profile] of [
    ["resident@example.com", "tenant", { tenantId }],
    ["peer@example.com", "tenant", { tenantId: peerId }],
    ["agent@example.com", "agent", { propertyIds: [propertyId] }],
  ]) {
    assert.equal(
      (
        await call("/users", {
          method: "POST",
          body: {
            name: role,
            email,
            password: "portal-member-password",
            role,
            profile,
          },
        })
      ).status,
      201,
    );
    const login = await call("/auth/login", {
      method: "POST",
      cookie: null,
      body: { email, password: "portal-member-password" },
    });
    assert.equal(login.status, 200);
    if (email.startsWith("resident")) tenantCookie = login.cookie;
    else if (email.startsWith("peer")) peerCookie = login.cookie;
    else agentCookie = login.cookie;
  }
});
after(async () => {
  await new Promise((r) => server.close(r));
  await db.close();
  if (pgAdmin) {
    await pgAdmin.query('DROP SCHEMA "' + pgSchema + '" CASCADE');
    await pgAdmin.end();
  }
  rmSync(dir, { recursive: true, force: true });
});
test("one authentication endpoint returns each stored role, users cannot choose privilege", async () => {
  const r = await call("/auth/login", {
    method: "POST",
    cookie: null,
    body: {
      email: "resident@example.com",
      password: "portal-member-password",
      role: "admin",
    },
  });
  assert.equal(r.data.user.role, "tenant");
  assert.equal((await call("/users", { cookie: tenantCookie })).status, 403);
  assert.equal((await call("/users", { cookie: agentCookie })).status, 403);
});
test("tenant bootstrap only includes own records and removes private notes", async () => {
  const r = await call("/bootstrap", { cookie: tenantCookie });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.role, "tenant");
  assert.equal(r.data.records.filter((r) => r.module === "tenants").length, 1);
  assert.equal(r.data.records.find((r) => r.module === "tenants").id, tenantId);
  assert.ok(!r.data.records.some((r) => r.tenantId === peerId));
  assert.ok(
    !r.data.records.some((r) =>
      [
        "owners",
        "expenses",
        "budgets",
        "insurance",
        "keys",
        "vendors",
      ].includes(r.module),
    ),
  );
  assert.ok(r.data.records.every((r) => !Object.hasOwn(r, "notes")));
  assert.ok(!JSON.stringify(r.data.records).includes("Sophia Chen"));
});
test("tenant generic mutations, staff audit and backups are denied", async () => {
  for (const path of ["/backup", "/audit"])
    assert.equal((await call(path, { cookie: tenantCookie })).status, 403);
  assert.equal(
    (
      await call("/records/tasks", {
        cookie: tenantCookie,
        method: "POST",
        body: { data: { name: "Forbidden" } },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call("/settings", {
        cookie: tenantCookie,
        method: "PUT",
        body: { company: "Hijack" },
      })
    ).status,
    403,
  );
});
test("tenant requests derive ownership and unit on server, peer cannot see or cancel them", async () => {
  const r = await call("/tenant/requests", {
    method: "POST",
    cookie: tenantCookie,
    body: {
      title: "Tenant owned request",
      description: "Water dripping below the kitchen sink.",
      priority: "High",
      requesterTenantId: peerId,
      propertyId: otherProperty,
    },
  });
  assert.equal(r.status, 201);
  requestId = r.data.id;
  let own = (
    await call("/bootstrap", { cookie: tenantCookie })
  ).data.records.find((r) => r.id === requestId);
  assert.ok(own);
  assert.equal(own.propertyId, propertyId);
  assert.equal(
    own.residentDescription,
    "Water dripping below the kitchen sink.",
  );
  assert.ok(
    !(await call("/bootstrap", { cookie: peerCookie })).data.records.some(
      (r) => r.id === requestId,
    ),
  );
  assert.equal(
    (
      await call("/tenant/requests/" + requestId + "/cancel", {
        method: "POST",
        cookie: peerCookie,
        body: { version: own.version },
      })
    ).status,
    404,
  );
});
test("staff edits preserve tenant ownership and hide internal notes", async () => {
  let r = (await call("/bootstrap")).data.records.find(
    (r) => r.id === requestId,
  );
  const changed = { ...r, notes: "PRIVATE STAFF NOTES" };
  const edit = await call("/records/maintenance/" + r.id, {
    method: "PATCH",
    body: { data: changed, status: "In progress", version: r.version },
  });
  assert.equal(edit.status, 200);
  const own = (
    await call("/bootstrap", { cookie: tenantCookie })
  ).data.records.find((r) => r.id === requestId);
  assert.equal(own.status, "In progress");
  assert.equal(
    own.residentDescription,
    "Water dripping below the kitchen sink.",
  );
  assert.ok(!JSON.stringify(own).includes("PRIVATE STAFF NOTES"));
  assert.equal(
    (
      await call("/tenant/requests/" + requestId + "/cancel", {
        method: "POST",
        cookie: tenantCookie,
        body: { version: own.version },
      })
    ).status,
    409,
  );
});
test("agents only see assigned properties and cannot move records into another scope", async () => {
  const r = await call("/bootstrap", { cookie: agentCookie });
  assert.equal(
    r.data.records.filter((r) => r.module === "properties").length,
    1,
  );
  assert.equal(
    r.data.records.find((r) => r.module === "properties").id,
    propertyId,
  );
  assert.ok(!r.data.records.some((r) => r.propertyId === otherProperty));
  assert.ok(
    !r.data.records.some((r) =>
      ["invoices", "payments", "owners", "insurance"].includes(r.module),
    ),
  );
  assert.equal(
    (
      await call("/records/tasks", {
        method: "POST",
        cookie: agentCookie,
        body: { data: { name: "Outside scope", propertyId: otherProperty } },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call("/records/expenses", {
        method: "POST",
        cookie: agentCookie,
        body: {
          data: {
            name: "Forbidden expense",
            amount: 100,
            expenseDate: "2026-11-13",
            propertyId,
          },
        },
      })
    ).status,
    403,
  );
  const task = await call("/records/tasks", {
    method: "POST",
    cookie: agentCookie,
    body: { data: { name: "Assigned task", propertyId } },
  });
  assert.equal(task.status, 201);
  assert.equal(
    (
      await call("/records/tasks/" + task.data.id, {
        method: "PATCH",
        cookie: agentCookie,
        body: {
          data: { ...task.data, propertyId: otherProperty },
          status: "To do",
          version: task.data.version,
        },
      })
    ).status,
    403,
  );
  assert.ok(
    (await call("/audit", { cookie: agentCookie })).data.events.every(
      (e) => e.actor_name === "agent",
    ),
  );
});
test("tenant sharing is explicit: reviewed documents and delivered notices only", async () => {
  for (const [name, status, tid] of [
    ["Own delivered", "Delivered", tenantId],
    ["Peer delivered", "Delivered", peerId],
    ["Own draft", "Draft", tenantId],
  ]) {
    assert.equal(
      (
        await call("/records/notices", {
          method: "POST",
          body: { data: { name, tenantId: tid, body: "Notice body" }, status },
        })
      ).status,
      201,
    );
  }
  for (const [name, status, tid] of [
    ["Own shared document", "Reviewed", tenantId],
    ["Private draft document", "Draft", tenantId],
    ["Peer document", "Reviewed", peerId],
  ]) {
    assert.equal(
      (
        await call("/records/documents", {
          method: "POST",
          body: {
            data: { name, url: "https://example.com/secure", tenantId: tid },
            status,
          },
        })
      ).status,
      201,
    );
  }
  const records = (await call("/bootstrap", { cookie: tenantCookie })).data
    .records;
  assert.ok(records.some((r) => r.name === "Own delivered"));
  assert.ok(records.some((r) => r.name === "Own shared document"));
  for (const name of [
    "Peer delivered",
    "Own draft",
    "Private draft document",
    "Peer document",
  ])
    assert.ok(!records.some((r) => r.name === name), name);
});
test("tenant assignment must exist and one resident cannot be assigned twice", async () => {
  const base = {
    name: "Test",
    password: "portal-member-password",
    role: "tenant",
  };
  assert.equal(
    (
      await call("/users", {
        method: "POST",
        body: {
          ...base,
          email: "invalid@example.com",
          profile: { tenantId: "missing" },
        },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/users", {
        method: "POST",
        body: {
          ...base,
          email: "duplicate@example.com",
          profile: { tenantId },
        },
      })
    ).status,
    409,
  );
});

test("unassigned agents see no records and cannot adopt records from other properties", async () => {
  const account = await call("/users", {
    method: "POST",
    body: {
      name: "Unassigned agent",
      email: "empty-agent@example.com",
      password: "portal-member-password",
      role: "agent",
      profile: { propertyIds: [] },
    },
  });
  assert.equal(account.status, 201);
  const login = await call("/auth/login", {
    method: "POST",
    cookie: null,
    body: {
      email: "empty-agent@example.com",
      password: "portal-member-password",
    },
  });
  assert.deepEqual(
    (await call("/bootstrap", { cookie: login.cookie })).data.records,
    [],
  );
  const task = await call("/records/tasks", {
    method: "POST",
    body: { data: { name: "Other property task", propertyId: otherProperty } },
  });
  assert.equal(task.status, 201);
  const steal = await call("/records/tasks/" + task.data.id, {
    method: "PATCH",
    cookie: agentCookie,
    body: {
      data: { ...task.data, propertyId },
      status: "To do",
      version: task.data.version,
    },
  });
  assert.equal(steal.status, 403);
});
