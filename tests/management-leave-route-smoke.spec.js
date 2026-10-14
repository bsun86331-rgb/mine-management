"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST管理岗位请假提交总经理审批且不进入调度审批列表", async ({ page }) => {
  const errors = [];
  const blocked = [];
  const alerts = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => { alerts.push(dialog.message()); await dialog.accept(); });
  await page.addInitScript(() => {
    const managerId = "TEST-MGMT-LEAVE-001";
    const dispatcherId = "TEST-DISPATCH-LEAVE-001";
    if (!localStorage.getItem("TEST-HARNESS-LEAVE-INIT")) {
      localStorage.setItem("personnelRecords", JSON.stringify([
        {
          personId: managerId, employeeId: managerId, employeeNo: managerId,
          name: "TEST统计员", position: "统计", team: "管理组",
          status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true
        },
        {
          personId: dispatcherId, employeeId: dispatcherId, employeeNo: dispatcherId,
          name: "TEST调度员", position: "车队长", team: "生产A组",
          status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true
        }
      ]));
      localStorage.setItem("currentPersonId", managerId);
      localStorage.setItem("selectedPosition", "统计");
      localStorage.setItem("leaveRequests", "[]");
      localStorage.setItem("TEST-HARNESS-LEAVE-INIT", "1");
    }
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (this === window.localStorage && key === "leaveRequests") {
        try {
          const rows = JSON.parse(value);
          for (const row of rows || []) {
            if (row.applicantId === "TEST-MGMT-LEAVE-001" && !String(row.leaveId || "").startsWith("TEST-")) row.leaveId = "TEST-LEAVE-MGMT-001";
          }
          value = JSON.stringify(rows);
        } catch {}
      }
      return originalSetItem.call(this, key, value);
    };
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
      const ext = path.extname(file);
      const contentType = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body: await fs.readFile(file) });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  await page.goto(`${ORIGIN}/leave-request.html`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#personPosition")).toHaveText("统计");
  await expect(page.locator("#approvalRouteText")).toContainText("总经理审批");
  const day = await page.evaluate(() => {
    const date = new Date(Date.now() + 7 * 86400000);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  });
  await page.locator("#leaveStartDate").fill(day);
  await page.locator("#leaveEndDate").fill(day);
  await page.locator("#leaveReason").fill("TEST管理岗位请假路由验证");
  await page.getByRole("button", { name: "提交审批" }).click();

  let request = await page.evaluate(() => JSON.parse(localStorage.getItem("leaveRequests") || "[]")[0]);
  expect(request).toMatchObject({
    leaveId: "TEST-LEAVE-MGMT-001", applicantId: "TEST-MGMT-LEAVE-001",
    position: "统计", approvalRoute: "general_manager", approverRole: "general_manager",
    approvalLevel: "总经理审批", status: "pending"
  });

  await page.evaluate(() => {
    localStorage.setItem("currentPersonId", "TEST-DISPATCH-LEAVE-001");
    localStorage.setItem("selectedPosition", "车队长");
  });
  await page.goto(`${ORIGIN}/dispatch.html`, { waitUntil: "domcontentloaded" });
  await page.locator("#openLeaveReviewButton").click();
  const modal = page.locator("#leaveReviewModal");
  await expect(modal).toBeVisible();
  await expect(modal.locator('[data-leave-approve="TEST-LEAVE-MGMT-001"]')).toHaveCount(0);
  await expect(modal).not.toContainText("TEST统计员");
  request = await page.evaluate(() => JSON.parse(localStorage.getItem("leaveRequests") || "[]")[0]);
  expect(request.status).toBe("pending");
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
  expect(alerts.some(message => message.includes("总经理审批"))).toBe(true);
});
