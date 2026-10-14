"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGk0AAAAASUVORK5CYII=", "base64");

test("TEST设备正常用车前检查校验仪表递增、保存记录并锁定", async ({ page }) => {
  const errors = [];
  const blocked = [];
  const dialogs = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    await dialog.accept();
  });
  await page.addInitScript(() => {
    const personId = "TEST-DRIVER-CHECK-NORMAL-001";
    if (!localStorage.getItem("TEST-HARNESS-EQUIPMENT-INIT")) {
      localStorage.setItem("personnelRecords", JSON.stringify([{
        personId, employeeId: personId, employeeNo: personId,
        name: "TEST正常检查司机", position: "汽车司机", team: "生产A组",
        status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true
      }]));
      localStorage.setItem("currentPersonId", personId);
      localStorage.setItem("selectedPosition", "汽车司机");
      localStorage.setItem("equipmentMeterReadings", JSON.stringify([{
        meterRecordId: "TEST-METER-PREV-001", equipmentId: "TEST-PK-NORMAL-01",
        equipmentNumber: "TEST-PK-NORMAL-01", reading: 100, unit: "km", createdAt: "2026-10-01T00:00:00.000Z", testFixture: true
      }]));
      for (const key of ["equipmentUsageChecks", "equipmentUsageRecords", "maintenanceRequests", "maintenanceAlerts"]) localStorage.setItem(key, "[]");
      localStorage.setItem("TEST-HARNESS-EQUIPMENT-INIT", "1");
    }
  });
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!["GET", "HEAD"].includes(request.method()) || url.origin !== ORIGIN) {
      blocked.push(`${request.method()} ${request.url()}`);
      return route.abort();
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const ext = path.extname(file);
      const contentType = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body: await fs.readFile(file) });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  await page.goto(`${ORIGIN}/equipment-check.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => setMode("usage"));
  await page.getByRole("button", { name: /② 当前人员与设备/ }).click();
  await page.getByRole("button", { name: /③ 设备读数/ }).click();
  await page.locator("#manualVehicleType").selectOption("皮卡");
  await page.locator("#manualVehicleNumber").fill("TEST-PK-NORMAL-01");
  await page.locator("#usagePurpose").fill("TEST日常巡检");
  await page.locator("#meterPhotoInput").setInputFiles({ name: "meter.png", mimeType: "image/png", buffer: PNG });
  await page.waitForFunction(() => typeof meterPhoto === "string" && meterPhoto.length > 0);
  await page.locator("#meterReading").fill("99");
  await page.locator("#okBox").click();
  await page.getByRole("button", { name: "✅ 提交并锁定" }).click();
  await expect.poll(() => dialogs.at(-1)?.message).toContain("当前读数不能低于上一条有效读数 100 km");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("equipmentUsageChecks") || "[]"))).toHaveLength(0);

  await page.locator("#meterReading").fill("100");
  await page.getByRole("button", { name: "✅ 提交并锁定" }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("equipmentUsageChecks") || "[]").length)).toBe(1);
  const saved = await page.evaluate(() => ({
    checks: JSON.parse(localStorage.getItem("equipmentUsageChecks") || "[]"),
    meters: JSON.parse(localStorage.getItem("equipmentMeterReadings") || "[]"),
    usage: JSON.parse(localStorage.getItem("equipmentUsageRecords") || "[]"),
    requests: JSON.parse(localStorage.getItem("maintenanceRequests") || "[]"),
    alerts: JSON.parse(localStorage.getItem("maintenanceAlerts") || "[]")
  }));
  expect(saved.checks).toHaveLength(1);
  expect(saved.checks[0]).toMatchObject({ equipmentId: "TEST-PK-NORMAL-01", result: "未见异常", meterReading: 100, meterUnit: "km", locked: true, usagePurpose: "TEST日常巡检" });
  expect(saved.meters).toHaveLength(2);
  expect(saved.usage).toHaveLength(1);
  expect(saved.usage[0]).toMatchObject({ checkId: saved.checks[0].checkId, result: "未见异常", meterReading: 100, purpose: "TEST日常巡检" });
  expect(saved.requests).toHaveLength(0);
  expect(saved.alerts).toHaveLength(0);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /② 当前人员与设备/ }).click();
  await page.getByRole("button", { name: /③ 设备读数/ }).click();
  await page.locator("#manualVehicleType").selectOption("皮卡");
  await page.locator("#manualVehicleNumber").fill("TEST-PK-NORMAL-01");
  await expect(page.locator("#lockedCard")).toBeVisible();
  await expect(page.locator("#formWrap")).toBeHidden();
  expect(await page.evaluate(() => ({
    checks: JSON.parse(localStorage.getItem("equipmentUsageChecks") || "[]").length,
    usage: JSON.parse(localStorage.getItem("equipmentUsageRecords") || "[]").length
  }))).toEqual({ checks: 1, usage: 1 });
  expect(dialogs.some(dialog => dialog.type === "confirm")).toBe(true);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
