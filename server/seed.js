import { randomUUID } from "node:crypto";
import { moduleMap } from "../shared/modules.js";
export async function seed(db) {
  const ids = {};
  const add = async (module, key, data, status) => {
    const id = randomUUID();
    ids[key] = id;
    const time = new Date().toISOString();
    await db.exec(
      "INSERT INTO records (id,module,data,status,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6)",
      [
        id,
        module,
        JSON.stringify(data),
        status || moduleMap[module].statuses[0],
        time,
        time,
      ],
    );
    return id;
  };
  const today = new Date().toISOString().slice(0, 10),
    future = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  await add("owners", "owner", {
    name: "Arcland Holdings (sample)",
    email: "owner@example.com",
    company: "Sample portfolio",
    managementFee: 6,
  });
  for (const [i, name, address] of [
    [1, "The Willow Residences", "124 Willow Avenue"],
    [2, "Parkside Apartments", "82 Parkside Drive"],
    [3, "Oakwood Business Centre", "310 Oakwood Road"],
  ]) {
    await add("properties", "p" + i, {
      name,
      address,
      city: "Toronto",
      region: "ON",
      type: i === 3 ? "Commercial" : "Residential",
      ownerId: ids.owner,
      notes: "Sample data — replace with your own records.",
    });
    for (let j = 1; j <= 4; j++)
      await add(
        "units",
        `u${i}${j}`,
        {
          name: `${name} · ${j}01`,
          propertyId: ids["p" + i],
          bedrooms: i === 3 ? 0 : 2,
          bathrooms: 1,
          area: 850,
          rent: 1800 + i * 150,
          deposit: 1800,
        },
        j <= 3 ? "Occupied" : "Vacant",
      );
  }
  for (let i = 1; i <= 3; i++) {
    await add("tenants", "t" + i, {
      name: ["Olivia Bennett", "James Wilson", "Sophia Chen"][i - 1],
      email: `resident${i}@example.com`,
      unitId: ids[`u1${i}`],
      moveIn: today,
    });
    await add(
      "leases",
      "l" + i,
      {
        name: `Willow ${i}01 · Annual lease`,
        tenantId: ids["t" + i],
        unitId: ids[`u1${i}`],
        startDate: today,
        endDate: new Date(Date.now() + 365 * 86400000)
          .toISOString()
          .slice(0, 10),
        rent: 1950,
        deposit: 1800,
      },
      "Active",
    );
    await add(
      "invoices",
      "i" + i,
      {
        name: `Rent · Willow ${i}01`,
        tenantId: ids["t" + i],
        propertyId: ids.p1,
        amount: 1950,
        dueDate: future,
        category: "Rent",
      },
      i === 1 ? "Paid" : "Issued",
    );
  }
  await add(
    "payments",
    "payment",
    {
      name: "Bank transfer · Olivia",
      invoiceId: ids.i1,
      amount: 1950,
      paymentDate: today,
      method: "Bank transfer",
      reference: "SAMPLE-001",
    },
    "Posted",
  );
  await add("vendors", "vendor", {
    name: "Evergreen Building Services",
    trade: "HVAC & plumbing",
    email: "service@example.com",
    contact: "Alex Morgan",
  });
  await add("maintenance", "work", {
    name: "Kitchen tap leaking",
    propertyId: ids.p1,
    unitId: ids.u11,
    vendorId: ids.vendor,
    priority: "Urgent",
    dueDate: today,
    estimate: 180,
    notes: "Sample request: check the seal and supply line.",
  });
  await add(
    "maintenance",
    "work2",
    {
      name: "Seasonal HVAC service",
      propertyId: ids.p3,
      vendorId: ids.vendor,
      priority: "Normal",
      dueDate: future,
      estimate: 650,
    },
    "In progress",
  );
  await add(
    "expenses",
    "expense",
    {
      name: "Common area lighting",
      propertyId: ids.p2,
      vendorId: ids.vendor,
      amount: 325,
      expenseDate: today,
      category: "Repairs",
    },
    "Approved",
  );
  await add(
    "budgets",
    "budget",
    {
      name: "Willow repairs budget",
      propertyId: ids.p1,
      year: new Date().getFullYear(),
      amount: 25000,
      category: "Repairs",
    },
    "Approved",
  );
  await add("applications", "application", {
    name: "Taylor Williams",
    email: "applicant@example.com",
    unitId: ids.u14,
    desiredMoveIn: future,
    income: 6500,
  });
  await add("inspections", "inspection", {
    name: "Willow routine walk-through",
    propertyId: ids.p1,
    inspectionDate: future,
    type: "Routine",
    inspector: "Property manager",
  });
  await add("assets", "asset", {
    name: "Oakwood roof HVAC unit",
    propertyId: ids.p3,
    serial: "SAMPLE-HVAC-001",
    serviceDate: future,
    value: 8500,
  });
  await add("documents", "document", {
    name: "Sample property document link",
    propertyId: ids.p1,
    category: "Other",
    url: "https://example.com",
    notes: "Replace this example link with a secure document URL.",
  });
  await add("notices", "notice", {
    name: "Scheduled building inspection",
    propertyId: ids.p1,
    deliveryDate: future,
    channel: "Email (external)",
    body: "A routine inspection is planned. Please contact the property manager for details.",
  });
  await add("tasks", "task", {
    name: "Review upcoming lease renewals",
    propertyId: ids.p1,
    assignee: "Property manager",
    dueDate: future,
    priority: "High",
  });
  await add("events", "event", {
    name: "Parkside viewing",
    propertyId: ids.p2,
    eventDate: future,
    time: "14:00",
    location: "Main entrance",
    attendees: "Leasing team",
  });
  await add("insurance", "policy", {
    name: "Willow building coverage",
    propertyId: ids.p1,
    provider: "Sample Insurance",
    policyNumber: "SAMPLE-001",
    expiryDate: future,
    premium: 4200,
    coverage: 2000000,
  });
  await add(
    "keys",
    "key",
    {
      name: "Willow service key",
      propertyId: ids.p1,
      keyCode: "W-SERVICE-01",
      holder: "Evergreen Building Services",
      returnDate: future,
    },
    "Checked out",
  );
}
