import { chromium } from "playwright";
import { openDatabase } from "../server/db.js";
import { createApp } from "../server/app.js";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { modules } from "../shared/modules.js";
const dir = mkdtempSync(join(tmpdir(), "arcland-browser-"));
const db = await openDatabase({ file: join(dir, "qa.sqlite") });
const server = createApp(db, { setupToken: "local-browser-qa-token" }).listen(
  0,
  "127.0.0.1",
);
await new Promise((r) => server.once("listening", r));
const base = "http://127.0.0.1:" + server.address().port;
mkdirSync("test-results", { recursive: true });
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_PATH || undefined,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page
    .getByRole("heading", { name: "Better properties. Better possibilities." })
    .waitFor();
  await page.screenshot({ path: "test-results/homepage.png", fullPage: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(
    () => document.querySelector(".hero-photo-frame img")?.naturalWidth > 1000,
  );
  assert.equal(
    await page
      .locator(".hero-photo-frame img")
      .evaluate((e) => getComputedStyle(e).filter),
    "none",
  );
  await page
    .getByRole("button", { name: "View clear property photo", exact: true })
    .click();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.getByText("125%", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Close photo viewer", exact: true })
    .click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("button", { name: "Work & unwind", exact: true })
    .click();
  await page.getByRole("button", { name: "Find my vibe", exact: true }).click();
  await page
    .getByRole("heading", { name: "Work & unwind", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Try another vibe", exact: true })
    .click();
  await page.getByLabel("Monthly rent", { exact: true }).fill("2500");
  assert.match(
    await page.locator(".cost-results b").first().innerText(),
    /2,750/,
  );
  await page.getByLabel("Monthly rent", { exact: true }).fill("2000");
  for (const task of [
    "Choose your target move date",
    "Review the lease details",
    "Plan utilities and internet",
    "Measure your furniture",
    "Arrange your moving day",
    "Confirm your key collection",
  ])
    await page.getByLabel(task, { exact: true }).check();
  await page
    .getByText("Look at you, making moves!", { exact: false })
    .waitFor();
  await page
    .getByRole("button", { name: "Reset my checklist", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/homepage-first-screen.png",
    fullPage: false,
  });
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("heading", { name: "Build your foundation." }).waitFor();
  const activationToken = "a".repeat(64);
  const prepare = await fetch(base + "/api/auth/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Arcland-Request": "1" },
    body: JSON.stringify({
      setupToken: "local-browser-qa-token",
      activationToken,
      email: "qa@example.com",
      name: "Arcland Admin",
    }),
  });
  assert.equal(prepare.status, 201);
  await page.goto(base + "/#activate=" + activationToken);
  await page.getByRole("heading", { name: "Set your password." }).waitFor();
  await page
    .getByRole("button", { name: "Activate account", exact: true })
    .waitFor();
  assert.equal(
    await page.getByLabel("Email address").inputValue(),
    "qa@example.com",
  );
  assert.equal(await page.evaluate(() => window.location.hash), "");
  await page
    .getByLabel("Password", { exact: true })
    .fill("qa-local-password-123");
  await page
    .getByRole("button", { name: "Activate account", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Admin dashboard", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Settings & help", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Load sample portfolio", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Load sample data", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.evaluate(async () => {
    const d = await (await fetch("/api/bootstrap")).json();
    for (const unit of d.records
      .filter((r) => r.module === "units" && r.status === "Vacant")
      .slice(0, 2)) {
      const r = await fetch("/api/records/units/" + unit.id, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Arcland-Request": "1",
        },
        body: JSON.stringify({
          data: { ...unit, listing: "Public" },
          status: unit.status,
          version: unit.version,
        }),
      });
      if (!r.ok) throw new Error("Failed to publish test rental");
    }
  });

  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page
    .getByText("The Willow Residences", { exact: true })
    .first()
    .waitFor();
  await page.screenshot({ path: "test-results/dashboard.png", fullPage: true });
  for (const m of modules) {
    await page
      .locator("aside")
      .getByRole("button", { name: new RegExp("^" + m.label + "(\\s+\\d+)?$") })
      .click();
    await page.getByRole("heading", { name: m.label, exact: true }).waitFor();
    await page
      .getByLabel("Table density", { exact: true })
      .selectOption("compact");
    await page
      .getByLabel("Records per page", { exact: true })
      .selectOption("24");
    await page
      .getByRole("button", { name: "Advanced tools", exact: true })
      .click();
    await page.getByLabel("Filter field", { exact: true }).selectOption("name");
    await page
      .getByLabel("Field contains", { exact: true })
      .fill("NO ADVANCED MATCH");
    await page.getByRole("heading", { name: "No matching records." }).waitFor();
    await page.getByLabel("Field contains", { exact: true }).fill("");
    await page.getByLabel("Created from", { exact: true }).fill("2000-01-01");
    await page
      .getByLabel("Created through", { exact: true })
      .fill("2100-01-01");
    await page.getByLabel("Minimum", { exact: true }).fill("1");
    await page.getByLabel("Maximum", { exact: true }).fill("100");
    await page.getByLabel("New view name", { exact: true }).fill("QA " + m.id);
    await page.getByRole("button", { name: "Save view", exact: true }).click();
    await page
      .getByLabel("Saved views", { exact: true })
      .selectOption("QA " + m.id);
    await page
      .getByRole("button", { name: "Reset filters", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Advanced tools", exact: true })
      .click();
    await page
      .getByRole("button", { name: /^Bookmark / })
      .first()
      .click();
    await page.getByRole("button", { name: "Bookmarked", exact: true }).click();
    assert.equal(await page.locator("tbody tr").count(), 1);
    await page.getByRole("button", { name: "Bookmarked", exact: true }).click();
    await page
      .getByLabel("Select first 100 filtered records", { exact: true })
      .check();
    await page
      .locator(".bulk-bar")
      .getByRole("button", { name: "Clear", exact: true })
      .click();

    await page
      .getByLabel("Search records", { exact: true })
      .fill("NO MATCHING RECORD");
    await page.getByRole("heading", { name: "No matching records." }).waitFor();
    await page.getByLabel("Search records", { exact: true }).fill("");
    await page
      .getByLabel("Filter by status", { exact: true })
      .selectOption(m.statuses[0]);
    await page
      .getByLabel("Sort records", { exact: true })
      .selectOption("updatedAt");
    await page.getByLabel("Reverse sort direction").click();
    await page
      .getByLabel("Filter by status", { exact: true })
      .selectOption("all");
    const [dl] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export CSV", exact: true }).click(),
    ]);
    assert.match(dl.suggestedFilename(), new RegExp(m.id));
    await page.getByRole("button", { name: "Archive", exact: true }).click();
    await page
      .getByRole("heading", { name: "Nothing archived yet." })
      .waitFor();
    await page.getByRole("button", { name: "Archived", exact: true }).click();
  }
  await page
    .locator("aside")
    .getByRole("button", { name: "Tasks", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add task", exact: true })
    .first()
    .click();
  await page.getByLabel("Name / title").fill("Browser verified task");
  await page.getByLabel("Notes").fill("Created through the real UI");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "Browser verified task", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Record workspace", exact: true })
    .click();
  await page
    .getByLabel("New record tag", { exact: true })
    .fill("browser-review");
  await page.getByRole("button", { name: "Add tag", exact: true }).click();
  await page
    .getByRole("button", { name: "Follow record", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Pin for staff", exact: true })
    .click();
  await page.getByLabel("Follow-up date", { exact: true }).fill("2027-01-20");
  await page.getByRole("button", { name: "Set date", exact: true }).click();
  await page
    .getByLabel("Follow-up priority", { exact: true })
    .selectOption("High");
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page
    .getByRole("button", { name: "Request review", exact: true })
    .click();
  await page
    .getByLabel("Review reason", { exact: true })
    .fill("Ready for browser review");
  await page
    .getByRole("button", { name: "Save review notes", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Approve review", exact: true })
    .click();
  await page
    .locator(".hub-review-state")
    .getByText("Approved", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Checklist", exact: true }).click();
  await page
    .getByLabel("New checklist item", { exact: true })
    .fill("Browser verified step");
  await page
    .getByRole("button", { name: "Add checklist item", exact: true })
    .click();
  await page
    .getByLabel("Complete Browser verified step", { exact: true })
    .check();
  await page.getByText("1 of 1 complete", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Completeness", exact: true }).click();
  await page.getByText("Required fields complete", { exact: true }).waitFor();
  const [brief] = await Promise.all([
    page.waitForEvent("download"),
    page
      .getByRole("button", { name: "Download internal brief", exact: true })
      .click(),
  ]);
  assert.equal(brief.suggestedFilename(), "arcland-record-brief.txt");
  await page
    .getByLabel("Internal comment", { exact: true })
    .fill("Browser comment for this task.");
  await page.getByRole("button", { name: "Add comment", exact: true }).click();
  await page
    .getByText("Browser comment for this task.", { exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Record history", exact: true })
    .click();
  await page.getByText("Added internal comment", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Start task", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "Browser verified task", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByText("In progress", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Edit details", exact: true }).click();
  await page.getByLabel("Name / title").fill("Browser updated task");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "Browser updated task", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Archive record", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Archive record", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await page
    .getByRole("button", { name: "Browser updated task", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Restore record", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Restore record", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Archived", exact: true }).click();
  await page
    .getByLabel("Filter record tags", { exact: true })
    .selectOption("browser-review");
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page.getByLabel("Filter record tags", { exact: true }).selectOption("");
  await page.getByRole("button", { name: "Following", exact: true }).click();
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page.getByRole("button", { name: "Following", exact: true }).click();
  await page
    .getByRole("button", { name: "View followed record updates", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mark all updates read", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "You’re all caught up.", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByLabel("Select Browser updated task", { exact: true }).check();
  await page
    .getByRole("button", { name: "Duplicate selected", exact: true })
    .click();
  await page.getByLabel("Name / title").fill("Browser duplicate task");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page
    .getByLabel("Select Browser duplicate task", { exact: true })
    .check();
  await page.getByLabel("Bulk status", { exact: true }).selectOption("Done");
  await page
    .getByRole("button", { name: "Confirm bulk update", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page
    .getByLabel("Select Browser duplicate task", { exact: true })
    .check();
  await page.getByRole("button", { name: "Bulk archive", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm bulk update", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "Settings & help", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Explore 1200 capabilities", exact: true })
    .click();
  assert.equal(await page.locator(".feature-grid li").count(), 1200);
  await page.getByRole("button", { name: "Calendar", exact: true }).click();
  await page.locator(".calendar-day").first().waitFor();
  await page.getByLabel("Calendar month").fill("2026-12");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
  );
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page
    .locator("aside")
    .getByRole("button", { name: "Residents", exact: true })
    .click();
  await page.getByRole("heading", { name: "Residents", exact: true }).waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
  );
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.waitForTimeout(300);
  await page
    .getByRole("button", { name: "Team & access", exact: true })
    .click();
  const bootstrap = await page.evaluate(async () => {
    const r = await fetch("/api/bootstrap");
    return r.json();
  });
  const property = bootstrap.records.find(
    (r) => r.module === "properties" && r.name === "The Willow Residences",
  );
  const resident = bootstrap.records.find(
    (r) => r.module === "tenants" && r.name === "Olivia Bennett",
  );
  for (const role of ["agent", "tenant"]) {
    await page.getByRole("button", { name: "Add member", exact: true }).click();
    await page
      .getByLabel("Full name", { exact: true })
      .fill(role === "agent" ? "Jordan Agent" : "Olivia Tenant");
    await page.getByLabel("Email", { exact: true }).fill(role + "@example.com");
    await page
      .getByLabel("Initial password", { exact: true })
      .fill("portal-browser-password");
    await page.getByLabel("Role", { exact: true }).selectOption(role);
    if (role === "agent")
      await page
        .getByLabel("Assigned properties", { exact: true })
        .selectOption(property.id);
    else
      await page
        .getByLabel("Linked resident", { exact: true })
        .selectOption(resident.id);
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
  }
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  for (const role of ["agent", "tenant"]) {
    await page
      .getByLabel("Email address", { exact: true })
      .fill(role + "@example.com");
    await page
      .getByLabel("Password", { exact: true })
      .fill("portal-browser-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page
      .getByRole("heading", {
        name: role === "agent" ? "Agent dashboard" : "Tenant dashboard",
        exact: true,
      })
      .waitFor();
    assert.ok(page.url().endsWith("/dashboard"));
    await page.screenshot({
      path: "test-results/" + role + "-dashboard.png",
      fullPage: true,
    });
    if (role === "agent") {
      await page
        .locator(".portal-sidebar")
        .getByRole("button", { name: "Properties", exact: true })
        .click();
      await page
        .getByRole("button", { name: "The Willow Residences", exact: true })
        .waitFor();
      assert.equal(
        await page.getByText("Parkside Apartments", { exact: true }).count(),
        0,
      );
      await page
        .locator(".portal-sidebar")
        .getByRole("button", { name: "Tasks", exact: true })
        .click();
      await page.getByRole("button", { name: "Add task", exact: true }).click();
      await page.getByLabel("Name / title").fill("Agent browser task");
      await page
        .getByLabel("Property", { exact: true })
        .selectOption(property.id);
      await page
        .getByRole("button", { name: "Save record", exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page
        .getByRole("button", { name: "Agent browser task", exact: true })
        .waitFor();
    } else {
      await page
        .getByRole("button", { name: "Request maintenance", exact: true })
        .click();
      await page
        .getByLabel("Request title", { exact: true })
        .fill("Portal tap repair");
      await page
        .getByLabel("What’s happening?", { exact: true })
        .fill("The kitchen tap has a slow leak.");
      await page
        .getByRole("button", { name: "Submit request", exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page
        .locator(".portal-sidebar")
        .getByRole("button", { name: "My requests", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Portal tap repair", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Cancel this request", exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page.getByText("Cancelled", { exact: true }).waitFor();
      await page
        .locator(".portal-sidebar")
        .getByRole("button", { name: "Overview", exact: true })
        .click();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(300);
      await page.screenshot({
        path: "test-results/tenant-mobile.png",
        fullPage: true,
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        ),
        false,
      );
      await page
        .getByRole("button", { name: "Open navigation", exact: true })
        .click();
      await page
        .locator(".portal-sidebar")
        .getByRole("button", { name: "My lease", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "My lease", exact: true })
        .waitFor();
      await page.setViewportSize({ width: 1440, height: 1100 });
      await page.waitForTimeout(300);
    }
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
  }
  await page
    .getByRole("button", { name: "Back to homepage", exact: false })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: "test-results/homepage-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
  );
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.waitForTimeout(300);
  const saveRental = page
    .getByRole("button", { name: /^Save rental / })
    .first();
  await saveRental.click();
  assert.equal(await saveRental.getAttribute("aria-pressed"), "true");
  const compareBoxes = page.getByRole("checkbox", { name: /^Compare / });
  await compareBoxes.nth(0).check();
  await compareBoxes.nth(1).check();
  await page
    .getByRole("button", { name: "Compare my picks", exact: true })
    .click();
  assert.equal(await page.locator(".comparison-grid article").count(), 2);
  await page
    .getByRole("button", { name: "Close rental comparison", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Applications", exact: true }).click();
  await page
    .getByRole("heading", { name: "Make an introduction.", exact: true })
    .waitFor();
  await page.getByLabel("Full name").fill("Public Prospect");
  await page.getByLabel("Email address").fill("public-prospect@example.com");
  await page.getByLabel("Phone number").fill("4165550199");
  await page.getByLabel("Preferred move-in date").fill("2027-12-01");
  await page.locator('input[name="consent"]').check();
  await page
    .getByRole("button", { name: "Submit application", exact: true })
    .click();
  await page
    .getByRole("heading", {
      name: "We’ve received your application.",
      exact: true,
    })
    .waitFor();
  assert.match(
    await page.locator(".application-success strong").innerText(),
    /^APL-/,
  );
  await page.screenshot({
    path: "test-results/application-confirmation.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Browser checks passed: clear photo/zoom, vibe quiz, moving planner/checklist, rental favourites/comparison, record-workspace tags/follow-ups/reviews/checklists/briefs/updates, private one-time activation, sample data, 20 module views/search/filter/sort/export/archive, task create/edit/action/archive/restore, 1200 feature entries, calendar, account assignment, unified sign-in, agent and tenant dashboards, tenant requests, mobile navigation and overflow.",
  );
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
  await db.close();
  rmSync(dir, { recursive: true, force: true });
}
