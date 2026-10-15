"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("工资锁定和解锁审计写入失败时回滚，重试后只保留完整记录", async ({ page }) => {
  const errors = [];
  const dialogs = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => {
    dialogs.push(dialog.message());
    await dialog.accept();
  });

  await page.addInitScript(() => {
    localStorage.setItem("personnelRecords", "[]");
    localStorage.setItem("currentPersonId", "");
    localStorage.setItem("selectedPosition", "");
    localStorage.setItem("payrollMonthlyLocks", "[]");
    localStorage.setItem("payrollAuditLogs", "[]");
  });

  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!["GET", "HEAD"].includes(request.method()) || url.origin !== ORIGIN) {
      return route.abort();
    }

    const file = path.resolve(
      ROOT,
      decodeURIComponent(url.pathname).replace(/^\\/+/, "") || "index.html"
    );
    if (!file.startsWith(ROOT + path.sep)) {
      return route.fulfill({ status: 403, body: "blocked" });
    }

    try {
      return route.fulfill({
        status: 200,
        contentType: path.extname(file) === ".html"
          ? "text/html; charset=utf-8"
          : "text/javascript; charset=utf-8",
        body: await fs.readFile(file)
      });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  await page.goto(`${ORIGIN}/report-center.html`, { waitUntil: "domcontentloaded" });

  const locked = {
    lockId: "TEST-PAYROLL-LOCK-001",
    month: "2026-10",
    status: "locked",
    rows: [{ personId: "TEST-PERSON-001", payableSalary: 5000 }]
  };
  const unlocked = { ...locked, status: "unlocked", unlockReason: "TEST更正" };

  const failedLockSave = await page.evaluate(candidate => {
    const original = Storage.prototype.setItem;
    let shouldFail = true;
    Storage.prototype.setItem = function (key, value) {
      if (key === "payrollAuditLogs" && shouldFail) {
        shouldFail = false;
        throw new DOMException("TEST storage write failure", "QuotaExceededError");
      }
      return original.call(this, key, value);
    };
    try {
      return window.commitPayrollLockAndAudit(
        [candidate],
        { action: "lock_payroll", month: candidate.month, payrollLockId: candidate.lockId },
        "TEST工资锁定保存失败"
      );
    } finally {
      Storage.prototype.setItem = original;
    }
  }, locked);

  expect(failedLockSave).toBe(false);
  await expect.poll(() => dialogs.at(-1)).toContain("TEST工资锁定保存失败");
  let stored = await page.evaluate(() => ({
    locks: JSON.parse(localStorage.getItem("payrollMonthlyLocks") || "[]"),
    audit: JSON.parse(localStorage.getItem("payrollAuditLogs") || "[]")
  }));
  expect(stored).toEqual({ locks: [], audit: [] });

  const lockRetry = await page.evaluate(candidate =>
    window.commitPayrollLockAndAudit(
      [candidate],
      { action: "lock_payroll", month: candidate.month, payrollLockId: candidate.lockId },
      "TEST工资锁定保存失败"
    ), locked);
  expect(lockRetry).toBe(true);

  const failedUnlockSave = await page.evaluate(candidate => {
    const original = Storage.prototype.setItem;
    let shouldFail = true;
    Storage.prototype.setItem = function (key, value) {
      if (key === "payrollAuditLogs" && shouldFail) {
        shouldFail = false;
        throw new DOMException("TEST storage write failure", "QuotaExceededError");
      }
      return original.call(this, key, value);
    };
    try {
      return window.commitPayrollLockAndAudit(
        [candidate],
        { action: "unlock_payroll", month: candidate.month, payrollLockId: candidate.lockId, reason: candidate.unlockReason },
        "TEST工资解锁保存失败"
      );
    } finally {
      Storage.prototype.setItem = original;
    }
  }, unlocked);

  expect(failedUnlockSave).toBe(false);
  await expect.poll(() => dialogs.at(-1)).toContain("TEST工资解锁保存失败");
  stored = await page.evaluate(() => ({
    locks: JSON.parse(localStorage.getItem("payrollMonthlyLocks") || "[]"),
    audit: JSON.parse(localStorage.getItem("payrollAuditLogs") || "[]")
  }));
  expect(stored.locks).toEqual([locked]);
  expect(stored.audit.map(row => row.action)).toEqual(["lock_payroll"]);

  const unlockRetry = await page.evaluate(candidate =>
    window.commitPayrollLockAndAudit(
      [candidate],
      { action: "unlock_payroll", month: candidate.month, payrollLockId: candidate.lockId, reason: candidate.unlockReason },
      "TEST工资解锁保存失败"
    ), unlocked);
  expect(unlockRetry).toBe(true);

  stored = await page.evaluate(() => ({
    locks: JSON.parse(localStorage.getItem("payrollMonthlyLocks") || "[]"),
    audit: JSON.parse(localStorage.getItem("payrollAuditLogs") || "[]")
  }));
  expect(stored.locks).toEqual([unlocked]);
  expect(stored.audit.map(row => row.action)).toEqual(["lock_payroll", "unlock_payroll"]);
  expect(stored.audit[1].reason).toBe("TEST更正");
  expect(errors).toEqual([]);
});
