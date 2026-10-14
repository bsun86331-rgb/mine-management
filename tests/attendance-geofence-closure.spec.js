"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST考勤电子围栏拒绝越界并完成进出打卡", async ({ page, context }) => {
  const errors = [];
  const blocked = [];
  const dialogs = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
  await page.addInitScript(() => {
    if (!localStorage.getItem("personnelRecords")) {
      localStorage.setItem("personnelRecords", JSON.stringify([{ personId: "TEST-ATT-001", employeeNo: "TEST-ATT-001", name: "TEST汽车司机", position: "汽车司机", status: "approved", approvalStatus: "approved", department: "生产A组" }]));
      localStorage.setItem("currentPersonId", "TEST-ATT-001");
      localStorage.setItem("selectedPosition", "汽车司机");
      localStorage.setItem("attendanceGeofenceConfig", JSON.stringify({ latitude: 47.9, longitude: 106.9, radiusMeters: 1000, maxAccuracyMeters: 50, enabled: true, name: "TEST矿区" }));
      localStorage.setItem("attendanceRecords", "[]");
      localStorage.setItem("attendanceGeofenceAttempts", "[]");
      localStorage.setItem("leaveRequests", "[]");
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
  await context.setGeolocation({ latitude: 47.91, longitude: 106.91, accuracy: 10 });
  await page.goto(`${ORIGIN}/attendance.html`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "上班打卡" }).click();
  await expect.poll(() => dialogs.at(-1)).toContain("未通过范围校验");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("attendanceRecords") || "[]"))).toHaveLength(0);
  let attempts = await page.evaluate(() => JSON.parse(localStorage.getItem("attendanceGeofenceAttempts") || "[]"));
  expect(attempts).toHaveLength(1);
  expect(attempts[0].reasonCode).toBe("outside");

  await context.setGeolocation({ latitude: 47.9, longitude: 106.9, accuracy: 10 });
  await page.getByRole("button", { name: "上班打卡" }).click();
  await expect.poll(() => dialogs.at(-1)).toContain("上班打卡成功");
  await expect(page.locator("#attendanceStatus")).not.toHaveText("未打卡");
  let records = await page.evaluate(() => JSON.parse(localStorage.getItem("attendanceRecords") || "[]"));
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({ personId: "TEST-ATT-001", attendanceStatus: "present" });
  expect(records[0].attendanceId).toBeTruthy();
  await page.getByRole("button", { name: "下班打卡" }).click();
  await expect.poll(() => dialogs.at(-1)).toContain("下班打卡成功");
  records = await page.evaluate(() => JSON.parse(localStorage.getItem("attendanceRecords") || "[]"));
  expect(records[0].checkOutAt).toBeTruthy();
  await page.getByRole("button", { name: "上班打卡" }).click();
  expect(records).toHaveLength(1);
  expect(dialogs.some(message => message.includes("已经完成上班打卡"))).toBe(true);
  await page.evaluate(() => {
    const people = JSON.parse(localStorage.getItem("personnelRecords"));
    people.push({ personId: "TEST-ATT-LEAVE-001", employeeNo: "TEST-ATT-LEAVE-001", name: "TEST请假司机", position: "汽车司机", status: "approved", approvalStatus: "approved", department: "生产B组" });
    localStorage.setItem("personnelRecords", JSON.stringify(people));
    localStorage.setItem("currentPersonId", "TEST-ATT-LEAVE-001");
    const now = Date.now();
    localStorage.setItem("leaveRequests", JSON.stringify([{ leaveId: "TEST-LEAVE-001", personId: "TEST-ATT-LEAVE-001", status: "approved", startTime: new Date(now - 86400000).toISOString(), endTime: new Date(now + 86400000).toISOString() }]));
    localStorage.setItem("attendanceRecords", "[]");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#leaveWarning")).toBeVisible();
  await page.getByRole("button", { name: "上班打卡" }).click();
  await expect.poll(() => dialogs.at(-1)).toContain("当前处于有效请假期间");
  const leaveAttendance = await page.evaluate(() => JSON.parse(localStorage.getItem("attendanceRecords") || "[]"));
  expect(leaveAttendance).toHaveLength(1);
  expect(leaveAttendance[0]).toMatchObject({ personId: "TEST-ATT-LEAVE-001", attendanceStatus: "leave_invalid" });
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

