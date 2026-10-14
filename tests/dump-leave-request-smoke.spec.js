"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST 排土管理请假进入调度审批并拦截重复时段", async ({ page }) => {
  const errors = [];
  const blocked = [];
  const alerts = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => { alerts.push(dialog.message()); await dialog.accept(); });
  await page.addInitScript(() => {
    const personId = "TEST-DUMP-LEAVE-001";
    localStorage.setItem("personnelRecords", JSON.stringify([{ personId, employeeId: personId, employeeNo: personId, name: "TEST排土管理员", position: "排土管理", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", phone: "13800000000", testFixture: true }]));
    localStorage.setItem("currentPersonId", personId);
    localStorage.setItem("selectedPosition", "排土管理");
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

  await page.goto(`${ORIGIN}/leave-request.html`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#personPosition")).toHaveText("排土管理");
  await expect(page.locator("#approvalRouteText")).toContainText("调度审批");
  const day = await page.evaluate(() => {
    const d = new Date(Date.now() + 7 * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  await page.locator("#leaveStartDate").fill(day);
  await page.locator("#leaveEndDate").fill(day);
  await page.locator("#leaveStartHalf").selectOption("AM");
  await page.locator("#leaveEndHalf").selectOption("AM");
  await expect(page.locator("#leaveDays")).toHaveValue("0.5");
  await page.locator("#leaveReason").fill("TEST排土场轮休");
  await page.getByRole("button", { name: "提交审批" }).click();
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("leaveRequests") || "[]").length)).toBe(1);
  let rows = await page.evaluate(() => JSON.parse(localStorage.getItem("leaveRequests") || "[]"));
  expect(rows[0].leaveId).toBeTruthy();
  expect(rows[0].applicantId).toBe("TEST-DUMP-LEAVE-001");
  expect(rows[0].approvalRoute).toBe("dispatch");
  expect(rows[0].approvalLevel).toBe("调度审批");
  expect(rows[0].leaveDays).toBe(0.5);
  expect(rows[0].status).toBe("pending");

  await page.locator("#leaveReason").fill("TEST重复申请");
  await page.getByRole("button", { name: "提交审批" }).click();
  await expect.poll(() => alerts.length).toBe(2);
  expect(alerts[1]).toContain("已有待审批或已批准请假申请");
  rows = await page.evaluate(() => JSON.parse(localStorage.getItem("leaveRequests") || "[]"));
  expect(rows).toHaveLength(1);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

