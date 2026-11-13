import { fail } from "./validation.js";
export const agentModules = [
  "properties",
  "units",
  "tenants",
  "leases",
  "applications",
  "maintenance",
  "vendors",
  "inspections",
  "tasks",
  "events",
];
export const agentWrites = [
  "units",
  "tenants",
  "leases",
  "applications",
  "maintenance",
  "inspections",
  "tasks",
  "events",
];
export function profileOf(user) {
  try {
    return typeof user.profile === "string"
      ? JSON.parse(user.profile)
      : user.profile || {};
  } catch {
    return {};
  }
}
function pick(r, keys) {
  return Object.fromEntries(
    [
      "id",
      "module",
      "name",
      "status",
      "archived",
      "version",
      "createdAt",
      "updatedAt",
      ...keys,
    ]
      .filter((k) => r[k] !== undefined)
      .map((k) => [k, r[k]]),
  );
}
export function propertyFor(r, all) {
  if (r.module === "properties") return r.id;
  if (r.propertyId) return r.propertyId;
  if (r.unitId)
    return all.find((x) => x.module === "units" && x.id === r.unitId)
      ?.propertyId;
  if (r.tenantId) {
    const t = all.find((x) => x.module === "tenants" && x.id === r.tenantId);
    return all.find((x) => x.module === "units" && x.id === t?.unitId)
      ?.propertyId;
  }
  return null;
}
export function scopedRecords(user, all) {
  const profile = profileOf(user);
  if (user.role === "agent") {
    const assigned = new Set(profile.propertyIds || []);
    return all
      .filter(
        (r) =>
          agentModules.includes(r.module) &&
          ((r.module === "vendors" && assigned.size > 0) ||
            assigned.has(propertyFor(r, all))),
      )
      .map((r) =>
        r.module === "vendors"
          ? pick(r, ["trade", "email", "phone", "contact"])
          : r.module === "properties"
            ? pick(r, [
                "address",
                "city",
                "region",
                "postal",
                "type",
                "yearBuilt",
              ])
            : r,
      );
  }
  if (user.role !== "tenant") return all;
  const resident = all.find(
    (r) => r.module === "tenants" && r.id === profile.tenantId && !r.archived,
  );
  if (!resident) return [];
  const leases = all.filter(
    (r) => r.module === "leases" && r.tenantId === resident.id && !r.archived,
  );
  const unitIds = new Set(
    [resident.unitId, ...leases.map((l) => l.unitId)].filter(Boolean),
  );
  const units = all.filter((r) => r.module === "units" && unitIds.has(r.id));
  const propertyIds = new Set(units.map((u) => u.propertyId));
  const invoices = all.filter(
    (r) =>
      r.module === "invoices" &&
      r.tenantId === resident.id &&
      !r.archived &&
      r.status !== "Draft",
  );
  const invoiceIds = new Set(invoices.map((r) => r.id));
  return all
    .filter(
      (r) =>
        !r.archived &&
        ((r.module === "tenants" && r.id === resident.id) ||
          (r.module === "units" && unitIds.has(r.id)) ||
          (r.module === "properties" && propertyIds.has(r.id)) ||
          (r.module === "leases" && r.tenantId === resident.id) ||
          (r.module === "invoices" && invoiceIds.has(r.id)) ||
          (r.module === "payments" && invoiceIds.has(r.invoiceId)) ||
          (r.module === "maintenance" && r.requesterTenantId === resident.id) ||
          (r.module === "notices" &&
            r.status === "Delivered" &&
            (r.tenantId === resident.id ||
              (!r.tenantId &&
                r.propertyId ===
                  units.find((u) => u.id === resident.unitId)?.propertyId))) ||
          (r.module === "documents" &&
            r.status === "Reviewed" &&
            r.tenantId === resident.id) ||
          (r.module === "events" &&
            r.tenantId === resident.id &&
            ["Scheduled", "Confirmed"].includes(r.status))),
    )
    .map((r) => {
      const keys = {
        tenants: ["email", "phone", "unitId", "moveIn"],
        units: ["propertyId", "bedrooms", "bathrooms", "area"],
        properties: ["address", "city", "region", "postal", "type"],
        leases: [
          "tenantId",
          "unitId",
          "startDate",
          "endDate",
          "rent",
          "deposit",
        ],
        invoices: ["tenantId", "propertyId", "amount", "dueDate", "category"],
        payments: ["invoiceId", "amount", "paymentDate", "method", "reference"],
        maintenance: [
          "propertyId",
          "unitId",
          "priority",
          "dueDate",
          "residentDescription",
        ],
        notices: ["propertyId", "deliveryDate", "body"],
        documents: ["category", "url", "expiryDate"],
        events: ["propertyId", "eventDate", "time", "location"],
      };
      return pick(r, keys[r.module] || []);
    });
}
export async function validateProfile(tx, role, profile = {}, id) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile))
    fail("Invalid account assignment");
  if (role === "tenant") {
    if (typeof profile.tenantId !== "string")
      fail("Choose a resident record for this tenant account");
    const [r] = await tx.query(
      "SELECT id FROM records WHERE id=$1 AND module='tenants' AND archived=0",
      [profile.tenantId],
    );
    if (!r) fail("Resident record is unavailable");
    const users = await tx.query(
      "SELECT id,profile FROM users WHERE role='tenant'",
    );
    if (
      users.some(
        (u) => u.id !== id && profileOf(u).tenantId === profile.tenantId,
      )
    )
      fail("This resident already has a portal account", 409);
    return { tenantId: profile.tenantId };
  }
  if (role === "agent") {
    if (
      !Array.isArray(profile.propertyIds) ||
      profile.propertyIds.length > 200 ||
      profile.propertyIds.some((v) => typeof v !== "string")
    )
      fail("Choose assigned properties");
    for (const propertyId of profile.propertyIds) {
      const [r] = await tx.query(
        "SELECT id FROM records WHERE id=$1 AND module='properties' AND archived=0",
        [propertyId],
      );
      if (!r) fail("Assigned property is unavailable");
    }
    return { propertyIds: [...new Set(profile.propertyIds)] };
  }
  return {};
}
export async function assertAgentAccess(tx, user, m, data, id) {
  if (user.role !== "agent") return;
  if (!agentWrites.includes(m.id))
    fail("Agents cannot change this module", 403);
  const rows = (await tx.query("SELECT * FROM records")).map((r) => ({
    ...JSON.parse(r.data),
    id: r.id,
    module: r.module,
    archived: !!r.archived,
  }));
  const allowed = new Set(profileOf(user).propertyIds || []);
  if (!allowed.has(propertyFor({ ...data, id, module: m.id }, rows)))
    fail("This record is outside your assigned properties", 403);
  const visible = new Set(scopedRecords(user, rows).map((r) => r.id));
  for (const f of m.fields.filter((f) => f.type === "reference"))
    if (data[f.key] && !visible.has(data[f.key]))
      fail("A linked record is outside your access", 403);
}
