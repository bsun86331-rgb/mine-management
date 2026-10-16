"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("正式趟次统计在各页面统一排除审核别名待审与驳回记录", async ({ page }) => {
  const pageErrors = [];
  const blockedRequests = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!['GET', 'HEAD'].includes(request.method()) || url.origin !== ORIGIN) {
      blockedRequests.push(`${request.method()} ${request.url()}`);
      return route.abort();
    }
    const relative = decodeURIComponent(url.pathname).split("/").filter(Boolean).join("/") || "index.html";
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const body = await fs.readFile(file);
      const extension = path.extname(file);
      const contentType = extension === ".html" ? "text/html; charset=utf-8" : extension === ".js" ? "text/javascript; charset=utf-8" : extension === ".css" ? "text/css; charset=utf-8" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing TEST asset" });
    }
  });

  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    const reportPage = location.pathname.endsWith("/report-center.html");
    const person = reportPage
      ? { personId: "TEST-OPS70-ADMIN", employeeNo: "TEST-OPS70-ADMIN", name: "TEST管理员", position: "管理员", status: "approved", approvalStatus: "approved" }
      : { personId: "TEST-OPS70-DISPATCH", employeeNo: "TEST-OPS70-DISPATCH", name: "TEST调度", position: "车队长", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用" };
    localStorage.setItem("personnelRecords", JSON.stringify([person]));
    localStorage.setItem("currentPersonId", person.personId);
    localStorage.setItem("selectedPosition", person.position);
    if (reportPage) sessionStorage.setItem("managementSession", JSON.stringify({ verified: true, personId: person.personId, position: person.position, expiresAt: Date.now() + 600000 }));
  });

  const completedAt = new Date().toISOString();
  const cases = [
    { name: "reviewStatus-pending", record: { tripId: "TEST-OPS70-PENDING", status: "completed", completedAt, reviewStatus: "pending", manualOverride: true, gpsStatus: "manual_override" }, expectedOfficial: false, expectedBoard: false },
    { name: "reviewStatus-rejected", record: { tripId: "TEST-OPS70-REJECTED", status: "completed", completedAt, reviewStatus: "rejected", manualOverride: true, gpsStatus: "manual_override" }, expectedOfficial: false, expectedBoard: false },
    { name: "gps-approved-review-rejected", record: { tripId: "TEST-OPS70-ALIAS-CONFLICT-REJECTED", status: "completed", completedAt, gpsReviewStatus: "approved", reviewStatus: "rejected", manualOverride: true, gpsStatus: "manual_override" }, expectedOfficial: false, expectedBoard: false },
    { name: "gps-pending-review-approved", record: { tripId: "TEST-OPS70-ALIAS-CONFLICT-PENDING", status: "completed", completedAt, gpsReviewStatus: "pending", reviewStatus: "approved", manualOverride: true, gpsStatus: "manual_override" }, expectedOfficial: false, expectedBoard: false },
    { name: "confirmationStatus-pending", record: { tripId: "TEST-OPS70-CONF-PENDING", status: "completed", completedAt, confirmationStatus: "pending", manualOverride: true, gpsStatus: "manual_override" }, expectedOfficial: false, expectedBoard: false },
    { name: "confirmationStatus-rejected", record: { tripId: "TEST-OPS70-CONF-REJECTED", status: "completed", completedAt, confirmationStatus: "rejected", manualOverride: true, gpsStatus: "manual_override" }, expectedOfficial: false, expectedBoard: false },
    { name: "dispatchConfirmation-rejected-nonofficial-trip", record: { tripId: "TEST-OPS70-DISPATCH-REJECTED", status: "completed", completedAt, dispatchConfirmation: "rejected", officialCountEligible: false }, expectedOfficial: false, expectedBoard: false },
    { name: "approved-normal", record: { tripId: "TEST-OPS70-APPROVED", status: "completed", completedAt, dispatchConfirmation: "confirmed", gpsReviewStatus: "approved", officialCountEligible: true }, expectedOfficial: true, expectedBoard: true }
  ];

  const result = {};
  const pagePredicates = {
    "dispatch.html": "dispatchIsValidTrip",
    "transport.html": "isValidOfficialTrip",
    "report-center.html": "isValidProductionRecord"
  };

  for (const [route, predicate] of Object.entries(pagePredicates)) {
    await page.goto(`${ORIGIN}/${route}`, { waitUntil: "domcontentloaded" });
    result[route] = await page.evaluate(({ cases, predicate }) => Object.fromEntries(cases.map(item => [
      item.name,
      {
        core: window.ProductionBoardCore.validTrips([item.record]).length === 1,
        page: window[predicate](item.record) === true
      }
    ])), { cases, predicate });
  }

  for (const route of Object.keys(pagePredicates)) {
    for (const item of cases) {
        expect(result[route][item.name].core, `${route} ${item.name} board core`).toBe(item.expectedBoard);
        expect(result[route][item.name].page, `${route} ${item.name} official predicate`).toBe(item.expectedOfficial);
    }
  }
  expect(pageErrors).toEqual([]);
  expect(blockedRequests).toEqual([]);
});
