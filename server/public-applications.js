import { randomUUID } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { fail, decode } from "./validation.js";
export function installProspectRoutes(app, db) {
  const limiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 12,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Please wait before submitting another application." },
  });
  async function listings(tx = db) {
    const rows = (
      await tx.query(
        "SELECT * FROM records WHERE archived=0 AND module IN ('units','properties')",
      )
    ).map(decode);
    return rows
      .filter(
        (r) =>
          r.module === "units" &&
          r.status === "Vacant" &&
          r.listing === "Public",
      )
      .flatMap((u) => {
        const p = rows.find(
          (p) =>
            p.module === "properties" &&
            p.id === u.propertyId &&
            p.status === "Active",
        );
        if (!p) return [];
        return [
          {
            id: u.id,
            name: u.name,
            property: p.name,
            city: p.city || "",
            region: p.region || "",
            type: p.type || "Residential",
            bedrooms: u.bedrooms || 0,
            bathrooms: u.bathrooms || 0,
            area: u.area || 0,
            rent: u.rent || 0,
          },
        ];
      });
  }
  app.get("/api/public/rentals", async (req, res) => {
    const [s] = await db.query("SELECT data FROM settings WHERE id='company'");
    const settings = s ? JSON.parse(s.data) : {};
    res.json({
      rentals: await listings(),
      currency: settings.currency || "CAD",
      company: settings.company || "Arcland Properties Inc",
    });
  });
  app.post("/api/public/applications", limiter, async (req, res) => {
    const {
      name,
      email,
      phone,
      unitId,
      desiredMoveIn,
      householdSize,
      contactMethod,
      message,
      consent,
      website,
    } = req.body;
    if (website) fail("Unable to submit this form");
    const clean = (v, max) =>
      typeof v === "string" && v.trim().length <= max ? v.trim() : null;
    const applicant = clean(name, 120),
      address = clean(email, 254),
      number = clean(phone, 40),
      details = clean(message || "", 2000);
    if (
      !applicant ||
      !address ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) ||
      !number ||
      number.length < 6 ||
      details === null
    )
      fail("Enter your name, valid email, and phone number");
    if (consent !== true)
      fail("Your consent is required to submit an application");
    if (!["Email", "Phone"].includes(contactMethod))
      fail("Select your preferred contact method");
    const household = Number(householdSize);
    if (!Number.isInteger(household) || household < 1 || household > 20)
      fail("Household size must be between 1 and 20");
    const today = new Date().toISOString().slice(0, 10);
    if (
      typeof desiredMoveIn !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(desiredMoveIn) ||
      !Number.isFinite(Date.parse(desiredMoveIn)) ||
      new Date(desiredMoveIn).toISOString().slice(0, 10) !== desiredMoveIn ||
      desiredMoveIn < today
    )
      fail("Choose a valid move-in date today or later");
    const id = randomUUID(),
      reference =
        "APL-" + randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase(),
      time = new Date().toISOString();
    await db.transaction(async (tx) => {
      if (unitId && !(await listings(tx)).some((u) => u.id === unitId))
        fail(
          "That rental is no longer available. Choose another or submit a general application.",
          409,
        );
      const data = {
        name: applicant,
        email: address.toLowerCase(),
        phone: number,
        unitId: unitId || "",
        desiredMoveIn,
        notes: `Prospect application\nHousehold: ${household}\nPreferred contact: ${contactMethod}\n${details}`,
        publicReference: reference,
        submissionSource: "Public website",
        consentAt: time,
      };
      await tx.exec(
        "INSERT INTO records (id,module,data,status,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6)",
        [id, "applications", JSON.stringify(data), "New", time, time],
      );
      await tx.exec(
        "INSERT INTO audit (id,actor_id,actor_name,action,module,record_id,detail,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          randomUUID(),
          "public-prospect",
          "Prospect applicant",
          "Submitted public application",
          "applications",
          id,
          reference,
          time,
        ],
      );
    });
    res
      .status(201)
      .json({
        reference,
        message:
          "Application received. Our leasing team will review your details and contact you.",
      });
  });
}
