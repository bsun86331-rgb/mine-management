"use strict";
const { evidencePath } = require("./evidence-path.cjs");
const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");
const productionBoardCore = require(path.join(ROOT, "js", "production-board-core.js"));

test("TEST生产报表按班次生产日统计跨午夜趟次", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
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
      const ext = path.extname(file).toLowerCase();
      const contentType = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body: await fs.readFile(file) });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  const productionDay = "2026-10-13";
  const nextCalendarDay = "2026-10-14";
  const configuredSchedule = { dayStart: "09:00", dayEnd: "21:00", nightStart: "21:00", nightEnd: "09:00" };
  const completedAt = new Date(`${nextCalendarDay}T08:30:00+08:00`).toISOString();
  const assignedSlot = productionBoardCore.currentSlot(new Date(completedAt), configuredSchedule);
  const admin = { personId: "TEST-CROSS-MIDNIGHT-ADMIN", employeeNo: "TEST-CROSS-MIDNIGHT-ADMIN", name: "TEST报表管理员", position: "管理员", status: "approved", approvalStatus: "approved" };
  const trip = {
    tripId: "TEST-CROSS-MIDNIGHT-TRIP-001",
    status: "completed",
    team: "A",
    materialType: "煤",
    completedAt,
    shiftDate: productionDay,
    productionDate: productionDay,
    workDate: productionDay,
    shiftType: "夜班",
    officialCountEligible: true
  };
  const monthBoundaryTrip = {
    ...trip,
    tripId: "TEST-CROSS-MIDNIGHT-TRIP-002",
    shiftDate: "2026-10-31",
    productionDate: "2026-10-31",
    workDate: "2026-10-31",
    completedAt: new Date("2026-11-01T08:30:00+08:00").toISOString()
  };
  await page.addInitScript(({ admin, trip, monthBoundaryTrip, productionDay }) => {
    localStorage.setItem("personnelRecords", JSON.stringify([admin]));
    localStorage.setItem("currentPersonId", admin.personId);
    localStorage.setItem("selectedPosition", "管理员");
    sessionStorage.setItem("managementSession", JSON.stringify({ verified: true, personId: admin.personId, position: "管理员", expiresAt: Date.now() + 600000 }));
    localStorage.setItem("tripRecords", JSON.stringify([trip, monthBoundaryTrip]));
    localStorage.setItem("driverTripRecords", "[]");
    localStorage.setItem("transportRecords", "[]");
    window.__TEST_PRODUCTION_DAY__ = productionDay;
  }, { admin, trip, monthBoundaryTrip, productionDay });

  await page.goto(`${ORIGIN}/report-center.html`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-report="production"]').click();
  await page.locator("#productionDate").fill(productionDay);
  await page.evaluate(() => renderProduction());
  const selectedProductionDayStats = await page.locator("#productionDayTotalTrips").innerText();
  const tableRows = await page.locator("#productionTableBody tr").count();
  await page.locator("#productionDate").fill(nextCalendarDay);
  await page.evaluate(() => renderProduction());
  const followingCalendarDayStats = await page.locator("#productionDayTotalTrips").innerText();

  await page.locator("#productionMonth").fill("2026-10");
  await page.evaluate(() => renderProduction());
  const productionMonthStats = await page.locator("#productionMonthTotalTrips").innerText();
  await page.locator("#productionMonth").fill("2026-11");
  await page.evaluate(() => renderProduction());
  const followingMonthStats = await page.locator("#productionMonthTotalTrips").innerText();

  console.log("TEST跨午夜日报口径观察:", JSON.stringify({ configuredSchedule, assignedSlot, productionDay, nextCalendarDay, tripShiftDate: trip.shiftDate, tripCompletedAtLocal: "08:30+08:00", tripCompletedAtStoredUtc: trip.completedAt, selectedProductionDayStats, followingCalendarDayStats, productionMonthStats, followingMonthStats, tableRows }));
  await page.screenshot({ path: evidencePath("证据_生产日报跨午夜生产日口径", "production-report-cross-midnight-probe"), fullPage: true });
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
  expect(assignedSlot).toEqual({ date: "2026-10-13", shift: "夜班" });
  expect(selectedProductionDayStats).toBe("1");
  expect(tableRows).toBe(1);
  expect(followingCalendarDayStats).toBe("0");
  expect(productionMonthStats).toBe("2");
  expect(followingMonthStats).toBe("0");
});

