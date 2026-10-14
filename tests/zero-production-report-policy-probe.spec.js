"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST司机的零产量报备是否要求车队长确认", async ({ page, context }) => {
  const errors = [];
  const blocked = [];
  const dialogs = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
  await page.addInitScript(() => {
    if (!localStorage.getItem("personnelRecords")) {
      localStorage.setItem("personnelRecords", JSON.stringify([{ personId: "TEST-ZERO-001", employeeNo: "TEST-ZERO-001", name: "TEST汽车司机", position: "汽车司机", status: "approved", approvalStatus: "approved", department: "生产A组" }]));
      localStorage.setItem("currentPersonId", "TEST-ZERO-001");
      localStorage.setItem("selectedPosition", "汽车司机");
      localStorage.setItem("attendanceGeofenceConfig", JSON.stringify({ enabled: false, radiusMeters: 100, maxAccuracyMeters: 50, name: "TEST不限制围栏" }));
      localStorage.setItem("attendanceRecords", "[]");
      localStorage.setItem("attendanceGeofenceAttempts", "[]");
      localStorage.setItem("zeroProductionReports", "[]");
      localStorage.setItem("tripRecords", "[]");
      localStorage.setItem("driverTripRecords", "[]");
      localStorage.setItem("dispatchShiftExecutions", "[]");
      localStorage.setItem("dispatchPublishedTasks", "[]");
      localStorage.setItem("leaveRequests", "[]");
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
  await context.setGeolocation({ latitude: 47.9, longitude: 106.9, accuracy: 10 });
  await page.goto(`${ORIGIN}/attendance.html`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "上班打卡" }).click();
  await expect.poll(() => dialogs.at(-1)).toContain("上班打卡成功");
  await expect(page.locator("#zeroProductionForm")).toBeVisible();
  await page.locator("#zeroReason").selectOption("设备故障");
  await page.locator("#reporterName").fill("TEST司机自行填写的车队长姓名");
  await page.locator("#zeroRemark").fill("TEST设备故障等待维修，无运输趟次");
  await page.getByRole("button", { name: "提交报备" }).click();
  await expect.poll(() => dialogs.at(-1)).toContain("零产量异常已完成报备");
  const reports = await page.evaluate(() => JSON.parse(localStorage.getItem("zeroProductionReports") || "[]"));
  expect(reports).toHaveLength(1);
  expect(reports[0]).toMatchObject({ personId: "TEST-ZERO-001", reporterName: "TEST司机自行填写的车队长姓名", status: "reported", reason: "设备故障" });
  expect(reports[0].reportId).toBeTruthy();
  expect(reports[0].approverRole).toBeUndefined();
  await expect(page.locator("#zeroProductionBadge")).toHaveText("已报备");
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

