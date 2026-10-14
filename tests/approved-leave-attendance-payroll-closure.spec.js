"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST排土管理事假经申请、调度审批、考勤锁定后按半日扣工资", async ({ page }) => {
  const errors = [];
  const blocked = [];
  const dialogs = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
  await page.addInitScript(() => {
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
    if (date.getMonth() !== now.getMonth()) date.setDate(2);
    const leaveDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const month = leaveDate.slice(0, 7);
    if (localStorage.getItem("TEST-LEAVE-PAY-SETUP") !== "1") {
    const admin = { personId: "TEST-LEAVE-PAY-ADMIN", employeeNo: "TEST-LEAVE-PAY-ADMIN", name: "TEST考勤工资管理员", position: "管理员", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true };
    const dispatcher = { personId: "TEST-LEAVE-PAY-DISPATCH", employeeNo: "TEST-LEAVE-PAY-DISPATCH", name: "TEST请假调度", position: "车队长", team: "管理组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true };
    const worker = { personId: "TEST-LEAVE-PAY-DUMP", employeeNo: "TEST-LEAVE-PAY-DUMP", name: "TEST排土事假人员", position: "排土管理", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true };
    localStorage.setItem("personnelRecords", JSON.stringify([admin, dispatcher, worker]));
    localStorage.setItem("currentPersonId", worker.personId);
    localStorage.setItem("selectedPosition", worker.position);
    localStorage.setItem("dispatchShiftExecutions", JSON.stringify([{
      executionId: "TEST-LEAVE-PAY-SHIFT",
      date: leaveDate,
      shiftDate: leaveDate,
      shift: "白班",
      driverAssignments: [{ personId: worker.personId, driverId: worker.personId, driverName: worker.name }],
      dumpManagementAssignments: [{ personId: worker.personId, name: worker.name }],
      boardManaged: false,
      testFixture: true
    }]));
    localStorage.setItem("leaveRequests", "[]");
    localStorage.setItem("leaveRecords", "[]");
    localStorage.setItem("driverLeaveRequests", "[]");
    localStorage.setItem("attendanceRecords", "[]");
    localStorage.setItem("adminAttendanceMonthlyLocks", "[]");
    localStorage.setItem("adminAttendanceDailyFinals", "[]");
    localStorage.setItem("adminAttendanceFinalRecords", "[]");
    localStorage.setItem("payrollStandards", JSON.stringify([
      { standardId: "TEST-LEAVE-PAY-DUMP-STANDARD", scope: "position", standardType: "dump_management_fixed_position", position: "排土管理", monthlySalary: 6200, effectiveDate: "2026-01-01", status: "active" }
    ]));
    localStorage.setItem("payrollMonthlyRecords", "[]");
    localStorage.setItem("payrollMonthlyLocks", "[]");
    localStorage.setItem("payrollAuditLogs", "[]");
    localStorage.setItem("rewardRecords", "[]");
    localStorage.setItem("penaltyRecords", "[]");
    localStorage.setItem("overtimeRecords", "[]");
    localStorage.setItem("tripRecords", "[]");
    localStorage.setItem("driverTripRecords", "[]");
    localStorage.setItem("performanceRankingRecords", "[]");
      localStorage.setItem("TEST-LEAVE-PAY-SETUP", "1");
    }
    window.__TEST_LEAVE_DATE__ = leaveDate;
    window.__TEST_LEAVE_MONTH__ = month;
  });
  await page.route("**/*", async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (!["GET", "HEAD"].includes(req.method()) || url.origin !== ORIGIN) {
      blocked.push(`${req.method()} ${req.url()}`);
      return route.abort();
    }
    const file = path.resolve(ROOT, decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html");
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const body = await fs.readFile(file);
      const ext = path.extname(file);
      return route.fulfill({ status: 200, contentType: ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream", body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  await page.goto(`${ORIGIN}/leave-request.html`, { waitUntil: "domcontentloaded" });
  const leaveDate = await page.evaluate(() => window.__TEST_LEAVE_DATE__);
  const month = await page.evaluate(() => window.__TEST_LEAVE_MONTH__);
  await expect(page.locator("#personPosition")).toHaveText("排土管理");
  await page.locator("#leaveType").selectOption("事假");
  await page.locator("#leaveStartDate").fill(leaveDate);
  await page.locator("#leaveEndDate").fill(leaveDate);
  await page.locator("#leaveStartHalf").selectOption("AM");
  await page.locator("#leaveEndHalf").selectOption("AM");
  await page.locator("#leaveReason").fill("TEST半日事假闭环");
  await expect(page.locator("#leaveDays")).toHaveValue("0.5");
  await page.getByRole("button", { name: "提交审批" }).click();
  await expect.poll(() => dialogs.length).toBe(1);
  let leave = await page.evaluate(() => JSON.parse(localStorage.getItem("leaveRequests") || "[]")[0]);
  expect(leave).toMatchObject({ personId: "TEST-LEAVE-PAY-DUMP", applicantId: "TEST-LEAVE-PAY-DUMP", leaveType: "事假", leaveDays: 0.5, status: "pending", approverRole: "dispatch" });
  const leaveId = leave.leaveId;

  await page.evaluate(() => {
    localStorage.setItem("currentPersonId", "TEST-LEAVE-PAY-DISPATCH");
    localStorage.setItem("selectedPosition", "车队长");
    localStorage.setItem("rolePersonIds", JSON.stringify({ "车队长": "TEST-LEAVE-PAY-DISPATCH" }));
  });
  await page.goto(`${ORIGIN}/dispatch.html`, { waitUntil: "domcontentloaded" });
  await page.locator("#openLeaveReviewButton").click();
  const review = page.locator("#leaveReviewModal");
  await expect(review).toContainText("TEST排土事假人员");
  await review.locator(`[data-leave-approve="${leaveId}"]`).click();
  await expect.poll(() => page.evaluate(id => JSON.parse(localStorage.getItem("leaveRequests") || "[]").find(row => row.leaveId === id)?.status, leaveId)).toBe("approved");
  leave = await page.evaluate(id => JSON.parse(localStorage.getItem("leaveRequests") || "[]").find(row => row.leaveId === id), leaveId);
  expect(leave.approvedBy).toBe("调度端");

  await page.evaluate(() => {
    localStorage.setItem("currentPersonId", "TEST-LEAVE-PAY-DUMP");
    localStorage.setItem("selectedPosition", "排土管理");
  });
  await page.goto(`${ORIGIN}/attendance.html`, { waitUntil: "domcontentloaded" });
  const attendanceRow = await page.evaluate(date => buildLedgerRow(date), leaveDate);
  expect(attendanceRow).toMatchObject({ date: leaveDate, white: 1, night: 0, deduction: 0.5, attendance: 0.5 });
  expect(attendanceRow.notes).toContain("事假（扣考勤）");

  await page.evaluate(() => {
    localStorage.setItem("currentPersonId", "TEST-LEAVE-PAY-ADMIN");
    localStorage.setItem("selectedPosition", "管理员");
    sessionStorage.setItem("managementSession", JSON.stringify({ verified: true, personId: "TEST-LEAVE-PAY-ADMIN", position: "管理员", expiresAt: Date.now() + 600000 }));
  });
  await page.goto(`${ORIGIN}/admin-review.html`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "打开最终考勤" }).click();
  await page.locator("#finalAttendanceMonth").fill(month);
  await page.locator("#finalAttendanceMonthlyTab").click();
  const monthlyRow = page.locator("#finalAttendanceMonthlyBody tr").filter({ hasText: "TEST排土事假人员" });
  await expect(monthlyRow).toHaveCount(1);
  await expect(monthlyRow.locator("td").nth(1)).toHaveText("0.5");
  await expect(monthlyRow.locator("td").nth(7)).toHaveText("0.5");
  await page.locator("#finalAttendanceLockMonthButton").click();
  await expect.poll(() => page.evaluate(m => JSON.parse(localStorage.getItem("adminAttendanceMonthlyLocks") || "[]").find(row => row.month === m)?.status, month)).toBe("locked");
  const locked = await page.evaluate(({ personId, month }) => {
    const lock = JSON.parse(localStorage.getItem("adminAttendanceMonthlyLocks") || "[]").find(row => row.month === month);
    return lock?.rows?.find(row => row.personId === personId);
  }, { personId: "TEST-LEAVE-PAY-DUMP", month });
  expect(locked).toMatchObject({ finalAttendance: 0.5, deduction: 0.5 });

  await page.goto(`${ORIGIN}/report-center.html`, { waitUntil: "domcontentloaded" });
  const payroll = await page.evaluate(() => JSON.parse(localStorage.getItem("payrollMonthlyRecords") || "[]").find(row => row.personId === "TEST-LEAVE-PAY-DUMP"));
  expect(payroll).toMatchObject({ baseSalary: 6200, attendanceDeductionDays: 0.5, attendanceSalaryDeduction: 100, payableSalary: 6100 });
  expect(payroll.description).toContain("考勤扣款");
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

