"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGk0AAAAASUVORK5CYII=", "base64");

test("TEST 用车异常检查须留证并闭环生成待调度维修单", async ({ page }) => {
  const pageErrors = [];
  const blocked = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.addInitScript(() => {
    const personId = "TEST-DRIVER-CHECK-001";
    localStorage.setItem("personnelRecords", JSON.stringify([{ personId, employeeId: personId, employeeNo: personId, name: "TEST检查司机", position: "汽车司机", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true }]));
    localStorage.setItem("currentPersonId", personId);
    localStorage.setItem("selectedPosition", "汽车司机");
    localStorage.setItem("equipmentMaintenanceSettings", JSON.stringify([{ equipmentId: "TEST-PK-02", lastMaintenanceReading: 100, maintenanceInterval: 50, warningAdvance: 10, testFixture: true }]));
  });
  await page.route("**/*", async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (!['GET', 'HEAD'].includes(req.method()) || url.origin !== ORIGIN) {
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

  await page.goto(`${ORIGIN}/equipment-check.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => setMode("usage"));
  await page.getByRole("button", { name: /② 当前人员与设备/ }).click();
  await page.getByRole("button", { name: /③ 设备读数/ }).click();
  await page.locator("#manualVehicleType").selectOption("皮卡");
  await page.locator("#manualVehicleNumber").fill("TEST-PK-02");
  await page.locator("#usagePurpose").fill("TEST巡检");
  await page.locator("#meterReading").fill("145");
  await page.locator("#meterPhotoInput").setInputFiles({ name: "meter.png", mimeType: "image/png", buffer: PNG });
  await page.waitForFunction(() => typeof meterPhoto === "string" && meterPhoto.length > 0);
  await page.locator("#badBox").click();

  const alerts = [];
  page.on("dialog", async dialog => {
    if (dialog.type() === "alert") { alerts.push(dialog.message()); await dialog.accept(); }
    else if (dialog.type() === "confirm") { await dialog.accept(); }
  });
  await page.getByRole("button", { name: "✅ 提交并锁定" }).click();
  await expect.poll(() => alerts.at(-1)).toContain("必须填写说明并上传至少1张照片");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("equipmentUsageChecks") || "[]"))).toHaveLength(0);

  await page.getByRole("button", { name: /⑤ 异常情况/ }).click();
  await page.locator("#abnormalDescription").fill("TEST刹车异常");
  await page.locator("#abnormalPhotoInput").setInputFiles({ name: "abnormal.png", mimeType: "image/png", buffer: PNG });
  await page.waitForFunction(() => Array.isArray(abPhotos) && abPhotos.length > 0);
  await page.getByRole("button", { name: "✅ 提交并锁定" }).click();

  const saved = await page.evaluate(() => ({
    checks: JSON.parse(localStorage.getItem("equipmentUsageChecks") || "[]"),
    meters: JSON.parse(localStorage.getItem("equipmentMeterReadings") || "[]"),
    usage: JSON.parse(localStorage.getItem("equipmentUsageRecords") || "[]"),
    requests: JSON.parse(localStorage.getItem("maintenanceRequests") || "[]"),
    alerts: JSON.parse(localStorage.getItem("maintenanceAlerts") || "[]"),
    badge: document.querySelector("#maintenanceBadge")?.textContent
  }));
  expect(saved.checks).toHaveLength(1);
  expect(saved.checks[0]).toMatchObject({ equipmentId: "TEST-PK-02", personId: "TEST-DRIVER-CHECK-001", result: "发现异常", meterUnit: "km", locked: true });
  expect(saved.meters).toHaveLength(1);
  expect(saved.usage).toHaveLength(1);
  expect(saved.requests).toHaveLength(1);
  expect(saved.requests[0]).toMatchObject({ source: "equipment_usage_check", equipmentId: "TEST-PK-02", status: "pending_dispatch", dispatchRequired: true, description: "TEST刹车异常" });
  expect(saved.alerts).toHaveLength(1);
  expect(saved.badge).toContain("临近");
  expect(pageErrors).toEqual([]);
  expect(blocked).toEqual([]);
});
