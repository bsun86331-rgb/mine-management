"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST工资标准生成并锁定快照，解锁更正必须写明原因且进入审计", async ({ page }) => {
  const errors = [];
  const blocked = [];
  const dialogs = [];
  const promptAnswers = ["", "TEST更正工资标准"];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => {
    dialogs.push(dialog.message());
    if (dialog.type() === "prompt") await dialog.accept(promptAnswers.shift());
    else await dialog.accept();
  });
  await page.addInitScript(() => {
    const month = new Date().toISOString().slice(0, 7);
    const admin = { personId: "TEST-PAYLOCK-001", employeeNo: "TEST-PAYLOCK-001", name: "TEST工资管理员", position: "管理员", status: "approved", approvalStatus: "approved" };
    const driver = { personId: "TEST-PAYLOCK-002", employeeNo: "TEST-PAYLOCK-002", name: "TEST汽车司机", position: "汽车司机", status: "approved", approvalStatus: "approved" };
    localStorage.setItem("personnelRecords", JSON.stringify([admin, driver]));
    localStorage.setItem("currentPersonId", admin.personId);
    localStorage.setItem("selectedPosition", "管理员");
    sessionStorage.setItem("managementSession", JSON.stringify({ verified: true, personId: admin.personId, position: "管理员", expiresAt: Date.now() + 600000 }));
    localStorage.setItem("adminAttendanceMonthlyLocks", JSON.stringify([{ lockId: `ADMIN_ATT_LOCK_${month.replaceAll("-", "")}`, month, status: "locked", lockedBy: "TEST管理员", totalAttendance: 40, rows: [admin, driver].map(person => ({ personId: person.personId, employeeNo: person.employeeNo, personName: person.name, finalAttendance: 20, deduction: 0 })) }]));
    localStorage.setItem("payrollStandards", JSON.stringify([
      { standardId: "TEST-PAYROLL-ADMIN", scope: "person", standardType: "fixed_person", personId: admin.personId, position: "管理员", salaryMode: "fixed", salaryStage: "regular", probationSalary: 3000, regularSalary: 3000, baseSalary: 3000, effectiveDate: "2026-01-01", status: "active" },
      { standardId: "TEST-PAYROLL-DRIVER", scope: "position", standardType: "frontline_position", position: "汽车司机", salaryMode: "performance", baseSalary: 5000, performanceUnitPrice: 0, effectiveDate: "2026-01-01", status: "active" }
    ]));
    localStorage.setItem("payrollMonthlyRecords", "[]");
    localStorage.setItem("payrollMonthlyLocks", "[]");
    localStorage.setItem("payrollAuditLogs", "[]");
    localStorage.setItem("tripRecords", "[]");
    localStorage.setItem("driverTripRecords", "[]");
    localStorage.setItem("rewardRecords", "[]");
    localStorage.setItem("penaltyRecords", "[]");
    localStorage.setItem("overtimeRecords", "[]");
    localStorage.setItem("performanceRankingRecords", "[]");
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
  await expect(page.locator("#payrollAttendanceLockStatus")).toContainText("已读取正式锁定考勤");
  await expect(page.locator("#payrollTableBody tr")).toHaveCount(2);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("payrollMonthlyRecords") || "[]").map(row => ({ personId: row.personId, salaryStandardId: row.salaryStandardId, payableSalary: row.payableSalary })));
  expect(before).toHaveLength(2);
  expect(before.every(row => row.salaryStandardId && Number(row.payableSalary) > 0)).toBeTruthy();

  await page.getByRole("button", { name: "最终确认并锁定工资" }).click();
  await expect.poll(() => dialogs.at(-1)).toContain("已最终确认并锁定");
  const lockedBeforeChange = await page.evaluate(() => JSON.parse(localStorage.getItem("payrollMonthlyLocks") || "[]"));
  expect(lockedBeforeChange).toHaveLength(1);
  expect(lockedBeforeChange[0]).toMatchObject({ status: "locked", personCount: 2 });
  const lockedValues = lockedBeforeChange[0].rows.map(row => [row.personId, row.payableSalary]);

  await page.evaluate(() => {
    const standards = JSON.parse(localStorage.getItem("payrollStandards") || "[]");
    standards.forEach(row => { row.baseSalary = 99999; row.regularSalary = 99999; });
    localStorage.setItem("payrollStandards", JSON.stringify(standards));
    window.generateMonthlyPayroll(true);
  });
  await expect.poll(() => dialogs.at(-1)).toContain("已经最终锁定");
  const lockedAfterChange = await page.evaluate(() => JSON.parse(localStorage.getItem("payrollMonthlyLocks") || "[]")[0]);
  expect(lockedAfterChange.rows.map(row => [row.personId, row.payableSalary])).toEqual(lockedValues);

  await page.getByRole("button", { name: "解锁更正" }).click();
  await expect.poll(() => dialogs.filter(message => message.includes("解锁更正必须填写原因"))).toHaveLength(1);
  let locks = await page.evaluate(() => JSON.parse(localStorage.getItem("payrollMonthlyLocks") || "[]"));
  expect(locks[0].status).toBe("locked");
  await page.getByRole("button", { name: "解锁更正" }).click();
  await expect.poll(() => dialogs.at(-1)).toContain("已解锁");
  locks = await page.evaluate(() => JSON.parse(localStorage.getItem("payrollMonthlyLocks") || "[]"));
  const audit = await page.evaluate(() => JSON.parse(localStorage.getItem("payrollAuditLogs") || "[]"));
  expect(locks[0]).toMatchObject({ status: "unlocked", unlockReason: "TEST更正工资标准" });
  expect(audit.map(row => row.action)).toEqual(["lock_payroll", "unlock_payroll"]);
  expect(audit[1].reason).toBe("TEST更正工资标准");
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
