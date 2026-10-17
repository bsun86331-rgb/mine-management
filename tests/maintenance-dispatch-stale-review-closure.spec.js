"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST维修进厂审核在确认框期间状态变化后不覆盖其他窗口结果", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("personnelRecords", JSON.stringify([
      { personId: "TEST-DISPATCH-REVIEW-RACE", employeeId: "TEST-DISPATCH-REVIEW-RACE", employeeNo: "TEST-DISPATCH-REVIEW-RACE", name: "TEST调度", position: "车队长", team: "管理组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true },
    ]));
    localStorage.setItem("currentPersonId", "TEST-DISPATCH-REVIEW-RACE");
    localStorage.setItem("selectedPosition", "车队长");
    localStorage.setItem("maintenanceRequests", JSON.stringify([{
      requestId: "TEST-REPAIR-REVIEW-RACE", maintenanceRequestId: "TEST-REPAIR-REVIEW-RACE",
      source: "equipment_usage_check", equipmentId: "TEST-EQ-REVIEW-RACE",
      equipmentNumber: "TEST-EQ-REVIEW-RACE", equipmentType: "汽车",
      reportedById: "TEST-DRIVER-REVIEW-RACE", reportedByName: "TEST司机",
      applicantName: "TEST司机", status: "pending_dispatch", dispatchStatus: "pending",
      dispatchRequired: true, maintenanceType: "故障维修", description: "TEST审核并发",
      createdAt: new Date().toISOString(), testFixture: true
    }]));
    localStorage.setItem("equipmentOperationalStatus", JSON.stringify([
      { equipmentId: "TEST-EQ-REVIEW-RACE", status: "maintenance", previousStatus: "disabled", testFixture: true }
    ]));
    localStorage.setItem("maintenanceWorkOrders", "[]");
    window.__testAlerts = [];
    window.alert = message => window.__testAlerts.push(String(message));
  });
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
      const ext = path.extname(file);
      const contentType = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  await page.goto(`${ORIGIN}/dispatch.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    window.confirm = () => {
      const rows = JSON.parse(localStorage.getItem("maintenanceRequests"));
      rows[0].status = "rejected";
      rows[0].dispatchStatus = "rejected";
      rows[0].dispatchRejectReason = "TEST由另一窗口先驳回";
      localStorage.setItem("maintenanceRequests", JSON.stringify(rows));
      return true;
    };
    approveMaintenanceEntry("TEST-REPAIR-REVIEW-RACE");
  });
  let request = await page.evaluate(() => JSON.parse(localStorage.getItem("maintenanceRequests"))[0]);
  expect(request).toMatchObject({ status: "rejected", dispatchStatus: "rejected", dispatchRejectReason: "TEST由另一窗口先驳回" });

  await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem("maintenanceRequests"));
    rows[0].status = "pending_dispatch";
    rows[0].dispatchStatus = "pending";
    delete rows[0].dispatchRejectReason;
    localStorage.setItem("maintenanceRequests", JSON.stringify(rows));
    window.prompt = () => {
      const latest = JSON.parse(localStorage.getItem("maintenanceRequests"));
      latest[0].status = "waiting_entry";
      latest[0].dispatchStatus = "approved";
      localStorage.setItem("maintenanceRequests", JSON.stringify(latest));
      return "TEST另一窗口已批准";
    };
    rejectMaintenanceEntry("TEST-REPAIR-REVIEW-RACE");
  });
  request = await page.evaluate(() => JSON.parse(localStorage.getItem("maintenanceRequests"))[0]);
  expect(request).toMatchObject({ status: "waiting_entry", dispatchStatus: "approved" });
  expect(request.dispatchRejectReason).toBeUndefined();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("equipmentOperationalStatus")))).toEqual([
    { equipmentId: "TEST-EQ-REVIEW-RACE", status: "maintenance", previousStatus: "disabled", testFixture: true }
  ]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("maintenanceWorkOrders")))).toEqual([]);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
