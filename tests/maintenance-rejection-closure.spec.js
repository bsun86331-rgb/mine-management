"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST维修申请被调度驳回后保留原因且不进入修理厂", async ({ page }) => {
  const errors = [];
  const blocked = [];
  const dialogs = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => {
    dialogs.push(dialog.message());
    if (dialog.type() === "prompt") await dialog.accept("TEST设备无法安全运行，补充检查后再申请");
    else await dialog.accept();
  });
  await page.addInitScript(() => {
    localStorage.setItem("personnelRecords", JSON.stringify([
      { personId: "TEST-DISPATCH-REJECT-001", employeeId: "TEST-DISPATCH-REJECT-001", employeeNo: "TEST-DISPATCH-REJECT-001", name: "TEST调度", position: "车队长", team: "管理组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true },
    ]));
    localStorage.setItem("currentPersonId", "TEST-DISPATCH-REJECT-001");
    localStorage.setItem("selectedPosition", "车队长");
    localStorage.setItem("maintenanceRequests", JSON.stringify([{
      requestId: "TEST-REPAIR-REJECT-001", maintenanceRequestId: "TEST-REPAIR-REJECT-001", source: "equipment_usage_check",
      equipmentId: "TEST-TRUCK-REJECT-001", equipmentNumber: "TEST-TRUCK-REJECT-001", equipmentType: "汽车",
      reportedById: "TEST-DRIVER-REJECT-001", reportedByName: "TEST司机", applicantName: "TEST司机",
      status: "pending_dispatch", dispatchStatus: "pending", dispatchRequired: true, maintenanceType: "故障维修",
      description: "TEST转向异常", createdAt: new Date().toISOString(), testFixture: true
    }]));
    localStorage.setItem("maintenanceWorkOrders", "[]");
    localStorage.setItem("equipmentOperationalStatus", JSON.stringify([
      { equipmentId: "TEST-TRUCK-REJECT-001", status: "maintenance", previousStatus: "available", source: "repair_flow", testFixture: true }
    ]));
    localStorage.setItem("vehicleRecords", JSON.stringify([
      { vehicleNumber: "TEST-TRUCK-REJECT-001", status: "maintenance", currentStatus: "维修中", testFixture: true }
    ]));
    const originalSetItem = Storage.prototype.setItem;
    let failRequestWriteOnce = true;
    Storage.prototype.setItem = function (key, value) {
      if (key === "maintenanceRequests" && failRequestWriteOnce) {
        failRequestWriteOnce = false;
        throw new Error("TEST quota failure");
      }
      return originalSetItem.call(this, key, value);
    };
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
      const body = await fs.readFile(file);
      const ext = path.extname(file);
      const contentType = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  await page.goto(`${ORIGIN}/dispatch.html`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#maintenanceReviewTodoCount")).toHaveText("1");
  await page.locator("#openMaintenanceReviewButton").click();
  await expect(page.locator("#maintenanceReviewList")).toContainText("TEST-TRUCK-REJECT-001");
  await page.locator("#maintenanceReviewList").getByRole("button", { name: "❌ 驳回申请" }).click();

  let request = await page.evaluate(() => JSON.parse(localStorage.getItem("maintenanceRequests"))[0]);
  expect(request).toMatchObject({ status: "pending_dispatch", dispatchStatus: "pending" });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("equipmentOperationalStatus"))[0])).toMatchObject({ status: "maintenance", previousStatus: "available" });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vehicleRecords"))[0])).toMatchObject({ status: "maintenance", currentStatus: "维修中" });
  expect(dialogs.some(message => message.includes("驳回未保存"))).toBe(true);

  await page.locator("#maintenanceReviewList").getByRole("button", { name: "❌ 驳回申请" }).click();
  request = await page.evaluate(() => JSON.parse(localStorage.getItem("maintenanceRequests"))[0]);
  expect(request).toMatchObject({ status: "rejected", dispatchStatus: "rejected", dispatchRejectReason: "TEST设备无法安全运行，补充检查后再申请" });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("equipmentOperationalStatus"))[0])).toMatchObject({ status: "available", previousStatus: "", source: "dispatch_rejection" });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vehicleRecords"))[0])).toMatchObject({ status: "available", currentStatus: "可用" });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("maintenanceWorkOrders") || "[]"))).toHaveLength(0);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
