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
    .getByRole("heading", { name: "Portfolio overview", exact: true })
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
  await page
    .getByRole("button", { name: "Settings & help", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Explore 200 capabilities", exact: true })
    .click();
  assert.equal(await page.locator(".feature-grid li").count(), 200);
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
  assert.deepEqual(errors, []);
  console.log(
    "Browser checks passed: private one-time activation, sample data, 20 module views/search/filter/sort/export/archive, task create/edit/action/archive/restore, 200 feature entries, calendar, mobile navigation and overflow.",
  );
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
  await db.close();
  rmSync(dir, { recursive: true, force: true });
}
