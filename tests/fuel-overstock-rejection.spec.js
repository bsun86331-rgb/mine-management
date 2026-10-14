"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGk0AAAAASUVORK5CYII=", "base64");

test("TEST加油量超过理论库存时拒绝提交且不扣库存", async ({ page }) => {
  const errors = [];
  const blocked = [];
  const dialogs = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
  await page.addInitScript(() => {
    localStorage.setItem("fuelIntakeRecords", JSON.stringify([{ intakeId: "TEST-INTAKE-LOW-001", source: "TEST油罐", oilType: "柴油", amount: 100, createdAt: new Date().toISOString(), testFixture: true }]));
    localStorage.setItem("fuelRequests", JSON.stringify([{ requestId: "TEST-FUEL-OVER-001", vehicleNumber: "TEST-TRUCK-OVER-001", driverName: "TEST司机", gpsStatus: "范围内", status: "waiting", requestedAt: new Date().toISOString(), testFixture: true }]));
    localStorage.setItem("fuelRecords", "[]");
  });
  await page.route("**/*", async route => {
    const req = route.request(); const url = new URL(req.url());
    if (!["GET", "HEAD"].includes(req.method()) || url.origin !== ORIGIN) { blocked.push(`${req.method()} ${req.url()}`); return route.abort(); }
    const file = path.resolve(ROOT, decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html");
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try { const body = await fs.readFile(file); const ext = path.extname(file); const contentType = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" }[ext] || "application/octet-stream"; return route.fulfill({ status: 200, contentType, body }); }
    catch { return route.fulfill({ status: 404, body: "missing test asset" }); }
  });

  await page.goto(`${ORIGIN}/fuel.html`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-page="fueling"]').click();
  await page.locator("#fuelQueueList").getByRole("button", { name: "开始加油" }).click();
  await page.locator("#fuelCompleteAmount").fill("150");
  await page.locator("#fuelPhotoInput").setInputFiles({ name: "TEST-pump.png", mimeType: "image/png", buffer: PNG });
  await page.waitForFunction(() => typeof pendingFuelPhotoData === "string" && pendingFuelPhotoData.length > 0);
  await page.getByRole("button", { name: "提交加油完成" }).click();
  await expect.poll(() => dialogs.at(-1)).toContain("不能大于当前理论库存");
  const records = await page.evaluate(() => JSON.parse(localStorage.getItem("fuelRecords") || "[]"));
  const requests = await page.evaluate(() => JSON.parse(localStorage.getItem("fuelRequests") || "[]"));
  expect(records).toHaveLength(0);
  expect(requests[0]).toMatchObject({ requestId: "TEST-FUEL-OVER-001", status: "fueling" });
  expect(await page.evaluate(() => calculateCurrentStock())).toBe(100);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
