"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST最终考勤保存遇到审计存储失败时不改变考勤或日确认状态", async ({ page }) => {
  const errors = [];
  const dialogs = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => {
    dialogs.push(dialog.message());
    await dialog.accept();
  });

  await page.addInitScript(() => {
    const date = new Date();
    const day = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
    const personId = "TEST-ATT-AUDIT-WORKER";
    const adminId = "TEST-ATT-AUDIT-ADMIN";
    const now = new Date().toISOString();

    localStorage.setItem("personnelRecords", JSON.stringify([
      {
        personId: adminId,
        employeeNo: adminId,
        name: "TEST考勤管理员",
        position: "管理员",
        status: "approved",
        approvalStatus: "approved",
        personnelStatus: "在职可用",
        testFixture: true
      },
      {
        personId,
        employeeNo: personId,
        name: "TEST考勤人员",
        position: "汽车司机",
        team: "生产A组",
        status: "approved",
        approvalStatus: "approved",
        personnelStatus: "在职可用",
        testFixture: true
      }
    ]));
    localStorage.setItem("adminFinalAttendanceRecords", JSON.stringify([{
      finalRecordId: day + "|" + personId,
      personId,
      personName: "TEST考勤人员",
      employeeNo: personId,
      position: "汽车司机",
      department: "生产A组",
      date: day,
      referenceValue: 0,
      referenceSource: "test",
      finalAttendance: 0.5,
      reason: "TEST原始最终考勤",
      confirmationSource: "admin_manual",
      confirmedBy: "TEST考勤管理员",
      confirmedAt: now,
      updatedAt: now
    }]));
    localStorage.setItem("adminDailyAttendanceFinalConfirmations", JSON.stringify([{
      dailyFinalId: "ADMIN_DAY_FINAL_" + day.replaceAll("-", ""),
      date: day,
      status: "confirmed",
      personCount: 1,
      totalAttendance: 0.5,
      confirmedAt: now,
      confirmedBy: "TEST考勤管理员"
    }]));
    localStorage.setItem("adminAttendanceAuditLogs", "[]");
    localStorage.setItem("TEST-ATT-AUDIT-FAIL", "0");

    sessionStorage.setItem("managementSession", JSON.stringify({
      verified: true,
      personId: adminId,
      position: "管理员",
      expiresAt: Date.now() + 60 * 60 * 1000
    }));

    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (
        this === window.localStorage &&
        key === "adminAttendanceAuditLogs" &&
        localStorage.getItem("TEST-ATT-AUDIT-FAIL") === "1"
      ) {
        const error = new DOMException("Injected test storage failure", "QuotaExceededError");
        throw error;
      }
      return originalSetItem.call(this, key, value);
    };
    window.__TEST_ATTENDANCE_DATE__ = day;
  });

  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== ORIGIN || !["GET", "HEAD"].includes(request.method())) {
      return route.abort();
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) {
      return route.fulfill({ status: 403, body: "blocked" });
    }
    try {
      const body = await fs.readFile(file);
      const ext = path.extname(file);
      const contentType = ext === ".html"
        ? "text/html; charset=utf-8"
        : ext === ".js"
          ? "text/javascript; charset=utf-8"
          : ext === ".css"
            ? "text/css; charset=utf-8"
            : "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing isolated test asset" });
    }
  });

  await page.goto(`${ORIGIN}/admin-review.html`, { waitUntil: "domcontentloaded" });
  await page.locator("#openFinalAttendanceButton").click();
  await page.locator('[data-final-attendance-edit="TEST-ATT-AUDIT-WORKER"]').click();
  const editModal = page.locator("#finalAttendanceEditModal");
  await expect(editModal).toBeVisible();
  await page.locator("#finalAttendanceEditValue").selectOption("1");
  await page.locator("#finalAttendanceEditReason").fill("TEST验证审计失败时回滚");
  await page.evaluate(() => localStorage.setItem("TEST-ATT-AUDIT-FAIL", "1"));
  await page.locator("#saveFinalAttendanceEditButton").click();

  await expect.poll(() => dialogs.some(message => message.includes("保存失败"))).toBe(true);
  await expect(editModal).toBeVisible();

  const state = await page.evaluate(() => ({
    date: window.__TEST_ATTENDANCE_DATE__,
    final: JSON.parse(localStorage.getItem("adminFinalAttendanceRecords") || "[]")
      .find(row => row.personId === "TEST-ATT-AUDIT-WORKER"),
    daily: JSON.parse(localStorage.getItem("adminDailyAttendanceFinalConfirmations") || "[]")
      .find(row => row.date === window.__TEST_ATTENDANCE_DATE__),
    audit: JSON.parse(localStorage.getItem("adminAttendanceAuditLogs") || "[]")
  }));
  expect(state.final.finalAttendance).toBe(0.5);
  expect(state.daily.status).toBe("confirmed");
  expect(state.audit).toEqual([]);
  expect(errors).toEqual([]);
});
