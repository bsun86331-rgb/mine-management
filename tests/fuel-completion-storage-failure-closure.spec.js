"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGk0AAAAASUVORK5CYII=", "base64");

test("TEST加油完成记录或申请状态写入失败时库存流水闭环回滚且可重试", async ({ page }) => {
  const errors = [];
  const blocked = [];
  const dialogs = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
  await page.addInitScript(() => {
    localStorage.setItem("currentPersonId", "TEST-FUEL-OPERATOR");
    localStorage.setItem("selectedPosition", "加油车司机");
    localStorage.setItem("fuelIntakeRecords", JSON.stringify([
      { intakeId: "TEST-FUEL-INTAKE-001", source: "TEST油罐", oilType: "柴油", amount: 1000, createdAt: new Date().toISOString(), testFixture: true }
    ]));
    localStorage.setItem("fuelRequests", JSON.stringify([
      { requestId: "TEST-FUEL-REQ-001", vehicleNumber: "TEST-A-T-001", driverName: "TEST司机甲", gpsStatus: "范围内", status: "waiting", requestedAt: new Date().toISOString(), testFixture: true },
      { requestId: "TEST-FUEL-REQ-002", vehicleNumber: "TEST-A-T-002", driverName: "TEST司机乙", gpsStatus: "范围内", status: "waiting", requestedAt: new Date().toISOString(), testFixture: true }
    ]));
    localStorage.setItem("fuelRecords", "[]");
    window.__failKey = "";
    window.__failedKeys = [];
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === window.__failKey) {
        window.__failedKeys.push(key);
        throw new DOMException("TEST quota exceeded", "QuotaExceededError");
      }
      return original.call(this, key, value);
    };
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
      return route.fulfill({ status: 200, contentType: { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" }[ext] || "application/octet-stream", body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  const setFailure = key => page.evaluate(value => { window.__failKey = value; }, key);
  const fillPumpPhoto = async amount => {
    await page.locator("#fuelCompleteAmount").fill(String(amount));
    await page.locator("#fuelPhotoInput").setInputFiles({ name: "TEST-pump.png", mimeType: "image/png", buffer: PNG });
    await page.waitForFunction(() => typeof pendingFuelPhotoData === "string" && pendingFuelPhotoData.length > 0);
  };
  const getState = () => page.evaluate(() => ({
    requests: JSON.parse(localStorage.getItem("fuelRequests") || "[]"),
    records: JSON.parse(localStorage.getItem("fuelRecords") || "[]"),
    stock: calculateCurrentStock(),
    amount: document.getElementById("fuelCompleteAmount")?.value,
    photoRetained: Boolean(pendingFuelPhotoData)
  }));

  await page.goto(`${ORIGIN}/fuel.html`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-page="fueling"]').click();
  await page.locator("#fuelQueueList").getByRole("button", { name: "开始加油" }).first().click();
  await fillPumpPhoto(120);
  await setFailure("fuelRecords");
  await page.getByRole("button", { name: "提交加油完成" }).click();
  await expect.poll(() => page.evaluate(() => window.__failedKeys.length)).toBeGreaterThan(0);
  let state = await getState();
  expect(state.requests.find(item => item.requestId === "TEST-FUEL-REQ-001").status).toBe("fueling");
  expect(state.records).toHaveLength(0);
  expect(state.stock).toBe(1000);
  expect(state.amount).toBe("120");
  expect(state.photoRetained).toBe(true);

  await setFailure("");
  await page.getByRole("button", { name: "提交加油完成" }).click();
  state = await getState();
  expect(state.requests.find(item => item.requestId === "TEST-FUEL-REQ-001").status).toBe("completed");
  expect(state.records).toHaveLength(1);
  expect(state.stock).toBe(880);

  await page.locator("#fuelQueueList").getByRole("button", { name: "开始加油" }).first().click();
  await fillPumpPhoto(30);
  await setFailure("fuelRequests");
  await page.getByRole("button", { name: "提交加油完成" }).click();
  await expect.poll(() => page.evaluate(() => window.__failedKeys.length)).toBeGreaterThan(1);
  state = await getState();
  expect(state.requests.find(item => item.requestId === "TEST-FUEL-REQ-002").status).toBe("fueling");
  expect(state.records).toHaveLength(1);
  expect(state.records[0].requestId).toBe("TEST-FUEL-REQ-001");
  expect(state.stock).toBe(880);
  expect(state.amount).toBe("30");
  expect(state.photoRetained).toBe(true);

  await setFailure("");
  await page.getByRole("button", { name: "提交加油完成" }).click();
  state = await getState();
  expect(state.requests.find(item => item.requestId === "TEST-FUEL-REQ-002").status).toBe("completed");
  expect(state.records).toHaveLength(2);
  expect(state.records.map(item => item.amount)).toEqual([120, 30]);
  expect(state.stock).toBe(850);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

