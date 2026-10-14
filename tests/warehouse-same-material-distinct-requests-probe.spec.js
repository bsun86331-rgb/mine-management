"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST同一物资的两张独立领用单分别出库后都保留", async ({ page }) => {
  const errors = [];
  const blocked = [];
  const dialogs = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => {
    dialogs.push(dialog.message());
    if (dialog.type() === "prompt") await dialog.accept("1");
    else await dialog.accept();
  });
  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, rawValue) {
      if (["materialRequests", "materialLedger"].includes(key)) {
        try {
          const rows = JSON.parse(rawValue);
          if (key === "materialRequests") (window.__requestWrites ||= []).push(rows.map(row => ({ requestId: row.requestId, personId: row.personId, materialId: row.materialId, status: row.status })));
          rawValue = JSON.stringify(rows);
        } catch {}
      }
      return originalSetItem.call(this, key, rawValue);
    };
    const people = [
      { personId: "TEST-WH-REQ-001", employeeNo: "TEST-WH-REQ-001", name: "TEST库管员", position: "库房管理", status: "approved", approvalStatus: "approved" },
      { personId: "TEST-DR-REQ-001", employeeNo: "TEST-DR-REQ-001", name: "TEST司机甲", position: "汽车司机", status: "approved", approvalStatus: "approved" },
      { personId: "TEST-DR-REQ-002", employeeNo: "TEST-DR-REQ-002", name: "TEST司机乙", position: "汽车司机", status: "approved", approvalStatus: "approved" }
    ];
    localStorage.setItem("personnelRecords", JSON.stringify(people));
    localStorage.setItem("currentPersonId", "TEST-WH-REQ-001");
    localStorage.setItem("selectedPosition", "库房管理");
    localStorage.setItem("warehouseMaterials", JSON.stringify([{ materialId: "TEST-MAT-REQ-001", code: "TEST-MAT-REQ-001", name: "TEST手套", category: "劳保用品", unit: "双", type: "consumable", availableQty: 5, issuedQty: 0, status: "active" }]));
    localStorage.setItem("materialRequests", JSON.stringify([
      { requestId: "TEST-REQ-SAME-MAT-001", personId: "TEST-DR-REQ-001", personName: "TEST司机甲", position: "汽车司机", materialId: "TEST-MAT-REQ-001", materialName: "TEST手套", requestQuantity: 1, requestType: "issue", status: "pending", purpose: "TEST甲申请" },
      { requestId: "TEST-REQ-SAME-MAT-002", personId: "TEST-DR-REQ-002", personName: "TEST司机乙", position: "汽车司机", materialId: "TEST-MAT-REQ-001", materialName: "TEST手套", requestQuantity: 1, requestType: "issue", status: "pending", purpose: "TEST乙申请" }
    ]));
    localStorage.setItem("materialHolders", "[]");
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
      const ext = path.extname(file);
      return route.fulfill({ status: 200, contentType: ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream", body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  await page.goto(`${ORIGIN}/warehouse.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => approveRequest("TEST-REQ-SAME-MAT-001"));
  await page.evaluate(() => approveRequest("TEST-REQ-SAME-MAT-002"));
  const state = await page.evaluate(() => ({
    requests: JSON.parse(localStorage.getItem("materialRequests") || "[]"),
    materials: JSON.parse(localStorage.getItem("warehouseMaterials") || "[]"),
    ledger: JSON.parse(localStorage.getItem("materialLedger") || "[]"),
    writes: window.__requestWrites || []
  }));
  console.log("TEST same-material distinct request readback:", JSON.stringify(state));
  await page.locator('[data-page="ledger"]').click();
  await page.screenshot({ path: "C:/Users/Administrator/Documents/Codex/2026-10-11/new-chat/outputs/证据_OPS-07_同物资领用流水重复_2026-10-14.png", fullPage: true });
  expect(state.requests).toHaveLength(2);
  expect(state.requests.map(row => row.requestId).sort()).toEqual(["TEST-REQ-SAME-MAT-001", "TEST-REQ-SAME-MAT-002"]);
  expect(state.requests.every(row => row.status === "issued" && row.actualQuantity === 1)).toBeTruthy();
  expect(state.materials[0]).toMatchObject({ availableQty: 3, issuedQty: 2 });
  expect(state.ledger.filter(row => row.materialId === "TEST-MAT-REQ-001")).toHaveLength(2);
  expect(state.ledger.map(row => row.personName).sort()).toEqual(["TEST司机乙", "TEST司机甲"].sort());
  expect(new Set(state.ledger.map(row => row.ledgerId)).size).toBe(2);
  expect(state.ledger.every(row => Boolean(row.ledgerId))).toBeTruthy();
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

