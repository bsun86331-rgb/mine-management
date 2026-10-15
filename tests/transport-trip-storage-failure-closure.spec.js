"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const { installAGroupRobotContext } = require("./a-group-multi-robot-fixture");
const { TruckDriverBot } = require("./bots/truck-driver-bot");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST本地趟次存储失败后可重试且不丢失运输趟次", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (!(["GET", "HEAD"].includes(req.method()) && url.origin === ORIGIN)) {
      blocked.push(`${req.method()} ${req.url()}`);
      return route.abort();
    }
    const file = path.resolve(ROOT, decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html");
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const ext = path.extname(file).toLowerCase();
      const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" }[ext] || "application/octet-stream";
      return route.fulfill({ status: 200, contentType: mime, body: await fs.readFile(file) });
    } catch {
      return route.fulfill({ status: 404, body: "missing" });
    }
  });
  const nativeGoto = page.goto.bind(page);
  page.goto = (url, options) => nativeGoto(new URL(url, ORIGIN + "/").href, options);

  await page.goto(`${ORIGIN}/index.html`, { waitUntil: "domcontentloaded" });
  await installAGroupRobotContext(page, "TEST-A-D-001");
  const bot = new TruckDriverBot(page);
  await bot.installTestGpsBeforeOpen();
  await bot.open();
  const context = await bot.assertSafeContext();
  expect(context.profile.personId).toBe("TEST-A-D-001");

  await page.evaluate(() => {
    const nativeSetItem = Storage.prototype.setItem;
    let failNextTripSave = true;
    Storage.prototype.setItem = function (key, value) {
      if (key === "driverTripRecords" && failNextTripSave) {
        failNextTripSave = false;
        throw new DOMException("TEST local storage quota fault", "QuotaExceededError");
      }
      return nativeSetItem.call(this, key, value);
    };
  });

  let firstAttemptError;
  try {
    await bot.testNormalTransportClosedLoop();
  } catch (error) {
    firstAttemptError = error;
  }
  expect(firstAttemptError?.message).toContain("没有恰好新增1条趟次记录");
  expect(firstAttemptError?.message).toContain("页面提示=趟次记录保存失败");
  const afterFailure = await page.evaluate(() => ({
    trips: JSON.parse(localStorage.getItem("driverTripRecords") || "[]"),
    cycle: JSON.parse(localStorage.getItem("driverTransportCycleState") || "null"),
    buttonDisabled: document.getElementById("addTripButton")?.disabled
  }));
  expect(afterFailure.trips).toHaveLength(0);
  expect(afterFailure.cycle?.completedAt || "").toBe("");
  expect(afterFailure.buttonDisabled).toBe(false);
  expect(errors.some(message => message.includes("QuotaExceededError"))).toBe(false);

  page.once("dialog", dialog => dialog.accept());
  await page.locator("#addTripButton").click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("driverTripRecords") || "[]").length === 1, null, { timeout: 5000 });
  const successfulRetry = await page.evaluate(() => ({
    trips: JSON.parse(localStorage.getItem("driverTripRecords") || "[]"),
    cycle: JSON.parse(localStorage.getItem("driverTransportCycleState") || "null")
  }));
  expect(successfulRetry.trips).toHaveLength(1);
  expect(successfulRetry.trips[0]).toMatchObject({ materialType: "渣", officialCountEligible: true });
  expect(successfulRetry.cycle?.phase).toBe("waiting_loading");
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

test("TEST运输完成标记存储失败时不锁死趟次且可重试", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (!( ["GET", "HEAD"].includes(req.method()) && url.origin === ORIGIN)) {
      blocked.push(`${req.method()} ${req.url()}`);
      return route.abort();
    }
    const file = path.resolve(ROOT, decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html");
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const ext = path.extname(file).toLowerCase();
      const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" }[ext] || "application/octet-stream";
      return route.fulfill({ status: 200, contentType: mime, body: await fs.readFile(file) });
    } catch {
      return route.fulfill({ status: 404, body: "missing" });
    }
  });
  const nativeGoto = page.goto.bind(page);
  page.goto = (url, options) => nativeGoto(new URL(url, ORIGIN + "/").href, options);

  await page.goto(`${ORIGIN}/index.html`, { waitUntil: "domcontentloaded" });
  await installAGroupRobotContext(page, "TEST-A-D-001");
  const bot = new TruckDriverBot(page);
  await bot.installTestGpsBeforeOpen();
  await bot.open();
  expect((await bot.assertSafeContext()).profile.personId).toBe("TEST-A-D-001");

  await page.evaluate(() => {
    const nativeSetItem = Storage.prototype.setItem;
    let failCompletionMarker = true;
    Storage.prototype.setItem = function (key, value) {
      if (key === "driverTransportCycleState" && failCompletionMarker) {
        let cycle;
        try { cycle = JSON.parse(value); } catch {}
        if (cycle?.completedAt) {
          failCompletionMarker = false;
          throw new DOMException("TEST completion marker quota fault", "QuotaExceededError");
        }
      }
      return nativeSetItem.call(this, key, value);
    };
  });

  let firstAttemptError;
  try {
    await bot.testNormalTransportClosedLoop();
  } catch (error) {
    firstAttemptError = error;
  }
  expect(firstAttemptError?.message).toContain("没有恰好新增1条趟次记录");
  expect(firstAttemptError?.message).toContain("运输闭环完成状态保存失败");
  const afterFailure = await page.evaluate(() => ({
    trips: JSON.parse(localStorage.getItem("driverTripRecords") || "[]"),
    cycle: JSON.parse(localStorage.getItem("driverTransportCycleState") || "null"),
    buttonDisabled: document.getElementById("addTripButton")?.disabled
  }));
  expect(afterFailure.trips).toHaveLength(0);
  expect(afterFailure.cycle?.phase).toBe("at_unloading");
  expect(afterFailure.cycle?.completedAt || "").toBe("");
  expect(afterFailure.buttonDisabled).toBe(false);

  page.once("dialog", dialog => dialog.accept());
  await page.locator("#addTripButton").click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("driverTripRecords") || "[]").length === 1, null, { timeout: 5000 });
  const successfulRetry = await page.evaluate(() => JSON.parse(localStorage.getItem("driverTripRecords") || "[]"));
  expect(successfulRetry).toHaveLength(1);
  expect(successfulRetry[0]).toMatchObject({ materialType: "渣", officialCountEligible: true });
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

