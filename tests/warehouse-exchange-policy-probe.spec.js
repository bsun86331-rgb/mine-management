"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("D04-1 TEST以旧换新必须先回收验收才能出库", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  const dialogs = [];
  page.on("dialog", async dialog => { dialogs.push(dialog.message()); if (dialog.type() === "prompt") await dialog.accept("1"); else await dialog.accept(); });
  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, rawValue) {
      if (["materialRequests", "materialLedger", "materialHolders"].includes(key)) {
        try {
          const rows = JSON.parse(rawValue);
          const ids = { materialRequests: ["requestId"], materialLedger: ["ledgerId"], materialHolders: ["holderId"] }[key];
          for (const row of rows || []) for (const field of ids) if (row[field] && !String(row[field]).startsWith("TEST-")) row[field] = `TEST-${row[field]}`;
          rawValue = JSON.stringify(rows);
        } catch {}
      }
      return originalSetItem.call(this, key, rawValue);
    };
    if (!localStorage.getItem("personnelRecords")) {
      localStorage.setItem("personnelRecords", JSON.stringify([
        { personId: "TEST-DR-EX-001", name: "TEST申请人", employeeNo: "TEST-DR-EX-001", position: "汽车司机", status: "approved", approvalStatus: "approved" },
        { personId: "TEST-WH-EX-001", name: "TEST库管员", employeeNo: "TEST-WH-EX-001", position: "库房管理", status: "approved", approvalStatus: "approved" }
      ]));
      localStorage.setItem("currentPersonId", "TEST-DR-EX-001");
      localStorage.setItem("selectedPosition", "汽车司机");
      localStorage.setItem("warehouseMaterials", JSON.stringify([{ materialId: "TEST-MAT-EX-001", code: "TEST-MAT-EX-001", name: "TEST安全帽", category: "劳保用品", unit: "顶", type: "recyclable", availableQty: 2, issuedQty: 0, referencePrice: 30, status: "active" }]));
      localStorage.setItem("materialRequests", "[]");
      localStorage.setItem("materialHolders", "[]");
      localStorage.setItem("materialRecycleRecords", "[]");
      localStorage.setItem("materialLedger", "[]");
    }
  });
  await page.route("**/*", async route => {
    const req = route.request(); const url = new URL(req.url());
    if (!["GET", "HEAD"].includes(req.method()) || url.origin !== ORIGIN) { blocked.push(`${req.method()} ${req.url()}`); return route.abort(); }
    const file = path.resolve(ROOT, decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html");
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try { let body = await fs.readFile(file); if (["warehouse.html", "material-request.html"].includes(path.basename(file))) body = Buffer.from(body.toString("utf8").replace('return prefix + "_"', 'return "TEST-" + prefix + "_"')); return route.fulfill({ status: 200, contentType: path.extname(file) === ".html" ? "text/html; charset=utf-8" : "text/javascript; charset=utf-8", body }); }
    catch { return route.fulfill({ status: 404, body: "missing test asset" }); }
  });
  await page.goto(`${ORIGIN}/material-request.html`, { waitUntil: "domcontentloaded" });
  await page.locator("#materialSelect").selectOption("TEST-MAT-EX-001");
  await page.locator("#requestType").selectOption("exchange");
  await page.locator("#purpose").fill("TEST以旧换新申请");
  await page.getByRole("button", { name: "提交物料领用单" }).click();
  const request = await page.evaluate(() => JSON.parse(localStorage.getItem("materialRequests"))[0]);
  expect(request.requestType).toBe("exchange");
  await page.evaluate(() => { localStorage.setItem("currentPersonId", "TEST-WH-EX-001"); localStorage.setItem("selectedPosition", "库房管理"); });
  await page.goto(`${ORIGIN}/warehouse.html`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-page="requests"]').click();
  await page.locator("#requestList").getByRole("button", { name: "确认出库" }).click();
  const holders = await page.evaluate(() => JSON.parse(localStorage.getItem("materialHolders") || "[]"));
  const recycles = await page.evaluate(() => JSON.parse(localStorage.getItem("materialRecycleRecords") || "[]"));
  expect(holders).toHaveLength(0);
  expect(recycles).toHaveLength(0);
  const after = await page.evaluate(() => ({
    request: JSON.parse(localStorage.getItem("materialRequests") || "[]")[0],
    material: JSON.parse(localStorage.getItem("warehouseMaterials") || "[]")[0],
    ledger: JSON.parse(localStorage.getItem("materialLedger") || "[]")
  }));
  expect(after.request.status || "pending").toBe("pending");
  expect(after.material.availableQty).toBe(2);
  expect(after.ledger).toHaveLength(0);
  expect(dialogs.some(message => message.includes("需先归还同一员工的旧物"))).toBeTruthy();
  console.log("TEST exchange readback:", JSON.stringify({ request, holders, recycleRecords: recycles }));
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
