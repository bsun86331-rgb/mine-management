"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST调度GPS与请假审核不会让旧提示框覆盖已处理结果", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("personnelRecords", JSON.stringify([
      { personId: "TEST-REVIEW-RACE-DISPATCH", employeeId: "TEST-REVIEW-RACE-DISPATCH", employeeNo: "TEST-REVIEW-RACE-DISPATCH", name: "TEST调度", position: "车队长", team: "管理组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true }
    ]));
    localStorage.setItem("currentPersonId", "TEST-REVIEW-RACE-DISPATCH");
    localStorage.setItem("selectedPosition", "车队长");
    localStorage.setItem("driverTripRecords", JSON.stringify([{
      tripId: "TEST-GPS-REVIEW-RACE",
      gpsStatus: "abnormal",
      dispatchConfirmation: "pending",
      officialCountEligible: false,
      testFixture: true
    }]));
    localStorage.setItem("leaveRequests", JSON.stringify([{
      leaveId: "TEST-LEAVE-REVIEW-RACE",
      status: "pending",
      approverRole: "dispatch",
      applicantName: "TEST一线人员",
      testFixture: true
    }]));
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
  await page.locator("#openGpsReviewButton").click();
  await page.evaluate(() => {
    window.prompt = () => {
      const rows = JSON.parse(localStorage.getItem("driverTripRecords"));
      rows[0].dispatchConfirmation = "confirmed";
      rows[0].officialCountEligible = true;
      localStorage.setItem("driverTripRecords", JSON.stringify(rows));
      return "TEST已在另一窗口通过";
    };
  });
  await page.locator('#gpsReviewList [data-gps-reject="TEST-GPS-REVIEW-RACE"]').click();
  let trip = await page.evaluate(() => JSON.parse(localStorage.getItem("driverTripRecords"))[0]);
  expect(trip).toMatchObject({ dispatchConfirmation: "confirmed", officialCountEligible: true });
  await page.locator("#closeGpsReviewModal").click();

  await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem("driverTripRecords"));
    rows[0].dispatchConfirmation = "pending";
    rows[0].officialCountEligible = false;
    localStorage.setItem("driverTripRecords", JSON.stringify(rows));
    window.prompt = () => {
      const latest = JSON.parse(localStorage.getItem("driverTripRecords"));
      latest[0].dispatchConfirmation = "rejected";
      latest[0].officialCountEligible = false;
      localStorage.setItem("driverTripRecords", JSON.stringify(latest));
      return "";
    };
  });
  await page.locator("#openGpsReviewButton").click();
  await page.locator('#gpsReviewList [data-gps-confirm="TEST-GPS-REVIEW-RACE"]').click();
  trip = await page.evaluate(() => JSON.parse(localStorage.getItem("driverTripRecords"))[0]);
  expect(trip).toMatchObject({ dispatchConfirmation: "rejected", officialCountEligible: false });
  await page.locator("#closeGpsReviewModal").click();

  await page.locator("#openLeaveReviewButton").click();
  await page.evaluate(() => {
    window.prompt = () => {
      const rows = JSON.parse(localStorage.getItem("leaveRequests"));
      rows[0].status = "approved";
      rows[0].approvedBy = "TEST另一调度窗口";
      localStorage.setItem("leaveRequests", JSON.stringify(rows));
      return "TEST旧窗口驳回";
    };
  });
  await page.locator('#leaveReviewList [data-leave-reject="TEST-LEAVE-REVIEW-RACE"]').click();
  let leave = await page.evaluate(() => JSON.parse(localStorage.getItem("leaveRequests"))[0]);
  expect(leave).toMatchObject({ status: "approved", approvedBy: "TEST另一调度窗口" });
  expect(leave.reviewedBy).toBeUndefined();
  await page.locator("#closeLeaveReviewModal").click();

  await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem("leaveRequests"));
    rows[0].status = "pending";
    delete rows[0].approvedBy;
    localStorage.setItem("leaveRequests", JSON.stringify(rows));
    window.prompt = () => {
      const latest = JSON.parse(localStorage.getItem("leaveRequests"));
      latest[0].status = "rejected";
      latest[0].reviewedBy = "TEST另一调度窗口";
      latest[0].reviewRemark = "TEST已在另一窗口驳回";
      localStorage.setItem("leaveRequests", JSON.stringify(latest));
      return "";
    };
  });
  await page.locator("#openLeaveReviewButton").click();
  await page.locator('#leaveReviewList [data-leave-approve="TEST-LEAVE-REVIEW-RACE"]').click();
  leave = await page.evaluate(() => JSON.parse(localStorage.getItem("leaveRequests"))[0]);
  expect(leave).toMatchObject({ status: "rejected", reviewedBy: "TEST另一调度窗口", reviewRemark: "TEST已在另一窗口驳回" });
  expect(leave.approvedBy).toBeUndefined();

  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
