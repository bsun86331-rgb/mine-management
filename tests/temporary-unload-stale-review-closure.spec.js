"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST临时卸料被一个窗口处理后旧审核窗口不能覆盖状态", async ({ page }) => {
  const blocked = [];
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("personnelRecords", JSON.stringify([
      { personId: "TEST-UNLOAD-CONFLICT-DISPATCH", employeeNo: "TEST-UNLOAD-CONFLICT-DISPATCH", name: "TEST调度", position: "车队长", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用" }
    ]));
    localStorage.setItem("currentPersonId", "TEST-UNLOAD-CONFLICT-DISPATCH");
    localStorage.setItem("selectedPosition", "车队长");
    localStorage.setItem("temporaryUnloadRequests", JSON.stringify([
      { requestId: "TEST-UNLOAD-CONFLICT-001", taskId: "TEST-UNLOAD-TASK", driverId: "TEST-UNLOAD-DRIVER", driverName: "TEST司机", vehicleNumber: "TEST矿卡", materialType: "渣", reason: "TEST并发审核", status: "pending_dispatch", createdAt: new Date().toISOString() }
    ]));
    localStorage.setItem("tripRecords", "[]");
  });
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!["GET", "HEAD"].includes(request.method()) || url.origin !== ORIGIN) {
      blocked.push(request.method() + " " + request.url());
      return route.abort();
    }
    const relative = url.pathname.split("/").filter(Boolean).join("/") || "index.html";
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const body = await fs.readFile(file);
      const ext = path.extname(file).toLowerCase();
      const contentType = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing TEST asset" });
    }
  });

  await page.goto(`${ORIGIN}/dispatch.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const realConfirm = window.confirm;
    const alerts = [];
    let nested = false;
    window.alert = message => alerts.push(String(message));
    window.confirm = () => {
      if (!nested) {
        nested = true;
        window.confirm = () => true;
        temporaryUnloadReject("TEST-UNLOAD-CONFLICT-001");
        window.confirm = realConfirm;
        return true;
      }
      return true;
    };
    temporaryUnloadApprove("TEST-UNLOAD-CONFLICT-001");
    window.confirm = realConfirm;
    window.__TEST_UNLOAD_CONFLICT_ALERTS__ = alerts;
  });

  const result = await page.evaluate(() => ({
    request: JSON.parse(localStorage.getItem("temporaryUnloadRequests") || "[]")[0],
    trips: JSON.parse(localStorage.getItem("tripRecords") || "[]"),
    alerts: window.__TEST_UNLOAD_CONFLICT_ALERTS__
  }));
  expect(result.request).toMatchObject({ requestId: "TEST-UNLOAD-CONFLICT-001", status: "rejected", officialCountEligible: false });
  expect(result.trips).toHaveLength(0);
  expect(result.alerts.some(message => message.includes("已经处理"))).toBeTruthy();
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
