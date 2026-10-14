"use strict";
const { evidencePath } = require("./evidence-path.cjs");

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST同一员工领取两类可回收物资后持有记录都保留", async ({ page }) => {
  const errors = [];
  const blocked = [];
  const dialogs = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => { dialogs.push(dialog.message()); if (dialog.type() === "prompt") await dialog.accept("1"); else await dialog.accept(); });
  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, rawValue) {
      if (key === "materialHolders") {
        try { const rows = JSON.parse(rawValue); (window.__holderWrites ||= []).push({ rows: rows.map(row => ({ holderId: row.holderId, personId: row.personId, materialId: row.materialId })) }); } catch {}
      }
      return originalSetItem.call(this, key, rawValue);
    };
    const people = [
      { personId: "TEST-WH-HOLDER-001", employeeNo: "TEST-WH-HOLDER-001", name: "TEST库管员", position: "库房管理", status: "approved", approvalStatus: "approved" },
      { personId: "TEST-DR-HOLDER-001", employeeNo: "TEST-DR-HOLDER-001", name: "TEST司机", position: "汽车司机", status: "approved", approvalStatus: "approved" }
    ];
    localStorage.setItem("personnelRecords", JSON.stringify(people));
    localStorage.setItem("currentPersonId", "TEST-WH-HOLDER-001");
    localStorage.setItem("selectedPosition", "库房管理");
    localStorage.setItem("warehouseMaterials", JSON.stringify([
      { materialId: "TEST-MAT-HAT-001", code: "TEST-MAT-HAT-001", name: "TEST安全帽", category: "劳保用品", unit: "顶", type: "recyclable", availableQty: 5, issuedQty: 0, status: "active" },
      { materialId: "TEST-MAT-VEST-001", code: "TEST-MAT-VEST-001", name: "TEST反光背心", category: "劳保用品", unit: "件", type: "recyclable", availableQty: 5, issuedQty: 0, status: "active" }
    ]));
    localStorage.setItem("materialRequests", JSON.stringify([
      { requestId: "TEST-REQ-HAT-001", personId: "TEST-DR-HOLDER-001", personName: "TEST司机", position: "汽车司机", materialId: "TEST-MAT-HAT-001", materialName: "TEST安全帽", requestQuantity: 1, requestType: "issue", status: "pending", purpose: "TEST领取" },
      { requestId: "TEST-REQ-VEST-001", personId: "TEST-DR-HOLDER-001", personName: "TEST司机", position: "汽车司机", materialId: "TEST-MAT-VEST-001", materialName: "TEST反光背心", requestQuantity: 1, requestType: "issue", status: "pending", purpose: "TEST领取" }
    ]));
    localStorage.setItem("materialHolders", "[]");
    localStorage.setItem("materialLedger", "[]");
  });
  await page.route("**/*", async route => {
    const req = route.request(); const url = new URL(req.url());
    if (!["GET", "HEAD"].includes(req.method()) || url.origin !== ORIGIN) { blocked.push(`${req.method()} ${req.url()}`); return route.abort(); }
    const file = path.resolve(ROOT, decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html");
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try { let body = await fs.readFile(file); if (path.basename(file) === "warehouse.html") body = Buffer.from(body.toString("utf8").replace('return prefix + "_"', 'return "TEST-" + prefix + "_"')); const ext = path.extname(file); const contentType = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream"; return route.fulfill({ status: 200, contentType, body }); }
    catch { return route.fulfill({ status: 404, body: "missing test asset" }); }
  });

  await page.goto(`${ORIGIN}/warehouse.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => approveRequest("TEST-REQ-HAT-001"));
  await page.evaluate(() => approveRequest("TEST-REQ-VEST-001"));
  const holders = await page.evaluate(() => JSON.parse(localStorage.getItem("materialHolders") || "[]"));
  const active = holders.filter(row => row.status === "holding" && row.quantity > 0);
  console.log("TEST multiple holders after two distinct issues:", JSON.stringify(holders));
  console.log("TEST holder storage writes:", JSON.stringify(await page.evaluate(() => window.__holderWrites || [])));
  await page.locator('[data-page="holders"]').click();
  await page.screenshot({ path: evidencePath("证据_OPS-07_员工持有记录丢失", "warehouse-multiple-holders-same-person-probe"), fullPage: true });
  expect(active.map(row => row.materialId).sort()).toEqual(["TEST-MAT-HAT-001", "TEST-MAT-VEST-001"]);
  expect(new Set(active.map(row => row.holderId)).size).toBe(2);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
