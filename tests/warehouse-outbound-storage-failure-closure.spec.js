"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST出库任一记录写入失败时库存申请和流水保持一致并可重试", async ({ page }) => {
  const errors = [];
  const blocked = [];
  const dialogs = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => {
    dialogs.push(dialog.message());
    if (dialog.type() === "prompt") await dialog.accept("3");
    else await dialog.accept();
  });

  await page.addInitScript(() => {
    localStorage.setItem("personnelRecords", JSON.stringify([
      { personId: "TEST-WH-OUT-001", name: "TEST库管员", position: "库房管理", status: "approved", approvalStatus: "approved" }
    ]));
    localStorage.setItem("currentPersonId", "TEST-WH-OUT-001");
    localStorage.setItem("selectedPosition", "库房管理");
    localStorage.setItem("warehouseMaterials", JSON.stringify([
      { materialId: "TEST-WH-OUT-MAT-001", code: "TEST-WH-OUT-MAT-001", name: "TEST手套", category: "劳保用品", unit: "双", type: "consumable", availableQty: 8, issuedQty: 0, status: "active" }
    ]));
    localStorage.setItem("materialRequests", JSON.stringify([
      { requestId: "TEST-WH-OUT-REQ-001", personId: "TEST-DR-001", personName: "TEST司机", position: "汽车司机", materialId: "TEST-WH-OUT-MAT-001", materialName: "TEST手套", requestQuantity: 3, purpose: "TEST出库故障验证", status: "pending" }
    ]));
    localStorage.setItem("materialLedger", "[]");
    window.__failLedgerWrite = true;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "materialLedger" && window.__failLedgerWrite) {
        window.__ledgerWriteFailed = true;
        throw new DOMException("TEST quota exceeded", "QuotaExceededError");
      }
      return original.call(this, key, value);
    };
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
  await expect.poll(() => page.evaluate(() => window.__ledgerWriteFailed)).toBe(true);
  const afterFailure = await page.evaluate(() => ({
    material: JSON.parse(localStorage.getItem("warehouseMaterials") || "[]")[0],
    request: JSON.parse(localStorage.getItem("materialRequests") || "[]")[0],
    ledger: JSON.parse(localStorage.getItem("materialLedger") || "[]")
  }));
  console.log("TEST outbound storage failure readback:", JSON.stringify(afterFailure));
  expect(afterFailure.material.availableQty).toBe(8);
  expect(afterFailure.material.issuedQty).toBe(0);
  expect(afterFailure.request.status).toBe("pending");
  expect(afterFailure.ledger).toHaveLength(0);

  await page.evaluate(() => { window.__failLedgerWrite = false; });
  await page.locator("#requestList").getByRole("button", { name: "确认出库" }).click();
  const afterRetry = await page.evaluate(() => ({
    material: JSON.parse(localStorage.getItem("warehouseMaterials") || "[]")[0],
    request: JSON.parse(localStorage.getItem("materialRequests") || "[]")[0],
    ledger: JSON.parse(localStorage.getItem("materialLedger") || "[]")
  }));
  expect(afterRetry.material).toMatchObject({ availableQty: 5, issuedQty: 3 });
  expect(afterRetry.request).toMatchObject({ status: "issued", actualQuantity: 3 });
  expect(afterRetry.ledger).toHaveLength(1);
  expect(afterRetry.ledger[0]).toMatchObject({ type: "出库", quantity: 3, materialId: "TEST-WH-OUT-MAT-001" });
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

