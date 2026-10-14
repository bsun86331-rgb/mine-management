"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST 排土管理岗位可在考勤报表按岗位筛选", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.stack || error.message));
  await page.addInitScript(() => {
    const adminId = "TEST-ADMIN-REPORT-001";
    localStorage.setItem("personnelRecords", JSON.stringify([
      { personId: adminId, employeeId: adminId, employeeNo: adminId, name: "TEST报表管理员", position: "管理员", team: "后勤办公组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true },
      { personId: "TEST-DUMP-REPORT-001", employeeId: "TEST-DUMP-REPORT-001", employeeNo: "TEST-DUMP-REPORT-001", name: "TEST排土管理员", position: "排土管理", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true },
      { personId: "TEST-DRIVER-REPORT-001", employeeId: "TEST-DRIVER-REPORT-001", employeeNo: "TEST-DRIVER-REPORT-001", name: "TEST汽车司机", position: "汽车司机", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", entryDate: "2025-01-01", testFixture: true }
    ]));
    localStorage.setItem("currentPersonId", adminId);
    localStorage.setItem("selectedPosition", "管理员");
  });
  await page.route("**/*", async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (!['GET', 'HEAD'].includes(req.method()) || url.origin !== ORIGIN) {
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

  await page.goto(`${ORIGIN}/report-center.html`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#personPosition")).toHaveText("管理员");
  const payrollOptions = await page.locator("#payrollPositionFilter option").allTextContents();
  expect(payrollOptions).toContain("排土管理");
  const attendanceOptions = await page.locator("#attendancePositionFilter option").allTextContents();
  expect(attendanceOptions).toContain("排土管理");
  await page.locator('[data-report="attendance"]').click();
  await page.locator("#attendancePositionFilter").selectOption("排土管理");
  await page.evaluate(() => renderAttendance());
  await expect(page.locator("#attendanceTableBody")).toContainText("TEST排土管理员");
  await expect(page.locator("#attendanceTableBody")).not.toContainText("TEST汽车司机");
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});


