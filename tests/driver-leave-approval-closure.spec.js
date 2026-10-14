"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST 汽车司机提交请假后由调度审批并回写状态", async ({ page }) => {
  const errors = [];
  const blocked = [];
  const alerts = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => { alerts.push(dialog.message()); await dialog.accept(); });
  await page.addInitScript(() => {
    const driverId = "TEST-DRIVER-LEAVE-001";
    const dispatcherId = "TEST-DISPATCH-LEAVE-001";
    localStorage.setItem("personnelRecords", JSON.stringify([
      { personId: driverId, employeeId: driverId, employeeNo: driverId, name: "TEST汽车司机请假", position: "汽车司机", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true },
      { personId: dispatcherId, employeeId: dispatcherId, employeeNo: dispatcherId, name: "TEST调度请假审批", position: "车队长", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true }
    ]));
    localStorage.setItem("currentPersonId", driverId);
    localStorage.setItem("selectedPosition", "汽车司机");
  });
  await page.route("**/*", async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (!["GET", "HEAD"].includes(req.method()) || url.origin !== ORIGIN) {
      blocked.push(`${req.method()} ${req.url()}`);
      return route.abort();
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const body = await fs.readFile(file);
      const ext = path.extname(file).toLowerCase();
      const contentType = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  await page.goto(`${ORIGIN}/driver-work.html`, { waitUntil: "domcontentloaded" });
  await page.locator("#mineBottomQuickActions").getByRole("button", { name: /请假申请/ }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/leave-request.html");
  await expect(page.locator("#personPosition")).toHaveText("汽车司机");
  await expect(page.locator("#approvalRouteText")).toContainText("调度审批");
  const day = await page.evaluate(() => {
    const date = new Date(Date.now() + 7 * 86400000);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  });
  await page.locator("#leaveStartDate").fill(day);
  await page.locator("#leaveEndDate").fill(day);
  await page.locator("#leaveContactPhone").fill("TEST-00000000");
  await page.locator("#leaveReason").fill("TEST轮休申请");
  await expect(page.locator("#leaveDays")).toHaveValue("0.5");
  await page.getByRole("button", { name: "提交审批" }).click();
  await expect.poll(() => alerts.length).toBe(1);
  let rows = await page.evaluate(() => JSON.parse(localStorage.getItem("leaveRequests") || "[]"));
  expect(rows).toHaveLength(1);
  const createdLeaveId = rows[0].leaveId;
  expect(createdLeaveId).toBeTruthy();
  expect(rows[0]).toMatchObject({
    leaveId: expect.any(String),
    applicantId: "TEST-DRIVER-LEAVE-001",
    position: "汽车司机",
    team: "生产A组",
    approverRole: "dispatch",
    status: "pending"
  });
  expect(rows[0].startTime).toBeTruthy();
  expect(rows[0].endTime).toBeTruthy();

  await page.evaluate(() => {
    localStorage.setItem("currentPersonId", "TEST-DISPATCH-LEAVE-001");
    localStorage.setItem("selectedPosition", "车队长");
  });
  await page.goto(`${ORIGIN}/dispatch.html`, { waitUntil: "domcontentloaded" });
  await page.locator("#openLeaveReviewButton").click();
  const modal = page.locator("#leaveReviewModal");
  await expect(modal).toBeVisible();
  await expect(modal).toContainText("TEST汽车司机请假");
  await modal.locator(`[data-leave-approve="${createdLeaveId}"]`).click();
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("leaveRequests") || "[]")[0]?.status)).toBe("approved");
  rows = await page.evaluate(() => JSON.parse(localStorage.getItem("leaveRequests") || "[]"));
  expect(rows[0]).toMatchObject({
    leaveId: expect.any(String),
    applicantId: "TEST-DRIVER-LEAVE-001",
    status: "approved",
    approvedBy: "调度端"
  });
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

