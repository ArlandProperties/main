import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { modules, moduleMap, featureCatalog } from "../shared/modules.js";
import {
  hashToken,
  token,
  hashPassword,
  checkPassword,
  checkSecret,
  publicUser,
} from "./security.js";
import {
  fail,
  validate,
  validateReferences,
  getModule,
  decode,
} from "./validation.js";
const now = () => new Date().toISOString();
const emailOk = (e) =>
  typeof e === "string" &&
  e.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const passwordOk = (p) =>
  typeof p === "string" && p.length >= 12 && p.length <= 128;
export function createApp(
  db,
  {
    setupToken = process.env.SETUP_TOKEN,
    production = process.env.NODE_ENV === "production",
    staticDir = resolve("dist"),
  } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          upgradeInsecureRequests: production ? [] : null,
        },
      },
    }),
  );
  app.use(express.json({ limit: "256kb" }));
  app.get("/api/health", async (req, res) => {
    try {
      await db.query("SELECT 1 AS ok");
      res.json({ status: "ok" });
    } catch {
      res.status(503).json({ status: "unavailable" });
    }
  });
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (req.get("X-Arcland-Request") !== "1")
        return res.status(403).json({ error: "Missing request header" });
      const origin = req.get("origin");
      if (origin) {
        let allowed;
        try {
          allowed = new URL(origin).host === req.get("host");
        } catch {}
        if (!allowed)
          return res.status(403).json({ error: "Origin is not allowed" });
      }
    }
    next();
  });
  const authLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many attempts. Try again in 15 minutes." },
  });
  async function audit(
    tx,
    user,
    action,
    module = null,
    id = null,
    detail = "",
  ) {
    await tx.exec(
      "INSERT INTO audit (id,actor_id,actor_name,action,module,record_id,detail,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [randomUUID(), user.id, user.name, action, module, id, detail, now()],
    );
  }
  async function session(res, user) {
    const t = token();
    await db.exec(
      "INSERT INTO sessions (token_hash,user_id,expires_at) VALUES ($1,$2,$3)",
      [
        hashToken(t),
        user.id,
        new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      ],
    );
    res.cookie("arcland_session", t, {
      httpOnly: true,
      secure: production,
      sameSite: "strict",
      maxAge: 8 * 60 * 60 * 1000,
      path: "/",
    });
    return publicUser(user);
  }
  app.get("/api/auth/status", async (req, res) => {
    const [u] = await db.query("SELECT COUNT(*) AS count FROM users");
    res.json({ needsSetup: Number(u.count) === 0, setupEnabled: !!setupToken });
  });
  app.post("/api/auth/setup", authLimit, async (req, res) => {
    const { email, name, password, setupToken: provided } = req.body;
    if (!checkSecret(provided, setupToken))
      fail("The setup token is incorrect", 403);
    if (
      !emailOk(email) ||
      !passwordOk(password) ||
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 100
    )
      fail("Enter a name, valid email, and password of 12–128 characters");
    const u = {
      id: randomUUID(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      role: "admin",
      created_at: now(),
    };
    const hash = await hashPassword(password);
    await db.transaction(async (tx) => {
      await tx.exec("UPDATE setup_lock SET id=$1 WHERE id=$2", [
        "owner",
        "owner",
      ]);
      const [r] = await tx.query("SELECT COUNT(*) AS count FROM users");
      if (Number(r.count) > 0) fail("Setup is already complete", 409);
      await tx.exec(
        "INSERT INTO users (id,email,name,password_hash,role,created_at) VALUES ($1,$2,$3,$4,$5,$6)",
        [u.id, u.email, u.name, hash, u.role, u.created_at],
      );
      await audit(tx, u, "Created owner account");
    });
    res.status(201).json({ user: await session(res, u) });
  });
  app.post("/api/auth/prepare", authLimit, async (req, res) => {
    const { email, name, activationToken, setupToken: provided } = req.body;
    if (!checkSecret(provided, setupToken))
      fail("The setup token is incorrect", 403);
    if (
      !emailOk(email) ||
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 100 ||
      !/^[a-f0-9]{64}$/.test(activationToken || "")
    )
      fail("Valid account details and an activation token are required");
    const u = {
      id: randomUUID(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: "admin",
      created_at: now(),
    };
    const passwordHash = await hashPassword(token());
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await db.transaction(async (tx) => {
      await tx.exec("UPDATE setup_lock SET id=$1 WHERE id=$2", [
        "owner",
        "owner",
      ]);
      const [count] = await tx.query("SELECT COUNT(*) AS count FROM users");
      if (Number(count.count)) fail("An owner account already exists", 409);
      await tx.exec(
        "INSERT INTO users (id,email,name,password_hash,role,disabled,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [u.id, u.email, u.name, passwordHash, u.role, 1, u.created_at],
      );
      await tx.exec(
        "INSERT INTO activations (token_hash,user_id,expires_at) VALUES ($1,$2,$3)",
        [hashToken(activationToken), u.id, expiresAt],
      );
      await audit(tx, u, "Prepared administrator activation");
    });
    res
      .status(201)
      .json({
        email: u.email,
        name: u.name,
        pendingActivation: true,
        expiresAt,
      });
  });
  async function activation(tx, value) {
    if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value))
      fail("Activation link is invalid or expired", 400);
    const [u] = await tx.query(
      "SELECT u.* FROM users u JOIN activations a ON a.user_id=u.id WHERE a.token_hash=$1 AND a.expires_at>$2 AND u.disabled=1",
      [hashToken(value), now()],
    );
    if (!u) fail("Activation link is invalid, expired, or already used", 400);
    return u;
  }
  app.post("/api/auth/activation-info", authLimit, async (req, res) => {
    const u = await activation(db, req.body.activationToken);
    res.json({ name: u.name, email: u.email });
  });
  app.post("/api/auth/activate", authLimit, async (req, res) => {
    if (!passwordOk(req.body.password))
      fail("Choose a password of 12–128 characters");
    const passwordHash = await hashPassword(req.body.password);
    const u = await db.transaction(async (tx) => {
      const user = await activation(tx, req.body.activationToken);
      await tx.exec(
        "UPDATE users SET password_hash=$1,disabled=0 WHERE id=$2",
        [passwordHash, user.id],
      );
      await tx.exec("DELETE FROM activations WHERE user_id=$1", [user.id]);
      await audit(tx, user, "Activated administrator account");
      return { ...user, disabled: 0 };
    });
    res.json({ user: await session(res, u) });
  });
  app.post("/api/auth/login", authLimit, async (req, res) => {
    const { email, password } = req.body;
    if (
      !emailOk(email) ||
      typeof password !== "string" ||
      password.length > 128
    )
      fail("Invalid email or password", 401);
    const [u] = await db.query("SELECT * FROM users WHERE email=$1", [
      email.trim().toLowerCase(),
    ]);
    const valid = await checkPassword(
      password,
      u?.password_hash || "0".repeat(32) + ":" + "0".repeat(128),
    );
    if (!u || u.disabled || !valid) fail("Invalid email or password", 401);
    await db.exec("DELETE FROM sessions WHERE expires_at<$1", [now()]);
    res.json({ user: await session(res, u) });
  });
  app.use("/api", async (req, res, next) => {
    const cookie = req.get("cookie") || "";
    const raw = cookie
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("arcland_session="))
      ?.slice(16);
    if (!raw) fail("Please sign in", 401);
    const [u] = await db.query(
      "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>$2 AND u.disabled=0",
      [hashToken(raw), now()],
    );
    if (!u) fail("Session expired. Please sign in", 401);
    req.user = u;
    req.sessionHash = hashToken(raw);
    next();
  });
  const admin = (req, res, next) => {
    if (req.user.role !== "admin") fail("Administrator access required", 403);
    next();
  };
  const write = (req, res, next) => {
    if (!["admin", "manager"].includes(req.user.role))
      fail("This account has read-only access", 403);
    next();
  };
  app.get("/api/auth/me", (req, res) =>
    res.json({ user: publicUser(req.user) }),
  );
  app.post("/api/auth/logout", async (req, res) => {
    await db.exec("DELETE FROM sessions WHERE token_hash=$1", [
      req.sessionHash,
    ]);
    res.clearCookie("arcland_session", { path: "/" });
    res.json({ ok: true });
  });
  app.post("/api/auth/password", async (req, res) => {
    const { currentPassword, password } = req.body;
    if (
      typeof currentPassword !== "string" ||
      !passwordOk(password) ||
      !(await checkPassword(currentPassword, req.user.password_hash))
    )
      fail(
        "Current password is incorrect or new password is shorter than 12 characters",
      );
    const hash = await hashPassword(password);
    await db.transaction(async (tx) => {
      await tx.exec("UPDATE users SET password_hash=$1 WHERE id=$2", [
        hash,
        req.user.id,
      ]);
      await tx.exec("DELETE FROM sessions WHERE user_id=$1", [req.user.id]);
      await audit(tx, req.user, "Changed password");
    });
    res.json({ user: await session(res, req.user) });
  });
  app.get("/api/bootstrap", async (req, res) => {
    const rows = await db.query(
      "SELECT * FROM records ORDER BY created_at DESC",
    );
    const [setting] = await db.query("SELECT data FROM settings WHERE id=$1", [
      "company",
    ]);
    res.json({
      modules,
      features: featureCatalog,
      records: rows.map(decode),
      user: publicUser(req.user),
      settings: setting
        ? JSON.parse(setting.data)
        : {
            company: "Arcland Properties Inc",
            currency: "CAD",
            timezone: "America/Toronto",
          },
    });
  });
  async function read(tx, id, module) {
    const [r] = await tx.query(
      "SELECT * FROM records WHERE id=$1 AND module=$2",
      [id, module],
    );
    if (!r) fail("Record not found", 404);
    return r;
  }
  async function update(tx, r, data, status, archived = r.archived) {
    const result = await tx.exec(
      "UPDATE records SET data=$1,status=$2,archived=$3,version=version+1,updated_at=$4 WHERE id=$5 AND version=$6",
      [JSON.stringify(data), status, archived, now(), r.id, r.version],
    );
    if ((result.rowCount ?? result.changes) !== 1)
      fail("This record changed. Refresh and try again.", 409);
  }
  async function rules(tx, m, data, status, id) {
    if (m.id === "invoices" && status === "Paid")
      fail("Invoice payment status is calculated from posted payments");
    if (m.id === "leases" && status === "Active") {
      const leases = await tx.query(
        "SELECT * FROM records WHERE module='leases' AND status='Active' AND archived=0",
      );
      if (
        leases.some(
          (l) => l.id !== id && JSON.parse(l.data).unitId === data.unitId,
        )
      )
        fail("This unit already has an active lease", 409);
    }
    if (m.id === "payments" && status === "Posted") {
      const invoice = await read(tx, data.invoiceId, "invoices");
      if (invoice.archived || ["Draft", "Void"].includes(invoice.status))
        fail("Payments require an issued invoice");
      const invoiceData = JSON.parse(invoice.data);
      const payments = await tx.query(
        "SELECT * FROM records WHERE module='payments' AND status='Posted' AND archived=0",
      );
      const paid = payments
        .filter(
          (p) => p.id !== id && JSON.parse(p.data).invoiceId === data.invoiceId,
        )
        .reduce(
          (s, p) => s + Math.round(Number(JSON.parse(p.data).amount) * 100),
          0,
        );
      if (
        paid + Math.round(data.amount * 100) >
        Math.round(invoiceData.amount * 100)
      )
        fail("Payment exceeds the invoice outstanding balance");
    }
  }
  async function recalcInvoice(tx, id) {
    const r = await read(tx, id, "invoices");
    const d = JSON.parse(r.data);
    if (["Draft", "Void"].includes(r.status)) return;
    const ps = await tx.query(
      "SELECT data FROM records WHERE module='payments' AND status='Posted' AND archived=0",
    );
    const paid = ps
      .map((p) => JSON.parse(p.data))
      .filter((p) => p.invoiceId === id)
      .reduce((s, p) => s + Math.round(Number(p.amount) * 100), 0);
    const state = paid >= Math.round(d.amount * 100) ? "Paid" : "Issued";
    if (state !== r.status) await update(tx, r, d, state);
  }
  async function related(tx, m, old, data, status, archived = 0) {
    if (m.id === "payments") {
      if (old?.invoiceId && old.invoiceId !== data.invoiceId)
        await recalcInvoice(tx, old.invoiceId);
      await recalcInvoice(tx, data.invoiceId);
    }
    if (m.id === "leases") {
      const ids = [...new Set([old?.unitId, data.unitId].filter(Boolean))];
      for (const id of ids) {
        const unit = await read(tx, id, "units");
        const active = await tx.query(
          "SELECT data FROM records WHERE module='leases' AND status='Active' AND archived=0",
        );
        const occupied = active.some((l) => JSON.parse(l.data).unitId === id);
        if (occupied && unit.status !== "Occupied")
          await update(tx, unit, JSON.parse(unit.data), "Occupied");
        else if (!occupied && unit.status === "Occupied")
          await update(tx, unit, JSON.parse(unit.data), "Vacant");
      }
    }
  }
  app.post("/api/records/:module", write, async (req, res) => {
    const m = getModule(req.params.module),
      data = validate(m, req.body.data);
    const status = req.body.status || m.statuses[0];
    if (!m.statuses.includes(status)) fail("Invalid status");
    const id = randomUUID(),
      time = now();
    await db.transaction(async (tx) => {
      await validateReferences(tx, m, data);
      await rules(tx, m, data, status, id);
      await tx.exec(
        "INSERT INTO records (id,module,data,status,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6)",
        [id, m.id, JSON.stringify(data), status, time, time],
      );
      await related(tx, m, null, data, status);
      await audit(tx, req.user, "Created", m.id, id, data.name);
    });
    res.status(201).json(decode(await read(db, id, m.id)));
  });
  app.patch("/api/records/:module/:id", write, async (req, res) => {
    const m = getModule(req.params.module),
      id = req.params.id;
    await db.transaction(async (tx) => {
      const r = await read(tx, id, m.id);
      if (req.body.version !== r.version)
        fail("This record changed. Refresh and try again.", 409);
      if (r.archived) fail("Restore this record before editing");
      const old = JSON.parse(r.data),
        data = validate(m, req.body.data);
      const status = req.body.status || r.status;
      if (!m.statuses.includes(status)) fail("Invalid status");
      if (
        (m.id === "payments" && r.status === "Posted") ||
        (m.id === "invoices" && r.status === "Paid")
      )
        fail(
          "Posted payments and paid invoices are locked. Use a new correcting record.",
        );
      if (
        m.id === "invoices" &&
        (old.amount !== data.amount ||
          old.tenantId !== data.tenantId ||
          ["Draft", "Void"].includes(status))
      ) {
        const ps = await tx.query(
          "SELECT data FROM records WHERE module='payments' AND status='Posted' AND archived=0",
        );
        if (ps.some((p) => JSON.parse(p.data).invoiceId === id))
          fail(
            "Cannot change invoice amount, resident, or void/draft status after payments are posted",
          );
      }
      await validateReferences(tx, m, data);
      await rules(tx, m, data, status, id);
      await update(tx, r, data, status);
      await related(tx, m, old, data, status);
      await audit(tx, req.user, "Updated", m.id, id, data.name);
    });
    res.json(decode(await read(db, id, m.id)));
  });
  app.post("/api/records/:module/:id/:operation", write, async (req, res) => {
    const m = getModule(req.params.module),
      { id, operation } = req.params;
    if (!["archive", "restore", "action"].includes(operation))
      fail("Unknown operation", 404);
    await db.transaction(async (tx) => {
      const r = await read(tx, id, m.id);
      if (req.body.version !== r.version)
        fail("This record changed. Refresh and try again.", 409);
      const data = JSON.parse(r.data);
      let status = r.status,
        archived = r.archived;
      if (operation === "archive") {
        if (r.archived) fail("Already archived");
        const rows = await tx.query("SELECT * FROM records WHERE archived=0");
        const dependent = rows.some(
          (other) =>
            other.id !== id &&
            moduleMap[other.module]?.fields
              .filter((f) => f.type === "reference")
              .some((f) => JSON.parse(other.data)[f.key] === id),
        );
        if (dependent) fail("Archive linked records first");
        if (m.id === "payments" && r.status === "Posted")
          fail("Posted payments are retained for audit");
        if (m.id === "leases" && r.status === "Active")
          fail("End the lease before archiving");
        archived = 1;
      }
      if (operation === "restore") {
        if (!r.archived) fail("Record is not archived");
        await validateReferences(tx, m, data);
        await rules(tx, m, data, status, id);
        archived = 0;
      }
      if (operation === "action") {
        if (r.archived) fail("Restore the record first");
        if (!m.action.from.includes(r.status))
          fail("This action is not available for the current status", 409);
        await validateReferences(tx, m, data);
        status = m.action.to;
        await rules(tx, m, data, status, id);
      }
      await update(tx, r, data, status, archived);
      await related(tx, m, data, data, status, archived);
      await audit(
        tx,
        req.user,
        operation === "action"
          ? m.action.label
          : operation === "archive"
            ? "Archived"
            : "Restored",
        m.id,
        id,
        data.name,
      );
    });
    res.json(decode(await read(db, id, m.id)));
  });
  app.post("/api/payments/:id/reverse", admin, async (req, res) => {
    const { version, reason } = req.body;
    if (
      typeof reason !== "string" ||
      reason.trim().length < 5 ||
      reason.length > 1000
    )
      fail("Enter a reversal reason of 5–1000 characters");
    await db.transaction(async (tx) => {
      const r = await read(tx, req.params.id, "payments");
      if (version !== r.version)
        fail("This record changed. Refresh and try again.", 409);
      if (r.status !== "Posted" || r.archived)
        fail("Only posted active payments can be reversed");
      const d = JSON.parse(r.data);
      await update(tx, r, d, "Reversed");
      await recalcInvoice(tx, d.invoiceId);
      await audit(
        tx,
        req.user,
        "Reversed payment",
        "payments",
        r.id,
        reason.trim(),
      );
    });
    res.json({ ok: true });
  });
  app.post("/api/users/:id/reset-password", admin, async (req, res) => {
    if (req.params.id === req.user.id) fail("Use your account password form");
    if (!passwordOk(req.body.password))
      fail("Password must have 12–128 characters");
    const hash = await hashPassword(req.body.password);
    await db.transaction(async (tx) => {
      const [u] = await tx.query("SELECT id FROM users WHERE id=$1", [
        req.params.id,
      ]);
      if (!u) fail("Account not found", 404);
      await tx.exec("UPDATE users SET password_hash=$1 WHERE id=$2", [
        hash,
        u.id,
      ]);
      await tx.exec("DELETE FROM sessions WHERE user_id=$1", [u.id]);
      await audit(tx, req.user, "Reset team member password", null, u.id);
    });
    res.json({ ok: true });
  });
  app.get("/api/audit", async (req, res) =>
    res.json({
      events: await db.query(
        "SELECT * FROM audit ORDER BY created_at DESC LIMIT 1000",
      ),
    }),
  );
  app.get("/api/users", admin, async (req, res) =>
    res.json({
      users: (await db.query("SELECT * FROM users ORDER BY created_at")).map(
        publicUser,
      ),
    }),
  );
  app.post("/api/users", admin, async (req, res) => {
    const { name, email, password, role } = req.body;
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 100 ||
      !emailOk(email) ||
      !passwordOk(password) ||
      !["admin", "manager", "viewer"].includes(role)
    )
      fail("Enter valid account details; passwords need 12–128 characters");
    const id = randomUUID(),
      hash = await hashPassword(password);
    await db.transaction(async (tx) => {
      await tx.exec(
        "INSERT INTO users (id,email,name,password_hash,role,created_at) VALUES ($1,$2,$3,$4,$5,$6)",
        [id, email.toLowerCase().trim(), name.trim(), hash, role, now()],
      );
      await audit(tx, req.user, "Created team account", null, id, email);
    });
    res.status(201).json({ ok: true });
  });
  app.patch("/api/users/:id", admin, async (req, res) => {
    if (req.params.id === req.user.id)
      fail("You cannot change your own role or disable your own account");
    const { role, disabled } = req.body;
    if (
      !["admin", "manager", "viewer"].includes(role) ||
      typeof disabled !== "boolean"
    )
      fail("Invalid account settings");
    await db.transaction(async (tx) => {
      const [u] = await tx.query("SELECT * FROM users WHERE id=$1", [
        req.params.id,
      ]);
      if (!u) fail("Account not found", 404);
      if (u.role === "admin" && !u.disabled && (role !== "admin" || disabled)) {
        const [count] = await tx.query(
          "SELECT COUNT(*) AS count FROM users WHERE role='admin' AND disabled=0",
        );
        if (Number(count.count) <= 1)
          fail("At least one active administrator must remain");
      }
      await tx.exec("UPDATE users SET role=$1,disabled=$2 WHERE id=$3", [
        role,
        disabled ? 1 : 0,
        req.params.id,
      ]);
      await tx.exec("DELETE FROM sessions WHERE user_id=$1", [req.params.id]);
      await audit(
        tx,
        req.user,
        "Updated team access",
        null,
        req.params.id,
        `${role}; disabled=${disabled}`,
      );
    });
    res.json({ ok: true });
  });
  app.put("/api/settings", admin, async (req, res) => {
    const { company, currency, timezone } = req.body;
    if (
      typeof company !== "string" ||
      !company.trim() ||
      company.length > 100 ||
      !["CAD", "USD", "GBP", "EUR"].includes(currency)
    )
      fail("Invalid company settings");
    try {
      Intl.DateTimeFormat("en", { timeZone: timezone });
    } catch {
      fail("Invalid timezone");
    }
    const data = { company: company.trim(), currency, timezone };
    await db.transaction(async (tx) => {
      await tx.exec(
        "INSERT INTO settings (id,data) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET data=excluded.data",
        ["company", JSON.stringify(data)],
      );
      await audit(tx, req.user, "Updated company settings");
    });
    res.json(data);
  });
  app.post("/api/demo", admin, async (req, res) => {
    if (req.body.confirm !== "LOAD SAMPLE DATA") fail("Confirmation required");
    await db.transaction(async (tx) => {
      const [n] = await tx.query("SELECT COUNT(*) AS count FROM records");
      if (Number(n.count))
        fail("Sample data can only be loaded into an empty workspace", 409);
      const { seed } = await import("./seed.js");
      await seed(tx);
      await audit(tx, req.user, "Loaded sample portfolio");
    });
    res.json({ ok: true });
  });
  app.get("/api/backup", admin, async (req, res) => {
    res.set(
      "Content-Disposition",
      'attachment; filename="arcland-records-backup.json"',
    );
    res.json({
      format: 1,
      exportedAt: now(),
      records: (await db.query("SELECT * FROM records")).map(decode),
      audit: await db.query("SELECT * FROM audit ORDER BY created_at"),
      settings: (await db.query("SELECT * FROM settings")).map((s) => ({
        id: s.id,
        data: JSON.parse(s.data),
      })),
    });
  });
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "Endpoint not found" }),
  );
  app.use(express.static(staticDir));
  app.get("/{*path}", (req, res) =>
    res.sendFile(resolve(staticDir, "index.html")),
  );
  app.use((err, req, res, next) => {
    const status =
      err.status ||
      (err.code === "23505" ||
      String(err.code).includes("CONSTRAINT_UNIQUE") ||
      /UNIQUE constraint failed/.test(err.message)
        ? 409
        : 500);
    if (status >= 500) console.error("Request failed:", err.message);
    res.status(status).json({
      error:
        status === 409 && !err.status
          ? "An account with that email already exists"
          : status >= 500
            ? "Something went wrong. Please try again."
            : err.message,
    });
  });
  return app;
}
