import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { spawn, spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import pg from "pg";
import { chromium, expect } from "@playwright/test";
process.loadEnvFile(".env.local");
const root = path.resolve(".."),
  cfg = JSON.parse(
    fs.readFileSync(path.join(root, ".local/connection.json"), "utf8"),
  ),
  bin = path.join(root, ".tools/pgsql/bin");
const qa = "smartvault_qa_" + Date.now(),
  folder = path.join(root, ".local", qa);
await fsp.mkdir(folder, { recursive: true });
const db = new pg.Client({
  host: cfg.host,
  port: cfg.port,
  user: cfg.username,
  password: cfg.password,
  database: cfg.database,
});
await db.connect();
const evidence = {
  database: qa,
  isolated: true,
  checks: [],
  screenshots: [],
  started_at: new Date().toISOString(),
};
function pass(name) {
  evidence.checks.push({ name, status: "passed" });
  console.log("PASS: " + name);
}
const script = path.join(folder, "snapshot.sql");
function command(exe, args) {
  const r = spawnSync(path.join(bin, exe), args, {
    env: { ...process.env, PGPASSWORD: cfg.password },
    windowsHide: true,
    encoding: "utf8",
  });
  if (r.status !== 0) throw Error(r.stderr);
}
let server,
  browser,
  qaDb,
  okay = false;
try {
  await db.query('CREATE DATABASE "' + qa + '"');
  command("pg_dump.exe", [
    "-h",
    cfg.host,
    "-p",
    String(cfg.port),
    "-U",
    cfg.username,
    "-d",
    cfg.database,
    "-n",
    "smartvault",
    "--no-owner",
    "--file",
    script,
  ]);
  command("psql.exe", [
    "-X",
    "-h",
    cfg.host,
    "-p",
    String(cfg.port),
    "-U",
    cfg.username,
    "-d",
    qa,
    "-v",
    "ON_ERROR_STOP=1",
    "-f",
    script,
  ]);
  await fsp.unlink(script);
  qaDb = new pg.Client({
    host: cfg.host,
    port: cfg.port,
    user: cfg.username,
    password: cfg.password,
    database: qa,
  });
  await qaDb.connect();
  const probe = net.createServer();
  await new Promise((r) => probe.listen(0, "127.0.0.1", r));
  const port = probe.address().port;
  await new Promise((r) => probe.close(r));
  const base = "http://127.0.0.1:" + port;
  process.env.DB_NAME = qa;
  process.env.APP_ORIGIN = base;
  process.env.VECTOR_DB_PATH = path.join(folder, "vectors");
  const { syncPatterns } = await import("../lib/vector.mjs");
  const { poolFor } = await import("../lib/db.mjs");
  await syncPatterns("ADMIN");
  await poolFor("ADMIN").end();
  const out = fs.openSync(path.join(folder, "server.log"), "a");
  server = spawn(
    process.execPath,
    [
      path.resolve("node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DB_NAME: qa,
        APP_ORIGIN: base,
        VECTOR_DB_PATH: path.join(folder, "vectors"),
      },
      stdio: ["ignore", out, out],
      windowsHide: true,
    },
  );
  fs.closeSync(out);
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(base + "/api/auth/me");
      if (r.status === 401) break;
    } catch {}
    if (server.exitCode !== null)
      throw Error(fs.readFileSync(path.join(folder, "server.log"), "utf8"));
    await new Promise((r) => setTimeout(r, 1000));
    if (i === 89) throw Error("QA server startup timeout");
  }
  browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const admin = await browser.newContext({
      baseURL: base,
      viewport: { width: 1440, height: 1000 },
      timezoneId: "Asia/Kolkata",
    }),
    staff = await browser.newContext({
      baseURL: base,
      viewport: { width: 1440, height: 1000 },
      timezoneId: "Asia/Kolkata",
    });
  assert.equal((await admin.request.get("/api/data/overview")).status(), 401);
  assert.equal(
    (
      await admin.request.post("/api/auth/login", {
        data: { email: "asha@smartvault.example", password: "incorrect" },
      })
    ).status(),
    401,
  );
  assert.equal(
    (
      await admin.request.post("/api/auth/login", {
        data: { email: "asha@smartvault.example", password: "VaultAdmin!2026" },
      })
    ).status(),
    200,
  );
  assert.ok(
    (await admin.cookies()).some(
      (c) =>
        c.name === "smartvault_session" &&
        c.httpOnly &&
        c.sameSite === "Strict",
    ),
  );
  pass(
    "Anonymous denial, incorrect-password rejection, and signed HttpOnly session",
  );
  assert.equal(
    (
      await staff.request.post("/api/auth/login", {
        data: { email: "ravi@smartvault.example", password: "VaultStaff!2026" },
      })
    ).status(),
    200,
  );
  for (const [endpoint, data] of [
    [
      "master_create",
      { resource: "categories", data: { category_name: "Denied" } },
    ],
    ["receive_order", { order_id: 1 }],
    [
      "user_create",
      {
        full_name: "Denied",
        email: "x@example.com",
        role: "ADMIN",
        password: "Forbidden!123",
      },
    ],
    ["vector_delete", { id: "1:1" }],
  ])
    assert.equal(
      (
        await staff.request.post("/api/operations/" + endpoint, { data })
      ).status(),
      403,
    );
  assert.equal(
    (
      await admin.request.post("/api/operations/master_create", {
        headers: { Origin: "https://untrusted.example" },
        data: { resource: "categories", data: { category_name: "CSRF check" } },
      })
    ).status(),
    403,
  );
  const users = await (await admin.request.get("/api/data/users")).json();
  assert.ok(users.rows.every((u) => !("password_hash" in u)));
  pass(
    "Staff API privilege boundaries, cross-origin rejection, and secret-field exclusion",
  );
  const page = await admin.newPage();
  page.setDefaultTimeout(15000);
  page.on("dialog", (d) => d.accept());
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(e.message));
  await page.goto(base + "/dashboard");
  await page.getByText("Stock across your warehouses").waitFor();
  await page.getByRole("link", { name: "Master data", exact: true }).click();
  await page.getByRole("button", { name: /^Categories/ }).click();
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Category name", { exact: true })
    .fill("QA category");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "QA category", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit QA category", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Category name", { exact: true })
    .fill("QA category updated");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "QA category updated", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete QA category updated", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "QA category updated", exact: true }),
  ).toHaveCount(0);
  pass("Admin UI master-record create, read, update, and delete");
  await page
    .getByRole("link", { name: "Purchase orders", exact: true })
    .click();
  await page.getByRole("button", { name: "New purchase order" }).click();
  await page.getByLabel("Line 1 product").selectOption("2");
  await page.getByLabel("Line 1 quantity").fill("5");
  await page.getByLabel("Line 1 unit cost").fill("800");
  const placed = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/operations/order") &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Place order", exact: true }).click();
  const orderId = (await (await placed).json()).id;
  assert.ok(orderId);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .locator(".order-card")
    .filter({ hasText: "PO-" + String(orderId).padStart(4, "0") })
    .click();
  await page
    .getByRole("button", { name: "Receive stock", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  assert.equal(
    (
      await qaDb.query(
        "SELECT status FROM smartvault.purchase_orders WHERE order_id=$1",
        [orderId],
      )
    ).rows[0].status,
    "RECEIVED",
  );
  assert.equal(
    (
      await qaDb.query(
        "SELECT quantity FROM smartvault.inventory WHERE product_id=2 AND warehouse_id=1",
      )
    ).rows[0].quantity,
    13,
  );
  assert.equal(
    (
      await qaDb.query(
        "SELECT status FROM smartvault.low_stock_alerts WHERE product_id=2 AND warehouse_id=1",
      )
    ).rows[0].status,
    "RESOLVED",
  );
  assert.equal(
    (
      await admin.request.post("/api/operations/receive_order", {
        data: { order_id: orderId },
      })
    ).status(),
    400,
  );
  await page.screenshot({
    path: path.join(root, "report/screenshots/10_received_order.png"),
    fullPage: true,
    caret: "initial",
  });
  evidence.screenshots.push("10_received_order.png");
  pass(
    "UI order creation and atomic receiving; low-stock resolution; duplicate receiving rejected",
  );
  const staffPage = await staff.newPage();
  staffPage.setDefaultTimeout(15000);
  await staffPage.goto(base + "/dashboard/movements");
  await expect(
    staffPage.getByRole("link", { name: "Users & access", exact: true }),
  ).toHaveCount(0);
  await staffPage
    .getByRole("button", { name: "Record movement", exact: true })
    .click();
  await staffPage
    .getByRole("dialog")
    .getByLabel("Quantity", { exact: true })
    .fill("2");
  await staffPage
    .getByRole("button", { name: "Save movement", exact: true })
    .click();
  await expect(staffPage.getByRole("dialog")).toHaveCount(0);
  let balances = (
    await qaDb.query(
      "SELECT quantity FROM smartvault.inventory WHERE product_id=1 AND warehouse_id IN(1,2) ORDER BY warehouse_id",
    )
  ).rows.map((r) => r.quantity);
  assert.deepEqual(balances, [23, 19]);
  const failed = await staff.request.post("/api/operations/movement", {
    data: {
      product_id: 1,
      source_warehouse_id: 1,
      destination_warehouse_id: 2,
      movement_type: "TRANSFER",
      quantity: 999999,
      note: "Rejected",
    },
  });
  assert.equal(failed.status(), 400);
  assert.deepEqual(
    (
      await qaDb.query(
        "SELECT quantity FROM smartvault.inventory WHERE product_id=1 AND warehouse_id IN(1,2) ORDER BY warehouse_id",
      )
    ).rows.map((r) => r.quantity),
    [23, 19],
  );
  assert.equal(
    (
      await qaDb.query(
        "SELECT performed_by FROM smartvault.stock_movements WHERE movement_type='TRANSFER' ORDER BY movement_id DESC LIMIT 1",
      )
    ).rows[0].performed_by,
    2,
  );
  await staffPage.screenshot({
    path: path.join(root, "report/screenshots/11_staff_workspace.png"),
    fullPage: true,
    caret: "initial",
  });
  evidence.screenshots.push("11_staff_workspace.png");
  pass(
    "Staff UI transfer, actor attribution, insufficient-stock rejection, and unchanged balances after failure",
  );
  await page
    .getByRole("link", { name: "Pattern intelligence", exact: true })
    .click();
  await page.getByText("Closest inventory patterns", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Edit note", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Review note")
    .fill("QA verified vector update");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(
    page.getByText("QA verified vector update", { exact: true }),
  ).toBeVisible();
  let patternRows = (
    await (await admin.request.get("/api/data/patterns")).json()
  ).rows;
  assert.equal(patternRows.length, 18);
  assert.ok(patternRows.some((r) => r.note === "QA verified vector update"));
  assert.equal(
    (
      await admin.request.post("/api/operations/vector_delete", {
        data: { id: "1:1" },
      })
    ).status(),
    200,
  );
  assert.equal(
    (await (await admin.request.get("/api/data/patterns")).json()).rows.length,
    17,
  );
  assert.equal(
    (
      await admin.request.post("/api/operations/vector_upsert", {
        data: { id: "1:1" },
      })
    ).status(),
    200,
  );
  const similar = await (
    await admin.request.get("/api/data/similar?id=1:1")
  ).json();
  assert.equal(similar.matches.length, 6);
  assert.ok(
    similar.matches.every(
      (r) => r.id !== "1:1" && Number.isFinite(r.similarity),
    ),
  );
  assert.ok(
    similar.matches.every(
      (r, i, a) => !i || a[i - 1].similarity >= r.similarity,
    ),
  );
  assert.equal(
    (
      await admin.request.get(
        "/api/data/similar?id=" + encodeURIComponent("1:1' OR true"),
      )
    ).status(),
    400,
  );
  pass(
    "Vector UI update, API delete/create, filtered ranked similarity, and injection rejection",
  );
  await page.getByRole("link", { name: "SQL reports", exact: true }).click();
  await page.getByRole("button", { name: "Category hierarchy" }).click();
  await page.getByRole("button", { name: "Run report" }).click();
  await expect(
    page.getByRole("cell", { name: "Computer peripherals", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reconcile balances" }).click();
  await page.getByRole("button", { name: "Run report" }).click();
  await expect(
    page.getByText("All balances reconcile", { exact: true }),
  ).toBeVisible();
  assert.deepEqual(consoleErrors, []);
  pass(
    "Client-side navigation, live recursive report, and ledger reconciliation",
  );
  assert.equal(
    (await staff.request.post("/api/auth/logout", { data: {} })).status(),
    200,
  );
  assert.equal((await staff.request.get("/api/data/inventory")).status(), 401);
  pass("Logout removes authenticated access");
  okay = true;
  evidence.status = "passed";
} catch (e) {
  evidence.status = "failed";
  evidence.error = e.stack;
  throw e;
} finally {
  if (browser) await browser.close();
  if (server?.pid)
    spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
  if (qaDb) await qaDb.end();
  if (okay) {
    await db.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1",
      [qa],
    );
    await db.query('DROP DATABASE "' + qa + '"');
  }
  const baseline = (
    await db.query(
      "SELECT SUM(quantity)::int AS units,COUNT(*)::int AS positions FROM smartvault.inventory",
    )
  ).rows[0];
  evidence.live_database = baseline;
  evidence.baseline_unchanged =
    baseline.units === 343 && baseline.positions === 18;
  evidence.finished_at = new Date().toISOString();
  await fsp.writeFile(
    path.join(root, "report/e2e_evidence.json"),
    JSON.stringify(evidence, null, 2),
  );
  await db.end();
}
console.log(
  "PASS: isolated end-to-end suite completed; live sample data preserved.",
);
