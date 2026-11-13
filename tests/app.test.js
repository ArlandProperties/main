import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../server/db.js";
import { createApp } from "../server/app.js";
import { modules, featureCatalog } from "../shared/modules.js";
let db, server, url, cookie, dir;
async function call(
  path,
  { method = "GET", body, session = cookie, header = true, origin } = {},
) {
  const h = {};
  if (header) h["X-Arcland-Request"] = "1";
  if (session) h.cookie = session;
  if (origin) h.origin = origin;
  if (body) h["content-type"] = "application/json";
  const r = await fetch(url + "/api" + path, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
before(async () => {
  dir = mkdtempSync(join(tmpdir(), "arcland-tests-"));
  db = await openDatabase({
    url: process.env.TEST_DATABASE_URL,
    file: join(dir, "data.sqlite"),
  });
  server = createApp(db, { setupToken: "test-setup-token" }).listen(
    0,
    "127.0.0.1",
  );
  await new Promise((r) => server.once("listening", r));
  url = "http://127.0.0.1:" + server.address().port;
});
after(async () => {
  await new Promise((r) => server.close(r));
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});
test("health, private records, setup security, owner setup and session", async () => {
  assert.equal((await call("/health")).status, 200);
  assert.equal((await call("/bootstrap")).status, 401);
  assert.equal(
    (
      await call("/auth/setup", {
        method: "POST",
        body: { setupToken: "wrong" },
      })
    ).status,
    403,
  );
  const result = await call("/auth/setup", {
    method: "POST",
    body: {
      setupToken: "test-setup-token",
      name: "Owner",
      email: "owner@example.com",
      password: "long-owner-password",
    },
  });
  assert.equal(result.status, 201);
  cookie = result.cookie;
  assert.ok(cookie);
  assert.equal(
    (
      await call("/auth/setup", {
        method: "POST",
        body: {
          setupToken: "test-setup-token",
          name: "X",
          email: "x@example.com",
          password: "long-owner-password",
        },
      })
    ).status,
    409,
  );
  assert.equal((await call("/bootstrap")).status, 200);
});
test("CSRF controls and validation reject malformed operations", async () => {
  assert.equal(
    (
      await call("/records/properties", {
        method: "POST",
        header: false,
        body: {},
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call("/records/properties", {
        method: "POST",
        origin: "https://evil.example",
        body: {},
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call("/records/properties", {
        method: "POST",
        body: { data: { name: "bad" } },
      })
    ).status,
    400,
  );
  assert.equal(
    (await call("/records/not-real", { method: "POST", body: { data: {} } }))
      .status,
    404,
  );
});
test("optional sample data populates all 20 modules and is only allowed once", async () => {
  assert.equal(
    (
      await call("/demo", {
        method: "POST",
        body: { confirm: "LOAD SAMPLE DATA" },
      })
    ).status,
    200,
  );
  const { data } = await call("/bootstrap");
  for (const m of modules)
    assert.ok(
      data.records.some((r) => r.module === m.id),
      m.id,
    );
  assert.equal(featureCatalog.length, 200);
  assert.equal(new Set(featureCatalog.map((f) => f.id)).size, 200);
  assert.equal(
    (
      await call("/demo", {
        method: "POST",
        body: { confirm: "LOAD SAMPLE DATA" },
      })
    ).status,
    409,
  );
});
for (const m of modules)
  test(`${m.label}: create, read, edit, archive, restore and domain action`, async () => {
    let { data: bootstrap } = await call("/bootstrap");
    const sample = bootstrap.records.find((r) => r.module === m.id);
    const data = {};
    for (const f of m.fields) data[f.key] = sample[f.key] ?? "";
    data.name = `Test ${m.singular}`;
    if (m.id === "payments") {
      const inv = bootstrap.records.find(
        (r) => r.module === "invoices" && r.status === "Issued",
      );
      data.invoiceId = inv.id;
      data.amount = 1;
    }
    if (m.id === "leases") {
      const unit = bootstrap.records.find(
        (r) => r.module === "units" && r.status === "Vacant",
      );
      data.unitId = unit.id;
    }
    let r = await call("/records/" + m.id, {
      method: "POST",
      body: { data, status: m.id === "keys" ? "Checked out" : m.statuses[0] },
    });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    let record = r.data;
    const changed = { ...data, notes: "Updated with test" };
    r = await call(`/records/${m.id}/${record.id}`, {
      method: "PATCH",
      body: { version: record.version, data: changed, status: record.status },
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    record = r.data;
    r = await call(`/records/${m.id}/${record.id}/archive`, {
      method: "POST",
      body: { version: record.version },
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.ok(r.data.archived);
    record = r.data;
    r = await call(`/records/${m.id}/${record.id}/restore`, {
      method: "POST",
      body: { version: record.version },
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.archived, false);
    record = r.data;
    r = await call(`/records/${m.id}/${record.id}/action`, {
      method: "POST",
      body: { version: record.version },
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.status, m.action.to);
    const latest = (await call("/bootstrap")).data.records.find(
      (x) => x.id === record.id,
    );
    assert.equal(latest.status, m.action.to);
    assert.equal(latest.notes, "Updated with test");
  });
test("optimistic concurrency prevents stale overwrites", async () => {
  const r = (await call("/bootstrap")).data.records.find(
    (r) => r.module === "tasks",
  );
  const first = await call(`/records/tasks/${r.id}`, {
    method: "PATCH",
    body: { data: r, status: r.status, version: r.version },
  });
  assert.equal(first.status, 200);
  const stale = await call(`/records/tasks/${r.id}`, {
    method: "PATCH",
    body: { data: r, status: r.status, version: r.version },
  });
  assert.equal(stale.status, 409);
});
test("linked records, dates and unsafe URLs are validated", async () => {
  const s = (await call("/bootstrap")).data;
  const prop = s.records.find(
    (r) => r.module === "properties" && r.name === "The Willow Residences",
  );
  assert.equal(
    (
      await call(`/records/properties/${prop.id}/archive`, {
        method: "POST",
        body: { version: prop.version },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/records/units", {
        method: "POST",
        body: { data: { name: "Invalid", propertyId: "missing", rent: 10 } },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/records/documents", {
        method: "POST",
        body: { data: { name: "Bad URL", url: "javascript:alert(1)" } },
      })
    ).status,
    400,
  );
  const lease = s.records.find((r) => r.module === "leases");
  assert.equal(
    (
      await call("/records/leases", {
        method: "POST",
        body: {
          data: { ...lease, startDate: "2027-12-01", endDate: "2027-01-01" },
        },
      })
    ).status,
    400,
  );
});
test("payment posting updates invoices and refuses overpayment and posted edits", async () => {
  const s = (await call("/bootstrap")).data;
  const inv = s.records.find(
    (r) => r.module === "invoices" && r.status === "Issued",
  );
  const paid = s.records
    .filter(
      (r) =>
        r.module === "payments" &&
        r.status === "Posted" &&
        r.invoiceId === inv.id,
    )
    .reduce((s, p) => s + p.amount, 0);
  let p = await call("/records/payments", {
    method: "POST",
    body: {
      data: {
        name: "Settlement",
        invoiceId: inv.id,
        amount: inv.amount - paid,
        paymentDate: "2026-11-13",
        method: "Bank transfer",
      },
    },
  });
  assert.equal(p.status, 201);
  p = await call(`/records/payments/${p.data.id}/action`, {
    method: "POST",
    body: { version: p.data.version },
  });
  assert.equal(p.status, 200);
  assert.equal(
    (await call("/bootstrap")).data.records.find((r) => r.id === inv.id).status,
    "Paid",
  );
  assert.equal(
    (
      await call("/records/payments", {
        method: "POST",
        body: {
          status: "Posted",
          data: {
            name: "Overpayment",
            invoiceId: inv.id,
            amount: 1,
            paymentDate: "2026-11-13",
          },
        },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call(`/records/payments/${p.data.id}`, {
        method: "PATCH",
        body: { data: p.data, status: "Reversed", version: p.data.version },
      })
    ).status,
    400,
  );
});
test("lease activation reserves units and rejects second active leases", async () => {
  const s = (await call("/bootstrap")).data;
  const active = s.records.find(
    (r) => r.module === "leases" && r.status === "Active",
  );
  assert.equal(
    s.records.find((r) => r.id === active.unitId).status,
    "Occupied",
  );
  assert.equal(
    (
      await call("/records/leases", {
        method: "POST",
        body: {
          status: "Active",
          data: { ...active, name: "Conflicting lease" },
        },
      })
    ).status,
    409,
  );
});
test("viewer permissions enforced on server, disable revokes sessions", async () => {
  assert.equal(
    (
      await call("/users", {
        method: "POST",
        body: {
          name: "Reader",
          email: "reader@example.com",
          password: "reader-password-123",
          role: "viewer",
        },
      })
    ).status,
    201,
  );
  const reader = await call("/auth/login", {
    method: "POST",
    session: null,
    body: { email: "reader@example.com", password: "reader-password-123" },
  });
  assert.equal(reader.status, 200);
  assert.equal(
    (await call("/bootstrap", { session: reader.cookie })).status,
    200,
  );
  assert.equal(
    (
      await call("/records/tasks", {
        method: "POST",
        session: reader.cookie,
        body: { data: { name: "Denied" } },
      })
    ).status,
    403,
  );
  assert.equal((await call("/backup", { session: reader.cookie })).status, 403);
  assert.equal((await call("/users", { session: reader.cookie })).status, 403);
  const users = (await call("/users")).data.users;
  const u = users.find((u) => u.email === "reader@example.com");
  assert.equal(
    (
      await call("/users/" + u.id, {
        method: "PATCH",
        body: { role: "viewer", disabled: true },
      })
    ).status,
    200,
  );
  assert.equal(
    (await call("/bootstrap", { session: reader.cookie })).status,
    401,
  );
});
test("audit and backups omit secrets; database survives reopening", async () => {
  const backup = await call("/backup");
  assert.equal(backup.status, 200);
  assert.ok(backup.data.records.length > 20);
  assert.ok(backup.data.audit.length > 20);
  assert.equal(JSON.stringify(backup.data).includes("password_hash"), false);
  const other = await openDatabase({
    url: process.env.TEST_DATABASE_URL,
    file: join(dir, "data.sqlite"),
  });
  const [r] = await other.query("SELECT COUNT(*) AS count FROM records");
  assert.ok(Number(r.count) > 20);
  await other.close();
});
test("payment reversals preserve audit and recalculate the invoice", async () => {
  const s = (await call("/bootstrap")).data;
  const p = s.records.find(
    (r) => r.module === "payments" && r.status === "Posted",
  );
  assert.equal(
    (
      await call("/payments/" + p.id + "/reverse", {
        method: "POST",
        body: {
          version: p.version,
          reason: "External transfer returned by bank",
        },
      })
    ).status,
    200,
  );
  const updated = (await call("/bootstrap")).data;
  assert.equal(updated.records.find((r) => r.id === p.id).status, "Reversed");
  assert.equal(
    updated.records.find((r) => r.id === p.invoiceId).status,
    "Issued",
  );
  assert.ok(
    (await call("/audit")).data.events.some(
      (e) => e.action === "Reversed payment",
    ),
  );
});
test("invoice state and amounts cannot fabricate receipts", async () => {
  const s = (await call("/bootstrap")).data;
  const inv = s.records.find((r) => r.module === "invoices");
  assert.equal(
    (
      await call("/records/invoices", {
        method: "POST",
        body: { data: { ...inv, name: "Fake paid" }, status: "Paid" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/records/payments", {
        method: "POST",
        body: {
          data: {
            name: "Zero",
            invoiceId: inv.id,
            amount: 0,
            paymentDate: "2026-11-13",
          },
        },
      })
    ).status,
    400,
  );
});
test("administrators can reset team passwords and duplicate emails conflict", async () => {
  const users = (await call("/users")).data.users;
  const u = users.find((u) => u.email === "reader@example.com");
  assert.equal(
    (
      await call("/users/" + u.id + "/reset-password", {
        method: "POST",
        body: { password: "new-reader-password-123" },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call("/users", {
        method: "POST",
        body: {
          name: "Duplicate",
          email: "reader@example.com",
          password: "new-reader-password-123",
          role: "viewer",
        },
      })
    ).status,
    409,
  );
});
test("password rotation invalidates older sessions; logout ends current session", async () => {
  const login = await call("/auth/login", {
    method: "POST",
    body: { email: "owner@example.com", password: "long-owner-password" },
  });
  assert.equal(login.status, 200);
  const rotated = await call("/auth/password", {
    method: "POST",
    body: {
      currentPassword: "long-owner-password",
      password: "new-long-owner-password",
    },
  });
  assert.equal(rotated.status, 200);
  assert.equal(
    (await call("/bootstrap", { session: login.cookie })).status,
    401,
  );
  assert.equal(
    (
      await call("/auth/logout", {
        method: "POST",
        session: rotated.cookie,
        body: {},
      })
    ).status,
    200,
  );
  assert.equal(
    (await call("/bootstrap", { session: rotated.cookie })).status,
    401,
  );
});
