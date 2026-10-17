"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST手动补录趟次审核会拒绝确认框期间已被其他窗口处理的旧操作", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("personnelRecords", JSON.stringify([
      { personId: "TEST-MANUAL-TRIP-DISPATCH", employeeId: "TEST-MANUAL-TRIP-DISPATCH", employeeNo: "TEST-MANUAL-TRIP-DISPATCH", name: "TEST调度", position: "车队长", team: "管理组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true },
    ]));
    localStorage.setItem("currentPersonId", "TEST-MANUAL-TRIP-DISPATCH");
    localStorage.setItem("selectedPosition", "车队长");
    const trip = {
      tripId: "TEST-MANUAL-TRIP-RACE-001",
      recordId: "TEST-MANUAL-TRIP-RACE-001",
      driverId: "TEST-MANUAL-DRIVER",
      driverName: "TEST司机",
      vehicleId: "TEST-MANUAL-TRUCK",
      vehicleNumber: "TEST-MANUAL-TRUCK",
      materialType: "岩石",
      unloadingZoneName: "TEST卸载区",
      manualOverride: true,
      dispatchConfirmation: "pending",
      gpsReviewStatus: "pending",
      officialCountEligible: false,
      completedAt: "2026-10-17T00:30:00.000Z",
      testFixture: true
    };
    localStorage.setItem("tripRecords", JSON.stringify([trip]));
    localStorage.setItem("driverTripRecords", JSON.stringify([trip]));
    localStorage.setItem("productionTasks", "[]");
    window.__testAlerts = [];
    window.alert = message => window.__testAlerts.push(String(message));
  });
  await page.route("**/*", async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (!["GET", "HEAD"].includes(req.method()) || url.origin !== ORIGIN) {
      blocked.push(req.method() + " " + req.url());
      return route.abort();
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const body = await fs.readFile(file);
      const ext = path.extname(file);
      const contentType = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  await page.goto(ORIGIN + "/dispatch.html", { waitUntil: "domcontentloaded" });

  await page.evaluate(() => {
    window.confirm = () => {
      const rows = JSON.parse(localStorage.getItem("tripRecords"));
      rows[0].dispatchConfirmation = "confirmed";
      rows[0].gpsReviewStatus = "approved";
      rows[0].officialCountEligible = true;
      localStorage.setItem("tripRecords", JSON.stringify(rows));
      return true;
    };
    reviewManualTrip("TEST-MANUAL-TRIP-RACE-001", "reject");
  });
  let canonical = await page.evaluate(() => JSON.parse(localStorage.getItem("tripRecords"))[0]);
  let legacy = await page.evaluate(() => JSON.parse(localStorage.getItem("driverTripRecords"))[0]);
  expect(canonical).toMatchObject({ dispatchConfirmation: "confirmed", gpsReviewStatus: "approved", officialCountEligible: true });
  expect(legacy).toMatchObject({ dispatchConfirmation: "pending", gpsReviewStatus: "pending", officialCountEligible: false });

  await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem("tripRecords"));
    rows[0].dispatchConfirmation = "pending";
    rows[0].gpsReviewStatus = "pending";
    rows[0].officialCountEligible = false;
    localStorage.setItem("tripRecords", JSON.stringify(rows));
    const legacyRows = JSON.parse(localStorage.getItem("driverTripRecords"));
    legacyRows[0].dispatchConfirmation = "pending";
    legacyRows[0].gpsReviewStatus = "pending";
    legacyRows[0].officialCountEligible = false;
    localStorage.setItem("driverTripRecords", JSON.stringify(legacyRows));
    window.confirm = () => {
      const latest = JSON.parse(localStorage.getItem("tripRecords"));
      latest[0].dispatchConfirmation = "rejected";
      latest[0].gpsReviewStatus = "rejected";
      latest[0].officialCountEligible = false;
      localStorage.setItem("tripRecords", JSON.stringify(latest));
      return true;
    };
    reviewManualTrip("TEST-MANUAL-TRIP-RACE-001", "approve");
  });
  canonical = await page.evaluate(() => JSON.parse(localStorage.getItem("tripRecords"))[0]);
  legacy = await page.evaluate(() => JSON.parse(localStorage.getItem("driverTripRecords"))[0]);
  expect(canonical).toMatchObject({ dispatchConfirmation: "rejected", gpsReviewStatus: "rejected", officialCountEligible: false });
  expect(legacy).toMatchObject({ dispatchConfirmation: "pending", gpsReviewStatus: "pending", officialCountEligible: false });
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
