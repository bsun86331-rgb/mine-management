"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("工资考勤已锁定但缺少工资标准时拒绝最终锁定", async ({ page }) => {
  const errors = [];
  const blocked = [];
  const dialogs = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => {
    dialogs.push(dialog.message());
    await dialog.accept();
  });
  await page.addInitScript(() => {
    const month = new Date().toISOString().slice(0, 7);
    const person = { personId: "TEST-PAY-001", employeeNo: "TEST-PAY-001", name: "TEST工资管理员", position: "管理员", status: "approved", approvalStatus: "approved" };
    const driver = { personId: "TEST-PAY-002", employeeNo: "TEST-PAY-002", name: "TEST汽车司机", position: "汽车司机", status: "approved", approvalStatus: "approved" };
    localStorage.setItem("personnelRecords", JSON.stringify([person, driver]));
    localStorage.setItem("currentPersonId", person.personId);
    localStorage.setItem("selectedPosition", "管理员");
    sessionStorage.setItem("managementSession", JSON.stringify({ verified: true, personId: person.personId, position: "管理员", expiresAt: Date.now() + 600000 }));
    localStorage.setItem("adminAttendanceMonthlyLocks", "[]");
    localStorage.setItem("payrollStandards", "[]");
    localStorage.setItem("payrollMonthlyRecords", "[]");
    localStorage.setItem("payrollMonthlyLocks", "[]");
    localStorage.setItem("payrollAuditLogs", "[]");
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
      return route.fulfill({ status: 200, contentType: path.extname(file) === ".html" ? "text/html; charset=utf-8" : "text/javascript; charset=utf-8", body: await fs.readFile(file) });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  await page.goto(`${ORIGIN}/report-center.html`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#payrollAttendanceLockStatus")).toContainText("尚未最终锁定");
  await page.getByRole("button", { name: "重新生成工资表" }).click();
  await expect.poll(() => dialogs.at(-1)).toContain("尚未最终锁定");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("payrollMonthlyRecords") || "[]"))).toHaveLength(0);

  await page.evaluate(() => {
    const month = document.getElementById("payrollMonth").value;
    const people = JSON.parse(localStorage.getItem("personnelRecords") || "[]");
    localStorage.setItem("adminAttendanceMonthlyLocks", JSON.stringify([{ lockId: `ADMIN_ATT_LOCK_${month.replaceAll("-", "")}`, month, status: "locked", lockedBy: "TEST管理员", totalAttendance: 40, rows: people.map(person => ({ personId: person.personId, employeeNo: person.employeeNo, personName: person.name, finalAttendance: 20, deduction: 0 })) }]));
    window.renderPayroll();
  });
  await expect(page.locator("#payrollAttendanceLockStatus")).toContainText("已读取正式锁定考勤");
  await page.getByRole("button", { name: "最终确认并锁定工资" }).click();
  await expect.poll(() => dialogs.at(-1)).toContain("尚未设置有效工资标准");
  const state = await page.evaluate(() => ({
    standards: JSON.parse(localStorage.getItem("payrollStandards") || "[]"),
    locks: JSON.parse(localStorage.getItem("payrollMonthlyLocks") || "[]"),
    monthly: JSON.parse(localStorage.getItem("payrollMonthlyRecords") || "[]")
  }));
  expect(state.standards).toHaveLength(0);
  expect(state.locks).toHaveLength(0);
  expect(state.monthly).toHaveLength(2);
  expect(state.monthly.every(row => !row.salaryStandardId)).toBeTruthy();
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
