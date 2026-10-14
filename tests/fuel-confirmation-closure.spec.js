"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGk0AAAAASUVORK5CYII=", "base64");

test("TEST 加油申请必须有数量和凭证，司机确认后更新库存和记录", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("fuelIntakeRecords", JSON.stringify([{ intakeId: "TEST-INTAKE-001", source: "TEST油罐", oilType: "柴油", amount: 1000, createdAt: new Date().toISOString(), testFixture: true }]));
    localStorage.setItem("fuelRequests", JSON.stringify([{ requestId: "TEST-FUEL-REQ-001", vehicleNumber: "TEST-A-T-001", driverName: "TEST司机", gpsStatus: "范围内", status: "waiting", requestedAt: new Date().toISOString(), testFixture: true }]));
    localStorage.setItem("fuelRecords", JSON.stringify([]));
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
      const contentType = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" }[ext] || "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });
  await page.goto(`${ORIGIN}/fuel.html`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-page="fueling"]').click();
  await expect(page.locator("#fuelQueueList")).toContainText("TEST-A-T-001");
  await page.locator("#fuelQueueList").getByRole("button", { name: "开始加油" }).click();
  await expect(page.locator("#fuelCompleteAmount")).toBeVisible();
  const alerts = [];
  page.on("dialog", async dialog => { alerts.push(dialog.message()); await dialog.accept(); });
  await page.locator("#fuelCompleteAmount").fill("120");
  await page.getByRole("button", { name: "提交加油完成" }).click();
  await expect.poll(() => alerts.at(-1)).toContain("必须拍摄或上传加油机照片");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fuelRecords") || "[]"))).toHaveLength(0);
  await page.locator("#fuelPhotoInput").setInputFiles({ name: "TEST-pump.png", mimeType: "image/png", buffer: PNG });
  await page.waitForFunction(() => typeof pendingFuelPhotoData === "string" && pendingFuelPhotoData.length > 0);
  await page.getByRole("button", { name: "提交加油完成" }).click();
  let records = await page.evaluate(() => JSON.parse(localStorage.getItem("fuelRecords") || "[]"));
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({ requestId: "TEST-FUEL-REQ-001", vehicleNumber: "TEST-A-T-001", amount: 120, confirmationStatus: "pending" });
  expect(records[0].photoData).toContain("data:image/jpeg");
  expect(await page.evaluate(() => calculateCurrentStock())).toBe(880);
  await page.locator('[data-page="history"]').click();
  await page.locator("#fuelHistoryList").getByRole("button", { name: "模拟司机确认" }).click();
  records = await page.evaluate(() => JSON.parse(localStorage.getItem("fuelRecords") || "[]"));
  expect(records[0].confirmationStatus).toBe("confirmed");
  await page.locator('[data-page="daily"]').click();
  await page.locator("#dailyDate").fill(await page.evaluate(() => getDateKey()));
  await page.getByRole("button", { name: "查询日报" }).click();
  await expect(page.locator("#dailyReportContent")).toContainText("120");
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
