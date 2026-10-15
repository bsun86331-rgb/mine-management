"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST入库流水保存失败时库存保持不变且可安全重试", async ({ page }) => {
  const errors = [];
  const blocked = [];
  const dialogs = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => {
    dialogs.push(dialog.message());
    await dialog.accept();
  });

  await page.addInitScript(() => {
    localStorage.setItem("personnelRecords", JSON.stringify([
      { personId: "TEST-WH-STORAGE-001", employeeNo: "TEST-WH-STORAGE-001", name: "TEST库管员", position: "库房管理", status: "approved", approvalStatus: "approved" }
    ]));
    localStorage.setItem("currentPersonId", "TEST-WH-STORAGE-001");
    localStorage.setItem("selectedPosition", "库房管理");
    localStorage.setItem("warehouseMaterials", JSON.stringify([
      { materialId: "TEST-WH-STORAGE-MAT-001", code: "TEST-WH-STORAGE-MAT-001", name: "TEST手套", category: "劳保用品", unit: "双", type: "consumable", availableQty: 2, issuedQty: 0, status: "active" }
    ]));
    localStorage.setItem("materialLedger", "[]");
    localStorage.setItem("materialRequests", "[]");
    window.__failLedgerWrite = true;
    const originalSetItem = Storage.prototype.setItem;
    window.__originalSetItem = originalSetItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "materialLedger" && window.__failLedgerWrite) {
        window.__ledgerWriteFailed = true;
        throw new DOMException("TEST quota exceeded", "QuotaExceededError");
      }
      return originalSetItem.call(this, key, value);
    };
  });

  await page.route("**/*", async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (!["GET", "HEAD"].includes(req.method()) || url.origin !== ORIGIN) {
      blocked.push(`${req.method()} ${req.url()}`);
      return route.abort();
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const body = await fs.readFile(file);
      const ext = path.extname(file);
      const contentType = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  await page.goto(`${ORIGIN}/warehouse.html`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-page="inbound"]').click();
  await page.locator("#inboundMaterial").selectOption("TEST-WH-STORAGE-MAT-001");
  await page.locator("#inboundQuantity").fill("5");
  await page.locator("#inboundSupplier").fill("TEST虚拟供应商");
  await page.getByRole("button", { name: "确认入库" }).click();
  await expect.poll(() => page.evaluate(() => window.__ledgerWriteFailed)).toBe(true);

  const afterFailure = await page.evaluate(() => ({
    material: JSON.parse(localStorage.getItem("warehouseMaterials") || "[]")[0],
    ledger: JSON.parse(localStorage.getItem("materialLedger") || "[]"),
    quantityInput: document.getElementById("inboundQuantity")?.value
  }));
  console.log("TEST warehouse failed-ledger write:", JSON.stringify(afterFailure));

  expect(afterFailure.material.availableQty).toBe(2);
  expect(afterFailure.ledger).toHaveLength(0);
  expect(afterFailure.quantityInput).toBe("5");
  await page.evaluate(() => { window.__failLedgerWrite = false; });
  await page.getByRole("button", { name: "确认入库" }).click();
  const afterRetry = await page.evaluate(() => ({
    material: JSON.parse(localStorage.getItem("warehouseMaterials") || "[]")[0],
    ledger: JSON.parse(localStorage.getItem("materialLedger") || "[]")
  }));
  expect(afterRetry.material.availableQty).toBe(7);
  expect(afterRetry.ledger).toHaveLength(1);
  expect(afterRetry.ledger[0]).toMatchObject({ type: "入库", quantity: 5, materialId: "TEST-WH-STORAGE-MAT-001" });
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

