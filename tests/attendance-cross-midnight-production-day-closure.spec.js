"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST跨午夜趟次在考勤与生产报表均按生产日统计", async ({ page }) => {
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

  const productionDate = "2026-10-13";
  const completedAt = new Date("2026-10-14T08:30:00+08:00").toISOString();
  const admin = { personId: "TEST-ATTENDANCE-CROSS-ADMIN", employeeNo: "TEST-ATTENDANCE-CROSS-ADMIN", name: "TEST报表管理员", position: "管理员", status: "approved", approvalStatus: "approved" };
  const driver = { personId: "TEST-ATTENDANCE-CROSS-DRIVER", employeeNo: "TEST-ATTENDANCE-CROSS-DRIVER", name: "TEST跨夜司机", position: "汽车司机", status: "approved", approvalStatus: "approved" };
  const trip = {
    tripId: "TEST-ATTENDANCE-CROSS-TRIP-001",
    status: "completed",
    team: "A",
    materialType: "煤",
    personId: driver.personId,
    driverId: driver.personId,
    driverName: driver.name,
    vehicleNumber: "TEST-ATTENDANCE-CROSS-TRUCK",
    shiftDate: productionDate,
    productionDate,
    shiftType: "夜班",
    completedAt,
    officialCountEligible: true
  };
  await page.addInitScript(({ admin, driver, trip, productionDate }) => {
    localStorage.setItem("personnelRecords", JSON.stringify([admin, driver]));
    localStorage.setItem("currentPersonId", driver.personId);
    localStorage.setItem("selectedPosition", driver.position);
    localStorage.setItem("tripRecords", JSON.stringify([trip]));
    localStorage.setItem("driverTripRecords", "[]");
    localStorage.setItem("transportRecords", "[]");
    localStorage.setItem("excavatorTripRecords", "[]");
    localStorage.setItem("excavatorLoadingRecords", "[]");
    localStorage.setItem("dispatchShiftExecutions", JSON.stringify([{
      date: productionDate,
      shiftDate: productionDate,
      shift: "夜班",
      driverAssignments: [{ driverId: driver.personId, driverName: driver.name }],
      bindings: []
    }]));
    localStorage.setItem("attendanceRecords", JSON.stringify([{
      attendanceId: "TEST-ATTENDANCE-CROSS-ROW-001",
      personId: driver.personId,
      personName: driver.name,
      position: driver.position,
      date: productionDate,
      checkInAt: "2026-10-13T13:00:00.000Z",
      checkOutAt: "2026-10-14T00:30:00.000Z",
      attendanceStatus: "present"
    }]));
    localStorage.setItem("zeroProductionReports", "[]");
    window.__TEST_PRODUCTION_DATE__ = productionDate;
  }, { admin, driver, trip, productionDate });

  await page.goto(`${ORIGIN}/attendance.html`, { waitUntil: "domcontentloaded" });
  const attendanceRow = await page.evaluate(date => buildLedgerRow(date), productionDate);
  expect(attendanceRow.notes).toContain("生产数量：1");
  expect(attendanceRow.notes).not.toContain("生产数量为0");

  await page.evaluate(({ admin }) => {
    localStorage.setItem("currentPersonId", admin.personId);
    localStorage.setItem("selectedPosition", admin.position);
    sessionStorage.setItem("managementSession", JSON.stringify({ verified: true, personId: admin.personId, position: admin.position, expiresAt: Date.now() + 600000 }));
  }, { admin });
  await page.goto(`${ORIGIN}/report-center.html`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-report="attendance"]').click();
  await page.locator("#attendanceDate").fill(productionDate);
  await page.locator("#attendanceMonth").fill(productionDate.slice(0, 7));
  await page.evaluate(() => renderAttendance());
  const attendanceReportRow = page.locator("#attendanceTableBody tr").filter({ hasText: driver.name });
  await expect(attendanceReportRow.locator("td").nth(5)).toHaveText("1");
  await expect(attendanceReportRow.locator("td").nth(6)).toHaveText("-");

  await page.locator('[data-report="production"]').click();
  await page.locator("#productionDate").fill(productionDate);
  await page.evaluate(() => renderProduction());
  expect(await page.locator("#productionDayTotalTrips").innerText()).toBe("1");
  expect(await page.locator("#productionTableBody tr").count()).toBe(1);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

