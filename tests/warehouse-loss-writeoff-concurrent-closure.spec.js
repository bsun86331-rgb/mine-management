"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST交错确认同一丢失记录时只核销一次", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => { await dialog.accept(); });

  await page.addInitScript(() => {
    localStorage.setItem("personnelRecords", JSON.stringify([
      { personId: "TEST-WH-LOSS-ADMIN", employeeNo: "TEST-WH-LOSS-ADMIN", name: "TEST库管员", position: "库房管理", status: "approved", approvalStatus: "approved" }
    ]));
    localStorage.setItem("currentPersonId", "TEST-WH-LOSS-ADMIN");
    localStorage.setItem("selectedPosition", "库房管理");
    localStorage.setItem("warehouseMaterials", JSON.stringify([
      { materialId: "TEST-WH-LOSS-MAT", code: "TEST-WH-LOSS-MAT", name: "TEST安全帽", type: "recyclable", availableQty: 0, issuedQty: 10, pendingLostQty: 2, scrappedQty: 0, status: "active" }
    ]));
    localStorage.setItem("materialHolders", JSON.stringify([
      { holderId: "TEST-WH-LOSS-HOLDER", personId: "TEST-WH-LOSS-DRIVER", personName: "TEST司机", materialId: "TEST-WH-LOSS-MAT", materialName: "TEST安全帽", quantity: 10, status: "holding" }
    ]));
    localStorage.setItem("materialLostRecords", JSON.stringify([
      { lostId: "TEST-WH-LOSS-001", personName: "TEST司机", materialId: "TEST-WH-LOSS-MAT", materialName: "TEST安全帽", quantity: 2, compensationAmount: 50, status: "pending_compensation" }
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
      const ext = path.extname(file).toLowerCase();
      const contentType = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing TEST asset" });
    }
  });

  await page.goto(`${ORIGIN}/warehouse.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const realConfirm = window.confirm;
    const alerts = [];
    let nested = false;
    window.alert = message => alerts.push(String(message));
    window.confirm = () => {
      if (!nested) {
        nested = true;
        window.confirm = () => true;
        confirmLostWriteOff("TEST-WH-LOSS-001");
        window.confirm = realConfirm;
        return true;
      }
      return true;
    };
    confirmLostWriteOff("TEST-WH-LOSS-001");
    window.confirm = realConfirm;
    window.__TEST_LOSS_WRITE_OFF_ALERTS__ = alerts;
  });

  const result = await page.evaluate(() => ({
    material: JSON.parse(localStorage.getItem("warehouseMaterials") || "[]")[0],
    holder: JSON.parse(localStorage.getItem("materialHolders") || "[]")[0],
    lost: JSON.parse(localStorage.getItem("materialLostRecords") || "[]")[0],
    ledger: JSON.parse(localStorage.getItem("materialLedger") || "[]"),
    alerts: window.__TEST_LOSS_WRITE_OFF_ALERTS__
  }));

  expect(result.material).toMatchObject({ issuedQty: 8, pendingLostQty: 0 });
  expect(result.holder).toMatchObject({ quantity: 8, status: "holding" });
  expect(result.lost).toMatchObject({ status: "written_off", quantity: 2 });
  const writeOffs = result.ledger.filter(row => row.type === "丢失核销");
  expect(writeOffs).toHaveLength(1);
  expect(writeOffs[0].quantity).toBe(2);
  expect(result.alerts.some(message => message.includes("已经处理"))).toBeTruthy();
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
