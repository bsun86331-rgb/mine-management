"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST同一出库单重复确认或刷新后重试不会重复扣库存", async ({ page }) => {
  const errors = [];
  const blocked = [];
  const dialogs = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    if (dialog.type() === "prompt") await dialog.accept("3");
    else await dialog.accept();
  });

  await page.addInitScript(() => {
    if (localStorage.getItem("TEST-WH-DUP-initialized")) return;
    localStorage.setItem("TEST-WH-DUP-initialized", "1");
    localStorage.setItem("personnelRecords", JSON.stringify([
      { personId: "TEST-WH-DUP-001", name: "TEST库管员", position: "库房管理", status: "approved", approvalStatus: "approved" }
    ]));
    localStorage.setItem("currentPersonId", "TEST-WH-DUP-001");
    localStorage.setItem("selectedPosition", "库房管理");
    localStorage.setItem("warehouseMaterials", JSON.stringify([
      { materialId: "TEST-WH-DUP-MAT-001", code: "TEST-WH-DUP-MAT-001", name: "TEST安全手套", category: "劳保用品", unit: "双", type: "consumable", availableQty: 8, issuedQty: 0, status: "active" }
    ]));
    localStorage.setItem("materialRequests", JSON.stringify([
      { requestId: "TEST-WH-DUP-REQ-001", personId: "TEST-DR-001", personName: "TEST司机", position: "汽车司机", materialId: "TEST-WH-DUP-MAT-001", materialName: "TEST安全手套", requestQuantity: 3, purpose: "TEST重复出库验证", status: "pending" }
    ]));
    localStorage.setItem("materialLedger", "[]");
  });

  await page.route("**/*", async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (!["GET", "HEAD"].includes(req.method()) || url.origin !== ORIGIN) {
      blocked.push(`${req.method()} ${req.url()}`);
      return route.abort();
    }
    const file = path.resolve(ROOT, decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html");
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const body = await fs.readFile(file);
      return route.fulfill({ status: 200, contentType: path.extname(file) === ".html" ? "text/html; charset=utf-8" : "text/javascript; charset=utf-8", body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  await page.goto(`${ORIGIN}/warehouse.html`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-page="requests"]').click();
  await page.locator("#requestList").getByRole("button", { name: "确认出库" }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("materialRequests"))[0].status)).toBe("issued");

  // Simulate a stale action and a post-refresh retry against the same request ID.
  await page.evaluate(() => approveRequest("TEST-WH-DUP-REQ-001"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.evaluate(() => approveRequest("TEST-WH-DUP-REQ-001"));

  const result = await page.evaluate(() => ({
    material: JSON.parse(localStorage.getItem("warehouseMaterials") || "[]")[0],
    request: JSON.parse(localStorage.getItem("materialRequests") || "[]")[0],
    ledger: JSON.parse(localStorage.getItem("materialLedger") || "[]")
  }));
  console.log("TEST duplicate outbound readback:", JSON.stringify({ result, dialogs }));
  expect(result.material).toMatchObject({ availableQty: 5, issuedQty: 3 });
  expect(result.request).toMatchObject({ status: "issued", actualQuantity: 3 });
  expect(result.ledger.filter(row => row.type === "出库")).toHaveLength(1);
  expect(dialogs.filter(item => item.type === "prompt")).toHaveLength(1);
  expect(dialogs.filter(item => item.type === "alert").length).toBeGreaterThanOrEqual(2);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
