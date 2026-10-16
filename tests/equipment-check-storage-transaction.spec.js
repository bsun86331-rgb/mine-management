"use strict";
const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGk0AAAAASUVORK5CYII=", "base64");

async function prepare(page, injectedFailure, priorState = {}) {
  const errors = [];
  const blocked = [];
  const dialogs = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
  await page.addInitScript(({ injectedFailure, priorState }) => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem("personnelRecords", JSON.stringify([{ personId: "TEST-EUC-DRIVER", employeeNo: "TEST-EUC-DRIVER", name: "TEST检查司机", position: "汽车司机", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用" }]));
    localStorage.setItem("currentPersonId", "TEST-EUC-DRIVER");
    localStorage.setItem("selectedPosition", "汽车司机");
    localStorage.setItem("equipmentMaintenanceSettings", JSON.stringify([{ equipmentId: "TEST-EUC-PICKUP", lastMaintenanceReading: 100, maintenanceInterval: 50, warningAdvance: 10 }]));
    localStorage.setItem("equipmentRecords", JSON.stringify([{ equipmentId: "TEST-EUC-PICKUP", equipmentNumber: "TEST-EUC-PICKUP", vehicleNumber: "TEST-EUC-PICKUP", equipmentType: "皮卡", status: "active" }]));
    for (const key of ["maintenanceRequests", "equipmentUsageChecks", "equipmentMeterReadings", "equipmentUsageRecords", "maintenanceAlerts"]) localStorage.setItem(key, JSON.stringify(priorState[key] || []));
    if (injectedFailure) {
      const realSetItem = Storage.prototype.setItem;
      let failOnce = true;
      Storage.prototype.setItem = function(key, value) {
        if (key === "equipmentUsageRecords" && String(value).length > 2 && failOnce) { failOnce = false; throw new DOMException("Injected one-time TEST quota error", "QuotaExceededError"); }
        return realSetItem.call(this, key, value);
      };
    }
  }, { injectedFailure, priorState });
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
      return route.fulfill({ status: 404, body: "missing TEST asset" });
    }
  });
  await page.goto(`${ORIGIN}/equipment-check.html`, { waitUntil: "domcontentloaded" });
  return { errors, blocked, dialogs };
}

async function submitAbnormalCheck(page) {
  await page.evaluate(() => setMode("usage"));
  await page.getByRole("button", { name: /② 当前人员与设备/ }).click();
  await page.getByRole("button", { name: /③ 设备读数/ }).click();
  await page.locator("#manualVehicleType").selectOption("皮卡");
  await page.locator("#manualVehicleNumber").fill("TEST-EUC-PICKUP");
  await page.locator("#usagePurpose").fill("TEST存储事务回归");
  await page.locator("#meterReading").fill("145");
  await page.locator("#meterPhotoInput").setInputFiles({ name: "TEST-meter.png", mimeType: "image/png", buffer: PNG });
  await page.waitForFunction(() => typeof meterPhoto === "string" && meterPhoto.length > 0);
  await page.locator("#badBox").click();
  await page.getByRole("button", { name: /⑤ 异常情况/ }).click();
  await page.locator("#abnormalDescription").fill("TEST刹车异常");
  for (let i = 0; i < 4; i++) {
    await page.locator("#abnormalPhotoInput").setInputFiles({ name: `TEST-abnormal-${i + 1}.png`, mimeType: "image/png", buffer: PNG });
    await page.waitForFunction(n => abPhotos.length >= n, i + 1);
  }
  await page.getByRole("button", { name: "✅ 提交并锁定" }).click();
}

for (const injectedFailure of [false, true]) {
  test(`TEST设备检查本机批量保存${injectedFailure ? "中途失败完整回滚" : "成功后记录互相引用"}`, async ({ page }) => {
    const { errors, blocked, dialogs } = await prepare(page, injectedFailure);
    await submitAbnormalCheck(page);
    const state = await page.evaluate(() => Object.fromEntries(["maintenanceRequests", "equipmentUsageChecks", "equipmentMeterReadings", "equipmentUsageRecords", "maintenanceAlerts"].map(key => [key, JSON.parse(localStorage.getItem(key) || "[]")])));
    if (injectedFailure) {
      for (const key of Object.keys(state)) expect(state[key], key).toHaveLength(0);
      expect(dialogs.some(message => message.includes("已取消并回滚"))).toBeTruthy();
    } else {
      for (const key of Object.keys(state)) expect(state[key], key).toHaveLength(1);
      const check = state.equipmentUsageChecks[0];
      const request = state.maintenanceRequests[0];
      expect(check.maintenanceRequestId).toBe(request.requestId);
      expect(request.checkId).toBe(check.checkId);
      expect(state.equipmentMeterReadings[0].checkId).toBe(check.checkId);
      expect(state.equipmentUsageRecords[0].checkId).toBe(check.checkId);
      expect(state.maintenanceAlerts[0].equipmentId).toBe("TEST-EUC-PICKUP");
    }
    expect(errors).toEqual([]);
    expect(blocked).toEqual([]);
  });
}


test("TEST设备检查中途失败时保留五类键内已有历史记录", async ({ page }) => {
  const priorState = {
    maintenanceRequests: [{ requestId: "TEST-OLD-MR", status: "pending_dispatch" }],
    equipmentUsageChecks: [{ checkId: "TEST-OLD-CHECK", equipmentId: "TEST-OLD-EQUIPMENT" }],
    equipmentMeterReadings: [{ meterRecordId: "TEST-OLD-METER", equipmentId: "TEST-OLD-EQUIPMENT" }],
    equipmentUsageRecords: [{ usageId: "TEST-OLD-USAGE", equipmentId: "TEST-OLD-EQUIPMENT" }],
    maintenanceAlerts: [{ alertId: "TEST-OLD-ALERT", equipmentId: "TEST-OLD-EQUIPMENT" }]
  };
  const { errors, blocked, dialogs } = await prepare(page, true, priorState);
  await submitAbnormalCheck(page);
  const state = await page.evaluate(() => Object.fromEntries(
    ["maintenanceRequests", "equipmentUsageChecks", "equipmentMeterReadings", "equipmentUsageRecords", "maintenanceAlerts"]
      .map(key => [key, JSON.parse(localStorage.getItem(key) || "[]")])
  ));
  expect(state).toEqual(priorState);
  expect(dialogs.some(message => message.includes("已取消并回滚"))).toBeTruthy();
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
