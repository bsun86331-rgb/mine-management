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


test("TEST并发交错确认同一出库单时只扣一次库存并写入一条流水", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => { await dialog.accept(); });
  await page.addInitScript(() => {
    localStorage.setItem("personnelRecords", JSON.stringify([
      { personId: "TEST-WH-CONCURRENT-ADMIN", employeeNo: "TEST-WH-CONCURRENT-ADMIN", name: "TEST库管员", position: "库房管理", status: "approved", approvalStatus: "approved" }
    ]));
    localStorage.setItem("currentPersonId", "TEST-WH-CONCURRENT-ADMIN");
    localStorage.setItem("selectedPosition", "库房管理");
    localStorage.setItem("warehouseMaterials", JSON.stringify([
      { materialId: "TEST-WH-CONCURRENT-MAT", code: "TEST-WH-CONCURRENT-MAT", name: "TEST并发物资", category: "劳保用品", unit: "件", type: "consumable", availableQty: 8, issuedQty: 0, status: "active" }
    ]));
    localStorage.setItem("materialRequests", JSON.stringify([
      { requestId: "TEST-WH-CONCURRENT-REQ", personId: "TEST-WH-CONCURRENT-DRIVER", personName: "TEST司机", position: "汽车司机", materialId: "TEST-WH-CONCURRENT-MAT", materialName: "TEST并发物资", requestQuantity: 3, purpose: "TEST并发确认", status: "pending" }
    ]));
    localStorage.setItem("materialLedger", "[]");
  });
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!["GET", "HEAD"].includes(request.method()) || url.origin !== ORIGIN) {
      blocked.push(request.method() + " " + request.url());
      return route.abort();
    }
    const relative = url.pathname.split("/").filter(Boolean).join("/") || "index.html";
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const body = await fs.readFile(file);
      const ext = path.extname(file);
      const contentType = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing TEST asset" });
    }
  });
  await page.goto(`${ORIGIN}/warehouse.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const realPrompt = window.prompt;
    const alerts = [];
    let nested = false;
    window.alert = message => alerts.push(String(message));
    window.prompt = () => {
      if (!nested) {
        nested = true;
        window.prompt = () => "2";
        approveRequest("TEST-WH-CONCURRENT-REQ");
        window.prompt = realPrompt;
        return "3";
      }
      return "2";
    };
    approveRequest("TEST-WH-CONCURRENT-REQ");
    window.prompt = realPrompt;
    window.__TEST_DUP_APPROVAL_ALERTS__ = alerts;
  });
  const result = await page.evaluate(() => ({
    material: JSON.parse(localStorage.getItem("warehouseMaterials") || "[]")[0],
    request: JSON.parse(localStorage.getItem("materialRequests") || "[]")[0],
    ledger: JSON.parse(localStorage.getItem("materialLedger") || "[]"),
    alerts: window.__TEST_DUP_APPROVAL_ALERTS__
  }));
  expect(result.material).toMatchObject({ availableQty: 6, issuedQty: 2 });
  expect(result.request).toMatchObject({ status: "issued", actualQuantity: 2 });
  expect(result.ledger.filter(row => row.type === "出库")).toHaveLength(1);
  expect(result.ledger.find(row => row.type === "出库").quantity).toBe(2);
  expect(result.alerts.some(message => message.includes("已经处理"))).toBeTruthy();
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
