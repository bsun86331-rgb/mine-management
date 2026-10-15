"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST全系统数据一致性检查只读展示异常且不改写浏览器数据", async ({ page }) => {
  const errors = [];
  const blocked = [];
  const dialogs = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => {
    dialogs.push(dialog.message());
    await dialog.accept();
  });

  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    const fixtures = {
      personnelRecords: [
        { personId: "TEST-DATA-CHECK-PERSON", name: "TEST人员甲" },
        { personId: "TEST-DATA-CHECK-PERSON", name: "TEST人员乙" }
      ],
      tripRecords: [
        {
          tripId: "TEST-DATA-CHECK-TRIP",
          personId: "TEST-DATA-CHECK-MISSING-PERSON",
          vehicleNumber: "TEST-DATA-CHECK-VEHICLE",
          materialType: "煤"
        }
      ],
      driverTripRecords: [],
      transportRecords: "{TEST-corrupt-json",
      excavatorTripRecords: [],
      excavatorLoadingRecords: [],
      fuelIntakeRecords: [],
      fuelRecords: [{ fuelId: "TEST-DATA-CHECK-FUEL", vehicleNumber: "TEST-DATA-CHECK-VEHICLE" }],
      maintenanceCosts: [{ maintenanceId: "TEST-DATA-CHECK-MAINT", equipmentNumber: "TEST-DATA-CHECK-VEHICLE" }],
      attendanceRecords: [{ attendanceId: "TEST-DATA-CHECK-ATT", personId: "TEST-DATA-CHECK-PERSON" }],
      zeroProductionReports: [],
      warehouseMaterials: [],
      payrollMonthlyRecords: [],
      performanceRankingRecords: [],
      financeCostRecords: []
    };
    for (const [key, value] of Object.entries(fixtures)) {
      localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    }
    localStorage.setItem("TEST-data-check-sentinel", "preserve-me");
  });

  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!["GET", "HEAD"].includes(request.method()) || url.origin !== ORIGIN) {
      blocked.push(request.method() + " " + request.url());
      return route.abort();
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const ext = path.extname(file).toLowerCase();
      return route.fulfill({
        status: 200,
        contentType: ext === ".html" ? "text/html; charset=utf-8" : "application/octet-stream",
        body: await fs.readFile(file)
      });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  await page.goto(ORIGIN + "/data-check.html", { waitUntil: "domcontentloaded" });
  const before = await page.evaluate(() =>
    JSON.stringify(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]))
  );

  await page.getByRole("button", { name: /开始数据检查/ }).click();

  await expect(page.locator("#total")).toHaveText("26");
  await expect(page.locator("#quality tr").filter({ hasText: "人员ID重复" }).locator("td").nth(1)).toHaveText("1");
  await expect(page.locator("#quality tr").filter({ hasText: "人员ID重复" })).toContainText("异常");
  await expect(page.locator("#quality tr").filter({ hasText: "运输记录无法关联人员" }).locator("td").nth(1)).toHaveText("1");
  await expect(page.locator("#quality tr").filter({ hasText: "运输记录无法关联人员" })).toContainText("需统一");
  expect(dialogs).toHaveLength(1);
  expect(dialogs[0]).toContain("检查：26");

  const after = await page.evaluate(() =>
    JSON.stringify(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]))
  );
  expect(after).toBe(before);
  expect(await page.evaluate(() => localStorage.getItem("TEST-data-check-sentinel"))).toBe("preserve-me");
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
