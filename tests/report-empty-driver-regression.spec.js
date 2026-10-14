"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST报表在没有已审核汽车司机时仍能初始化", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    const adminId = "TEST-ADMIN-EMPTY-REPORT-001";
    localStorage.setItem("personnelRecords", JSON.stringify([
      { personId: adminId, employeeId: adminId, name: "TEST报表管理员", position: "管理员", team: "后勤办公组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true },
      { personId: "TEST-DUMP-EMPTY-REPORT-001", employeeId: "TEST-DUMP-EMPTY-REPORT-001", name: "TEST排土管理", position: "排土管理", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true }
    ]));
    localStorage.setItem("currentPersonId", adminId);
    localStorage.setItem("selectedPosition", "管理员");
    localStorage.setItem("performanceRankingRecords", "[]");
    localStorage.setItem("tripRecords", "[]");
  });
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!["GET", "HEAD"].includes(request.method()) || url.origin !== ORIGIN) {
      blocked.push(`${request.method()} ${request.url()}`);
      return route.abort();
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const ext = path.extname(file).toLowerCase();
      const contentType = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body: await fs.readFile(file) });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  const response = await page.goto(`${ORIGIN}/report-center.html`, { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await expect(page.locator("#personPosition")).toHaveText("管理员");
  await expect(page.locator('[data-report="attendance"]')).toBeVisible();
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});


