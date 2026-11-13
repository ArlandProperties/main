import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { openDatabase } from "../server/db.js";
import { createApp } from "../server/app.js";
async function fixture(fn) {
  const dir = mkdtempSync(join(tmpdir(), "arcland-activation-"));
  const db = await openDatabase({ file: join(dir, "test.sqlite") });
  const server = createApp(db, { setupToken: "test-setup-secret" }).listen(
    0,
    "127.0.0.1",
  );
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const call = async (path, body) => {
    const r = await fetch(base + "/api/auth/" + path, {
      method: "POST",
      headers: { "content-type": "application/json", "X-Arcland-Request": "1" },
      body: JSON.stringify(body),
    });
    return {
      status: r.status,
      data: await r.json(),
      cookie: r.headers.get("set-cookie"),
    };
  };
  try {
    await fn({ db, call });
  } finally {
    await new Promise((r) => server.close(r));
    await db.close();
    rmSync(dir, { recursive: true, force: true });
  }
}
test("administrator activation is private, passwordless until claimed, and one-time", async () =>
  fixture(async ({ db, call }) => {
    const activationToken = randomBytes(32).toString("hex");
    const body = {
      email: "owner@example.com",
      name: "Owner",
      activationToken,
      setupToken: "test-setup-secret",
    };
    assert.equal(
      (await call("prepare", { ...body, setupToken: "bad" })).status,
      403,
    );
    const prepared = await call("prepare", body);
    assert.equal(prepared.status, 201);
    assert.equal(prepared.data.pendingActivation, true);
    const [u] = await db.query("SELECT * FROM users");
    assert.equal(u.disabled, 1);
    assert.equal((await call("prepare", body)).status, 409);
    assert.equal(
      (await call("activation-info", { activationToken: "bad" })).status,
      400,
    );
    const info = await call("activation-info", { activationToken });
    assert.deepEqual(info.data, { email: "owner@example.com", name: "Owner" });
    assert.equal(
      (await call("activate", { activationToken, password: "short" })).status,
      400,
    );
    const activated = await call("activate", {
      activationToken,
      password: "private-owner-password",
    });
    assert.equal(activated.status, 200);
    assert.ok(activated.cookie.includes("HttpOnly"));
    assert.equal(activated.data.user.disabled, false);
    assert.equal(
      (
        await call("activate", {
          activationToken,
          password: "another-owner-password",
        })
      ).status,
      400,
    );
    assert.equal(
      (await call("activation-info", { activationToken })).status,
      400,
    );
    assert.equal(
      (
        await call("login", {
          email: body.email,
          password: "private-owner-password",
        })
      ).status,
      200,
    );
    const [row] = await db.query("SELECT COUNT(*) AS count FROM activations");
    assert.equal(Number(row.count), 0);
  }));
test("expired links cannot activate accounts", async () =>
  fixture(async ({ db, call }) => {
    const activationToken = randomBytes(32).toString("hex");
    await call("prepare", {
      email: "owner@example.com",
      name: "Owner",
      activationToken,
      setupToken: "test-setup-secret",
    });
    await db.exec("UPDATE activations SET expires_at=$1", [
      "2000-01-01T00:00:00.000Z",
    ]);
    assert.equal(
      (
        await call("activate", {
          activationToken,
          password: "private-owner-password",
        })
      ).status,
      400,
    );
    const [u] = await db.query("SELECT disabled FROM users");
    assert.equal(u.disabled, 1);
  }));
