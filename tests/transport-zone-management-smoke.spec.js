"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST调度创建煤卸载区并阻止无物料或重复命名", async ({ page, context }) => {
  const errors = [];
  const blocked = [];
  const dialogs = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, rawValue) {
      if (key === "transportZones") {
        try { const rows = JSON.parse(rawValue); for (const row of rows || []) if (row.zoneId && !String(row.zoneId).startsWith("TEST-")) row.zoneId = `TEST-${row.zoneId}`; rawValue = JSON.stringify(rows); } catch {}
      }
      return originalSetItem.call(this, key, rawValue);
    };
    if (!localStorage.getItem("personnelRecords")) {
      localStorage.setItem("personnelRecords", JSON.stringify([{ personId: "TEST-DISP-ZONE-001", employeeNo: "TEST-DISP-ZONE-001", name: "TEST调度", position: "车队长", status: "approved", approvalStatus: "approved" }]));
      localStorage.setItem("currentPersonId", "TEST-DISP-ZONE-001");
      localStorage.setItem("selectedPosition", "车队长");
      localStorage.setItem("transportZones", "[]");
      localStorage.setItem("dispatchShiftExecutions", "[]");
      localStorage.setItem("dispatchPublishedTasks", "[]");
    }
  });
  await page.route("**/*", async route => {
    const req = route.request(); const url = new URL(req.url());
    if (!["GET", "HEAD"].includes(req.method()) || url.origin !== ORIGIN) { blocked.push(`${req.method()} ${req.url()}`); return route.abort(); }
    const file = path.resolve(ROOT, decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html");
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try { return route.fulfill({ status: 200, contentType: path.extname(file) === ".html" ? "text/html; charset=utf-8" : "text/javascript; charset=utf-8", body: await fs.readFile(file) }); }
    catch { return route.fulfill({ status: 404, body: "missing test asset" }); }
  });
  await context.grantPermissions(["geolocation"], { origin: ORIGIN });
  await context.setGeolocation({ latitude: 47.9, longitude: 106.9, accuracy: 12 });
  await page.goto(`${ORIGIN}/dispatch.html`, { waitUntil: "domcontentloaded" });
  await page.locator("#transportZoneButton").click();
  await page.locator("#zoneName").fill("TEST-7号煤场卸载区");
  await page.locator("#zoneType").selectOption("unloading");
  await page.locator("#zoneRadius").fill("80");
  await page.locator("#captureZoneLocationButton").click();
  await expect(page.locator("#zoneLatitude")).not.toHaveText("-");
  await page.locator("#saveTransportZoneButton").click();
  await expect.poll(() => dialogs.at(-1)).toContain("卸载区必须填写卸载物料类型");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("transportZones") || "[]"))).toHaveLength(0);
  await page.locator("#zoneMaterialType").selectOption("煤");
  await page.locator("#saveTransportZoneButton").click();
  await expect.poll(() => dialogs.at(-1)).toContain("运输区域已保存");
  let zones = await page.evaluate(() => JSON.parse(localStorage.getItem("transportZones") || "[]"));
  expect(zones).toHaveLength(1);
  expect(zones[0]).toMatchObject({ zoneId: expect.stringContaining("TEST-"), name: "TEST-7号煤场卸载区", zoneType: "unloading", materialType: "煤", radius: 80 });
  await page.locator("#zoneName").fill("TEST-7号煤场卸载区");
  await page.locator("#captureZoneLocationButton").click();
  await expect(page.locator("#zoneLatitude")).not.toHaveText("-");
  await page.locator("#zoneMaterialType").selectOption("煤");
  await page.locator("#saveTransportZoneButton").click();
  await expect.poll(() => dialogs.at(-1)).toContain("已经存在同名运输区域");
  zones = await page.evaluate(() => JSON.parse(localStorage.getItem("transportZones") || "[]"));
  expect(zones).toHaveLength(1);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
