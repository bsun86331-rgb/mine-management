"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const { evidencePath } = require("./evidence-path.cjs");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST 调度可审核排土管理请假", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => {
    if (dialog.type() === "prompt") await dialog.accept("");
    else await dialog.accept();
  });
  await page.addInitScript(() => {
    const dispatcher = "TEST-DISPATCH-001";
    const applicant = "TEST-DUMP-LEAVE-001";
    localStorage.setItem("personnelRecords", JSON.stringify([
      { personId: dispatcher, employeeId: dispatcher, employeeNo: dispatcher, name: "TEST调度", position: "车队长", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true },
      { personId: applicant, employeeId: applicant, employeeNo: applicant, name: "TEST排土管理员", position: "排土管理", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true }
    ]));
    localStorage.setItem("currentPersonId", dispatcher);
    localStorage.setItem("selectedPosition", "车队长");
    localStorage.setItem("leaveRequests", JSON.stringify([{ leaveId: "TEST-LEAVE-001", applicantId: applicant, personId: applicant, applicantName: "TEST排土管理员", personName: "TEST排土管理员", position: "排土管理", team: "生产A组", leaveType: "事假", leaveDays: 0.5, startTime: "2030-01-01T00:00:00.000Z", endTime: "2030-01-01T04:00:00.000Z", reason: "TEST请假", status: "pending", approverRole: "dispatch", approvalRoute: "dispatch", approvalLevel: "调度审批", testFixture: true }]));
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

  await page.goto(`${ORIGIN}/dispatch.html`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".dispatch-header-badge")).toContainText("V2.14.3");
  await page.locator("#openLeaveReviewButton").click();
  const modal = page.locator("#leaveReviewModal");
  await expect(modal).toBeVisible();
  await expect(modal.locator("h3")).toHaveText("🗓 一线人员请假审批");
  await expect(page.locator("#openLeaveReviewButton")).toHaveAttribute("aria-label", "一线人员请假，1 条待审批");
  await expect(modal).toContainText("TEST排土管理员");
  await page.screenshot({ path: evidencePath("证据_OPS-05_调度一线请假待办标题", "dump-leave-approval-smoke"), fullPage: true });
  await modal.locator('[data-leave-approve="TEST-LEAVE-001"]').click();
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("leaveRequests") || "[]")[0]?.status)).toBe("approved");
  await expect.poll(() => page.locator("#openLeaveReviewButton").getAttribute("aria-label")).toBe("一线人员请假");
  await expect(modal).toContainText("暂无一线人员请假待审批");
  const request = await page.evaluate(() => JSON.parse(localStorage.getItem("leaveRequests") || "[]")[0]);
  expect(request.leaveId).toBe("TEST-LEAVE-001");
  expect(request.approvedBy).toBe("调度端");
  expect(await modal.locator('[data-leave-approve="TEST-LEAVE-001"]').count()).toBe(0);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
