"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const { installAGroupRobotContext } = require("./a-group-multi-robot-fixture");
const { TruckDriverBot } = require("./bots/truck-driver-bot");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST汽车进入煤卸载区后自动记录煤趟次并更新生产看板", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
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
      const ext = path.extname(file).toLowerCase();
      const contentType = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" }[ext] || "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  const originalGoto = page.goto.bind(page);
  page.goto = (url, options) => originalGoto(new URL(url, ORIGIN + "/").href, options);
  await page.goto(`${ORIGIN}/index.html`, { waitUntil: "domcontentloaded" });
  await installAGroupRobotContext(page, "TEST-A-D-001");
  const bot = new TruckDriverBot(page);
  await bot.installTestGpsBeforeOpen();
  await bot.open();
  const context = await bot.assertSafeContext();
  expect(context.profile.personId).toBe("TEST-A-D-001");
  expect(context.task.taskId).toMatch(/^TEST-/);

  await page.evaluate(() => {
    const zones = JSON.parse(localStorage.getItem("transportZones") || "[]");
    const unloadingZone = zones.find(zone => zone.zoneId === "TEST-UNLOAD-WASTE");
    if (!unloadingZone) throw new Error("缺少TEST卸载区");
    unloadingZone.materialType = "煤";
    localStorage.setItem("transportZones", JSON.stringify(zones));
  });
  const configuredZone = await page.evaluate(() => JSON.parse(localStorage.getItem("transportZones") || "[]").find(zone => zone.zoneId === "TEST-UNLOAD-WASTE"));
  expect(configuredZone).toMatchObject({ zoneType: "unloading", materialType: "煤" });

  const result = await bot.testNormalTransportClosedLoop({ expectedMaterialType: "煤" });
  expect(result.materialType).toBe("煤");
  const driverTrips = await bot.readLocalStorage("driverTripRecords");
  await expect.poll(async () => (await bot.readLocalStorage("tripRecords") || []).length, { timeout: 5000 }).toBe(1);
  const canonicalTrips = await bot.readLocalStorage("tripRecords");
  expect(driverTrips).toHaveLength(1);
  expect(canonicalTrips).toHaveLength(1);
  expect(canonicalTrips[0]).toMatchObject({ tripId: driverTrips[0].tripId, materialType: "煤", unloadingZoneId: "TEST-UNLOAD-WASTE", officialCountEligible: true });

  await page.goto(`${ORIGIN}/driver-work.html`, { waitUntil: "domcontentloaded" });
  await page.locator('#production-board [data-action="toggle"]').click();
  const board = page.locator("#production-board");
  await expect(board).toContainText(/当日总趟数\s*1/);
  await expect(board).toContainText(/A组总趟数\s*1/);
  await expect(board).toContainText(/A组煤总趟数\s*1/);
  await expect(board).toContainText(/A组渣总趟数\s*0/);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
