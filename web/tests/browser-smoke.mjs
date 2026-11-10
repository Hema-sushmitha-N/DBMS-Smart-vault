import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
const folder = path.resolve("../report/screenshots");
await fs.mkdir(folder, { recursive: true });
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.status() >= 500 && r.url().includes("/api/"))
    errors.push(r.status() + " " + r.url());
});
await page.goto("http://127.0.0.1:3080/login");
await page.screenshot({
  path: path.join(folder, "01_login.png"),
  fullPage: true,
  caret: "initial",
});
await page
  .getByLabel("Email address", { exact: true })
  .fill("asha@smartvault.example");
await page.getByLabel("Password", { exact: true }).fill("VaultAdmin!2026");
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.waitForURL("**/dashboard");
await page.getByText("Stock across your warehouses").waitFor();
await page.waitForTimeout(500);
await page.screenshot({
  path: path.join(folder, "02_dashboard.png"),
  fullPage: true,
  caret: "initial",
});
for (const [section, file, wait] of [
  ["inventory", "03_inventory.png", "stock positions"],
  ["orders", "04_orders.png", "PO-0001"],
  ["alerts", "12_alerts.png", "Unusual stock movements"],
  ["patterns", "05_patterns.png", "Closest inventory patterns"],
  ["reports", "06_reports.png", "Your results will appear here"],
  ["catalog", "07_catalog.png", "Wireless Mouse"],
  ["users", "08_users.png", "Workspace members"],
]) {
  await page.goto("http://127.0.0.1:3080/dashboard/" + section);
  await page
    .getByText(wait, { exact: false })
    .first()
    .waitFor({ timeout: 30000 });
  if (section === "reports") {
    await page.getByRole("button", { name: "Category hierarchy" }).click();
    await page.getByRole("button", { name: "Run report" }).click();
    await page
      .getByRole("cell", { name: "Computer peripherals", exact: true })
      .waitFor();
  }
  await page.screenshot({
    path: path.join(folder, file),
    fullPage: true,
    caret: "initial",
  });
}
await page.setViewportSize({ width: 390, height: 844 });
await page.goto("http://127.0.0.1:3080/dashboard");
await page.getByText("Stock across your warehouses").waitFor();
await page.screenshot({
  path: path.join(folder, "09_mobile.png"),
  fullPage: true,
  caret: "initial",
});
await fs.writeFile(
  path.resolve("../report/browser_smoke.json"),
  JSON.stringify({ errors, screenshots: 10 }, null, 2),
);
await browser.close();
if (errors.length) throw Error(errors.join("\n"));
console.log(
  "PASS: live Admin navigation, report execution, desktop/mobile rendering; 10 screenshots captured.",
);
