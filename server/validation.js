import { moduleMap } from "../shared/modules.js";
export function fail(message, status = 400) {
  const e = new Error(message);
  e.status = status;
  throw e;
}
export function validate(m, input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    fail("Invalid record");
  const data = {};
  for (const f of m.fields) {
    let v = input[f.key];
    if (v === undefined || v === null || v === "") {
      if (f.required) fail(`${f.label} is required`);
      data[f.key] = "";
      continue;
    }
    if (["number", "money"].includes(f.type)) {
      v = Number(v);
      if (!Number.isFinite(v) || v < (f.min ?? 0) || v > (f.max ?? 1e12))
        fail(`${f.label} is out of range`);
      if (f.type === "money") v = Math.round((v + Number.EPSILON) * 100) / 100;
    } else {
      if (typeof v !== "string") fail(`${f.label} must be text`);
      v = v.trim();
      if (v.length > (f.type === "textarea" ? 10000 : 500))
        fail(`${f.label} is too long`);
      if (f.required && !v) fail(`${f.label} is required`);
      if (f.type === "select" && !f.options.includes(v))
        fail(`${f.label} is invalid`);
      if (
        f.type === "date" &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(v) ||
          !Number.isFinite(Date.parse(v)) ||
          new Date(v).toISOString().slice(0, 10) !== v)
      )
        fail(`${f.label} must be a valid date`);
      if (f.type === "time" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v))
        fail("Invalid time");
      if (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
        fail("Invalid email");
      if (f.type === "url") {
        let u;
        try {
          u = new URL(v);
        } catch {
          fail("Invalid document URL");
        }
        if (u.protocol !== "https:") fail("Document URL must use HTTPS");
      }
    }
    data[f.key] = v;
  }
  if (data.startDate && data.endDate && data.endDate < data.startDate)
    fail("End date must be after start date");
  if (data.startDate && data.expiryDate && data.expiryDate < data.startDate)
    fail("Expiry must be after start date");
  if (["invoices", "payments"].includes(m.id) && data.amount <= 0)
    fail("Amount must be greater than zero");
  return data;
}
export async function validateReferences(db, m, data) {
  for (const f of m.fields.filter((f) => f.type === "reference")) {
    if (data[f.key]) {
      const [r] = await db.query(
        "SELECT id FROM records WHERE id=$1 AND module=$2 AND archived=0",
        [data[f.key], f.module],
      );
      if (!r) fail(`${f.label} is unavailable`);
    }
  }
  if (data.propertyId && data.unitId) {
    const [unit] = await db.query("SELECT data FROM records WHERE id=$1", [
      data.unitId,
    ]);
    if (unit && JSON.parse(unit.data).propertyId !== data.propertyId)
      fail("Selected unit belongs to a different property");
  }
}
export function getModule(id) {
  return moduleMap[id] || fail("Module not found", 404);
}
export const decode = (r) => ({
  ...JSON.parse(r.data),
  id: r.id,
  module: r.module,
  status: r.status,
  archived: !!r.archived,
  version: r.version,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
