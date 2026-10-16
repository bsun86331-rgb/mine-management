"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST无稳定趟次ID不进入调度、运输和综合报表正式统计，稳定ID别名可去重", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    const now = new Date().toISOString();
    localStorage.setItem("personnelRecords", JSON.stringify([
      { personId: "TEST-OFFICIAL-ID-ADMIN", employeeNo: "TEST-OFFICIAL-ID-ADMIN", name: "TEST管理员", position: "管理员", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用" },
      { personId: "TEST-OFFICIAL-ID-DISPATCH", employeeNo: "TEST-OFFICIAL-ID-DISPATCH", name: "TEST调度员", position: "车队长", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用" }
    ]));
    localStorage.setItem("currentPersonId", "TEST-OFFICIAL-ID-DISPATCH");
    localStorage.setItem("selectedPosition", "车队长");
    localStorage.setItem("adminPersonId", "TEST-OFFICIAL-ID-ADMIN");
    sessionStorage.setItem("managementSession", JSON.stringify({ verified: true, personId: "TEST-OFFICIAL-ID-ADMIN", position: "管理员", expiresAt: Date.now() + 600000 }));
    localStorage.setItem("tripRecords", JSON.stringify([
      { tripId: "TEST-OFFICIAL-STABLE-001", personId: "TEST-DRIVER-001", status: "completed", officialCountEligible: true, materialType: "煤", completedAt: now },
      { record_id: "TEST-OFFICIAL-LEGACY-002", personId: "TEST-DRIVER-002", status: "completed", officialCountEligible: true, materialType: "渣", completedAt: now },
      { clientRecordId: "TEST-OFFICIAL-CLIENT-003", personId: "TEST-DRIVER-003", status: "completed", officialCountEligible: true, materialType: "煤", completedAt: now },
      { client_record_id: "TEST-OFFICIAL-CLIENT-003", personId: "TEST-DRIVER-003", status: "completed", officialCountEligible: true, materialType: "煤", completedAt: now },
      { trip_id: "TEST-OFFICIAL-SNAKE-004", personId: "TEST-DRIVER-004", status: "completed", officialCountEligible: true, materialType: "煤", completedAt: now },
      { recordId: "TEST-OFFICIAL-RECORD-005", personId: "TEST-DRIVER-005", status: "completed", officialCountEligible: true, materialType: "渣", completedAt: now },
      { id: "TEST-OFFICIAL-ID-006", personId: "TEST-DRIVER-006", status: "completed", officialCountEligible: true, materialType: "煤", completedAt: now },
      { personId: "TEST-DRIVER-007", status: "completed", officialCountEligible: true, materialType: "煤", completedAt: now },
      { id: "TEST-OFFICIAL-INELIGIBLE-008", personId: "TEST-DRIVER-008", status: "completed", officialCountEligible: false, materialType: "煤", completedAt: now }
    ]));
    for (const key of ["driverTripRecords", "transportRecords", "dispatchTasks", "dispatchPublishedTasks", "dispatchShiftExecutions", "shiftExecutions", "transportZones", "attendanceRecords", "equipmentRecords", "maintenanceRequests", "leaveRequests"]) localStorage.setItem(key, "[]");
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
      const ext = path.extname(file).toLowerCase();
      const contentType = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" }[ext] || "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body: await fs.readFile(file) });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  await page.goto(`${ORIGIN}/report-center.html`, { waitUntil: "domcontentloaded" });
  const reportIds = await page.evaluate(() => getAllProductionTripRecords().map(row => window.ProductionBoardCore.stableTripId(row)).sort());
  expect(reportIds).toEqual(["TEST-OFFICIAL-CLIENT-003", "TEST-OFFICIAL-ID-006", "TEST-OFFICIAL-LEGACY-002", "TEST-OFFICIAL-RECORD-005", "TEST-OFFICIAL-SNAKE-004", "TEST-OFFICIAL-STABLE-001"]);

  await page.goto(`${ORIGIN}/dispatch.html`, { waitUntil: "domcontentloaded" });
  const boardCoreSrc = await page.locator('script[src*="production-board-core.js"]').getAttribute("src");
  expect(boardCoreSrc).toContain("v=2.0.16");
  const dispatchIds = await page.evaluate(() => dispatchGetUnifiedTrips().filter(dispatchIsValidTrip).map(row => window.ProductionBoardCore.stableTripId(row)).sort());
  expect(dispatchIds).toEqual(["TEST-OFFICIAL-CLIENT-003", "TEST-OFFICIAL-ID-006", "TEST-OFFICIAL-LEGACY-002", "TEST-OFFICIAL-RECORD-005", "TEST-OFFICIAL-SNAKE-004", "TEST-OFFICIAL-STABLE-001"]);

  await page.goto(`${ORIGIN}/transport.html`, { waitUntil: "domcontentloaded" });
  const transportIds = await page.evaluate(() => unifiedTrips().filter(isValidOfficialTrip).map(row => window.ProductionBoardCore.stableTripId(row)).sort());
  expect(transportIds).toEqual(["TEST-OFFICIAL-CLIENT-003", "TEST-OFFICIAL-ID-006", "TEST-OFFICIAL-LEGACY-002", "TEST-OFFICIAL-RECORD-005", "TEST-OFFICIAL-SNAKE-004", "TEST-OFFICIAL-STABLE-001"]);

  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
