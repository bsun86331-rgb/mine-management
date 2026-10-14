"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

async function installRoute(page, blocked) {
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
}

test("TEST同一物资的两笔报废审批分别核销并保留各自记录", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("personnelRecords", JSON.stringify([{ personId: "TEST-WH-SCRAP-001", employeeNo: "TEST-WH-SCRAP-001", name: "TEST库管员", position: "库房管理", status: "approved", approvalStatus: "approved" }]));
    localStorage.setItem("currentPersonId", "TEST-WH-SCRAP-001");
    localStorage.setItem("selectedPosition", "库房管理");
    localStorage.setItem("warehouseMaterials", JSON.stringify([{ materialId: "TEST-MAT-SCRAP-001", code: "TEST-MAT-SCRAP-001", name: "TEST安全帽", category: "劳保用品", unit: "顶", type: "recyclable", availableQty: 0, issuedQty: 2, pendingScrapQty: 2, scrappedQty: 0, status: "active" }]));
    localStorage.setItem("materialHolders", JSON.stringify([{ holderId: "TEST-HOLD-SCRAP-001", personId: "TEST-PERSON-SCRAP-001", personName: "TEST员工", materialId: "TEST-MAT-SCRAP-001", materialName: "TEST安全帽", quantity: 2, status: "holding" }]));
    localStorage.setItem("materialScrapRecords", JSON.stringify([
      { scrapId: "TEST-SCRAP-001", materialId: "TEST-MAT-SCRAP-001", materialName: "TEST安全帽", quantity: 1, personName: "TEST员工", reason: "TEST第一件报废", status: "pending_approval" },
      { scrapId: "TEST-SCRAP-002", materialId: "TEST-MAT-SCRAP-001", materialName: "TEST安全帽", quantity: 1, personName: "TEST员工", reason: "TEST第二件报废", status: "pending_approval" }
    ]));
    localStorage.setItem("materialLedger", "[]");
    localStorage.setItem("materialRecycleRecords", "[]");
  });
  await installRoute(page, blocked);
  await page.goto(`${ORIGIN}/warehouse.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { approveScrap("TEST-SCRAP-001"); approveScrap("TEST-SCRAP-002"); });
  const state = await page.evaluate(() => ({
    scraps: JSON.parse(localStorage.getItem("materialScrapRecords") || "[]"),
    material: JSON.parse(localStorage.getItem("warehouseMaterials") || "[]")[0],
    ledger: JSON.parse(localStorage.getItem("materialLedger") || "[]")
  }));
  console.log("TEST same-material scrap close readback:", JSON.stringify(state));
  await page.locator('[data-page="ledger"]').click();
  await page.screenshot({ path: "C:/Users/Administrator/Documents/Codex/2026-10-11/new-chat/outputs/证据_OPS-07_同物资报废流水重复_2026-10-14.png", fullPage: true });
  expect(state.scraps.map(row => row.scrapId).sort()).toEqual(["TEST-SCRAP-001", "TEST-SCRAP-002"]);
  expect(state.scraps.every(row => row.status === "scrapped")).toBeTruthy();
  expect(state.material).toMatchObject({ issuedQty: 0, pendingScrapQty: 0, scrappedQty: 2 });
  expect(state.ledger.map(row => row.remark).sort()).toEqual(["TEST第一件报废", "TEST第二件报废"].sort());
  expect(new Set(state.ledger.map(row => row.ledgerId)).size).toBe(2);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

test("TEST同一物资的两笔丢失核销分别保留赔偿流水", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", dialog => dialog.accept());
  await page.addInitScript(() => {
    localStorage.setItem("personnelRecords", JSON.stringify([{ personId: "TEST-WH-LOSS-001", employeeNo: "TEST-WH-LOSS-001", name: "TEST库管员", position: "库房管理", status: "approved", approvalStatus: "approved" }]));
    localStorage.setItem("currentPersonId", "TEST-WH-LOSS-001");
    localStorage.setItem("selectedPosition", "库房管理");
    localStorage.setItem("warehouseMaterials", JSON.stringify([{ materialId: "TEST-MAT-LOSS-001", code: "TEST-MAT-LOSS-001", name: "TEST安全帽", category: "劳保用品", unit: "顶", type: "recyclable", availableQty: 0, issuedQty: 2, pendingLostQty: 2, status: "active" }]));
    localStorage.setItem("materialHolders", JSON.stringify([{ holderId: "TEST-HOLD-LOSS-001", personId: "TEST-PERSON-LOSS-001", personName: "TEST员工", materialId: "TEST-MAT-LOSS-001", materialName: "TEST安全帽", quantity: 2, status: "holding" }]));
    localStorage.setItem("materialLostRecords", JSON.stringify([
      { lostId: "TEST-LOST-001", materialId: "TEST-MAT-LOSS-001", materialName: "TEST安全帽", quantity: 1, personName: "TEST员工", compensationAmount: 10, status: "pending_compensation" },
      { lostId: "TEST-LOST-002", materialId: "TEST-MAT-LOSS-001", materialName: "TEST安全帽", quantity: 1, personName: "TEST员工", compensationAmount: 25, status: "pending_compensation" }
    ]));
    localStorage.setItem("materialLedger", "[]");
    localStorage.setItem("materialRecycleRecords", "[]");
  });
  await installRoute(page, blocked);
  await page.goto(`${ORIGIN}/warehouse.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { confirmLostWriteOff("TEST-LOST-001"); confirmLostWriteOff("TEST-LOST-002"); });
  const state = await page.evaluate(() => ({
    losses: JSON.parse(localStorage.getItem("materialLostRecords") || "[]"),
    material: JSON.parse(localStorage.getItem("warehouseMaterials") || "[]")[0],
    ledger: JSON.parse(localStorage.getItem("materialLedger") || "[]")
  }));
  console.log("TEST same-material loss close readback:", JSON.stringify(state));
  await page.locator('[data-page="ledger"]').click();
  await page.screenshot({ path: "C:/Users/Administrator/Documents/Codex/2026-10-11/new-chat/outputs/证据_OPS-07_同物资丢失流水重复_2026-10-14.png", fullPage: true });
  expect(state.losses.map(row => row.lostId).sort()).toEqual(["TEST-LOST-001", "TEST-LOST-002"]);
  expect(state.losses.every(row => row.status === "written_off")).toBeTruthy();
  expect(state.material).toMatchObject({ issuedQty: 0, pendingLostQty: 0 });
  expect(state.ledger.map(row => row.remark).sort()).toEqual(["赔偿金额：10", "赔偿金额：25"].sort());
  expect(new Set(state.ledger.map(row => row.ledgerId)).size).toBe(2);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

