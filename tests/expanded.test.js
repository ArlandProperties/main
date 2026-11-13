import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { openDatabase } from "../server/db.js";
import { createApp } from "../server/app.js";
import { seed } from "../server/seed.js";
import { modules, expandedFeatureCatalog } from "../shared/modules.js";
let dir, db, server, base, cookie, pool, schema, publicUnitId, privateUnitId;
async function call(path, { method = "GET", body, session = cookie } = {}) {
  const r = await fetch(base + "/api" + path, {
    method,
    headers: {
      "content-type": "application/json",
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
  dir = mkdtempSync(join(tmpdir(), "arcland-expanded-"));
  let url;
  if (process.env.TEST_DATABASE_URL) {
    pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
    schema = "expanded_" + randomUUID().replaceAll("-", "");
    await pool.query('CREATE SCHEMA "' + schema + '"');
    const u = new URL(process.env.TEST_DATABASE_URL);
    u.searchParams.set("options", "-c search_path=" + schema);
    url = u.toString();
  }
  db = await openDatabase({ url, file: join(dir, "test.sqlite") });
  server = createApp(db, { setupToken: "expanded-test-token" }).listen(
    0,
    "127.0.0.1",
  );
  await new Promise((r) => server.once("listening", r));
  base = "http://127.0.0.1:" + server.address().port;
  cookie = (
    await call("/auth/setup", {
      method: "POST",
      body: {
        name: "Admin",
        email: "expanded@example.com",
        password: "expanded-test-password",
        setupToken: "expanded-test-token",
      },
    })
  ).cookie;
  await db.transaction(seed);
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
test("catalog has exactly 300 additional module capabilities", () => {
  assert.equal(expandedFeatureCatalog.length, 300);
  assert.equal(new Set(expandedFeatureCatalog.map((f) => f.id)).size, 300);
  for (const m of modules)
    assert.equal(
      expandedFeatureCatalog.filter((f) => f.module === m.id).length,
      15,
    );
});
for (const m of modules)
  test(
    m.label +
      ": durable preferences, bookmarks, views, comments, history and bulk workflows",
    async () => {
      let records = (await call("/bootstrap")).data.records;
      const sample = records.find((r) => r.module === m.id);
      const data = Object.fromEntries(
        m.fields.map((f) => [f.key, sample[f.key] ?? ""]),
      );
      data.name = "Expanded " + m.singular;
      if (m.id === "payments")
        data.invoiceId = records.find(
          (r) => r.module === "invoices" && r.status === "Issued",
        ).id;
      const created = await call("/records/" + m.id, {
        method: "POST",
        body: { data },
      });
      assert.equal(created.status, 201, JSON.stringify(created.data));
      let r = created.data;
      const prefs = {
        density: "compact",
        pageSize: 24,
        columns: ["name"],
        bookmarks: [r.id],
        views: [
          {
            name: "My view",
            view: {
              field: "name",
              match: "Expanded",
              from: "2020-01-01",
              to: "2100-01-01",
              numeric: "version",
              min: "1",
              max: "100",
              bookmarksOnly: true,
            },
          },
        ],
      };
      assert.equal(
        (await call("/preferences/" + m.id, { method: "PUT", body: prefs }))
          .status,
        200,
      );
      assert.deepEqual((await call("/preferences/" + m.id)).data, prefs);
      assert.equal(
        (
          await call(`/record-tools/${m.id}/${r.id}/comments`, {
            method: "POST",
            body: { body: "Internal record discussion" },
          })
        ).status,
        201,
      );
      const tools = (await call(`/record-tools/${m.id}/${r.id}`)).data;
      assert.equal(tools.comments[0].body, "Internal record discussion");
      assert.ok(tools.history.length >= 2);
      for (const op of ["archive", "restore", "status"]) {
        const result = await call("/bulk/" + m.id, {
          method: "POST",
          body: {
            operation: op,
            status: m.statuses[0],
            items: [{ id: r.id, version: r.version }],
          },
        });
        assert.equal(result.status, 200, JSON.stringify(result.data));
        r = (await call("/bootstrap")).data.records.find((x) => x.id === r.id);
        assert.equal(r.archived, op === "archive");
      }
    },
  );
test("bulk edits are atomic and stale items do not partially apply", async () => {
  const a = (
      await call("/records/tasks", {
        method: "POST",
        body: { data: { name: "Atomic A" } },
      })
    ).data,
    b = (
      await call("/records/tasks", {
        method: "POST",
        body: { data: { name: "Atomic B" } },
      })
    ).data;
  const result = await call("/bulk/tasks", {
    method: "POST",
    body: {
      operation: "archive",
      items: [
        { id: a.id, version: a.version },
        { id: b.id, version: 0 },
      ],
    },
  });
  assert.equal(result.status, 409);
  const rows = (await call("/bootstrap")).data.records;
  assert.equal(rows.find((r) => r.id === a.id).version, a.version);
  assert.equal(rows.find((r) => r.id === a.id).archived, false);
  assert.equal(
    (
      await call("/bulk/tasks", {
        method: "POST",
        body: { operation: "archive", items: [null] },
      })
    ).status,
    400,
  );
});
test("private modules and comments cannot be accessed anonymously; preferences are per-user", async () => {
  assert.equal(
    (await call("/preferences/tasks", { session: null })).status,
    401,
  );
  assert.equal(
    (
      await call("/preferences/tasks", {
        method: "PUT",
        body: { density: "broken" },
      })
    ).status,
    400,
  );
  await call("/users", {
    method: "POST",
    body: {
      name: "Viewer",
      email: "expanded-viewer@example.com",
      password: "expanded-viewer-password",
      role: "viewer",
    },
  });
  const viewer = (
    await call("/auth/login", {
      method: "POST",
      session: null,
      body: {
        email: "expanded-viewer@example.com",
        password: "expanded-viewer-password",
      },
    })
  ).cookie;
  assert.deepEqual(
    (await call("/preferences/tasks", { session: viewer })).data,
    {},
  );
  const task = (await call("/bootstrap")).data.records.find(
    (r) => r.module === "tasks",
  );
  assert.equal(
    (
      await call("/bulk/tasks", {
        method: "POST",
        session: viewer,
        body: {
          operation: "archive",
          items: [{ id: task.id, version: task.version }],
        },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call(`/record-tools/tasks/${task.id}/comments`, {
        method: "POST",
        session: viewer,
        body: { body: "Not allowed" },
      })
    ).status,
    403,
  );
});
test("only explicitly published vacant units appear in public rental search", async () => {
  const rows = (await call("/bootstrap")).data.records;
  const unit = rows.find((r) => r.module === "units" && r.status === "Vacant");
  privateUnitId = rows.find((r) => r.module === "units" && r.id !== unit.id).id;
  assert.deepEqual(
    (await call("/public/rentals", { session: null })).data.rentals,
    [],
  );
  const edited = await call("/records/units/" + unit.id, {
    method: "PATCH",
    body: {
      data: { ...unit, listing: "Public" },
      status: "Vacant",
      version: unit.version,
    },
  });
  assert.equal(edited.status, 200);
  publicUnitId = unit.id;
  const rental = (await call("/public/rentals", { session: null })).data
    .rentals;
  assert.equal(rental.length, 1);
  assert.equal(rental[0].id, unit.id);
  assert.ok(!JSON.stringify(rental).includes("ownerId"));
  assert.ok(!JSON.stringify(rental).includes("notes"));
});
const prospect = () => ({
  name: "Prospective Resident",
  email: "prospect@example.com",
  phone: "4165550123",
  desiredMoveIn: new Date(Date.now() + 30 * 86400000)
    .toISOString()
    .slice(0, 10),
  householdSize: 2,
  contactMethod: "Email",
  message: "Looking for a new home.",
  consent: true,
  website: "",
});
test("public applications validate consent, date, honeypot and published unit", async () => {
  for (const patch of [
    { consent: false },
    { website: "bot" },
    { desiredMoveIn: "2000-01-01" },
    { email: "invalid" },
  ])
    assert.equal(
      (
        await call("/public/applications", {
          method: "POST",
          session: null,
          body: { ...prospect(), ...patch },
        })
      ).status,
      400,
    );
  assert.equal(
    (
      await call("/public/applications", {
        method: "POST",
        session: null,
        body: { ...prospect(), unitId: privateUnitId },
      })
    ).status,
    409,
  );
});
test("public applications enter staff leasing pipeline without creating an account and preserve reference on edits", async () => {
  const submit = await call("/public/applications", {
    method: "POST",
    session: null,
    body: {
      ...prospect(),
      unitId: publicUnitId,
      role: "admin",
      status: "Approved",
    },
  });
  assert.equal(submit.status, 201);
  assert.match(submit.data.reference, /^APL-[A-F0-9]{12}$/);
  const row = (await call("/bootstrap")).data.records.find(
    (r) => r.publicReference === submit.data.reference,
  );
  assert.equal(row.status, "New");
  assert.equal(row.submissionSource, "Public website");
  assert.ok(row.consentAt);
  assert.equal(
    (await call("/users")).data.users.some(
      (u) => u.email === "prospect@example.com",
    ),
    false,
  );
  const update = await call("/records/applications/" + row.id, {
    method: "PATCH",
    body: {
      data: { ...row, notes: "Staff review" },
      status: "Reviewing",
      version: row.version,
    },
  });
  assert.equal(update.status, 200);
  assert.equal(update.data.publicReference, submit.data.reference);
  assert.equal(update.data.consentAt, row.consentAt);
});
