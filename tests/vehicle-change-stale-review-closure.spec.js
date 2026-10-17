"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST换车审核会复核申请状态和当前可调配车辆", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    const newTruck = "TEST-CHANGE-NEW-TRUCK";
    localStorage.setItem("personnelRecords", JSON.stringify([
      { personId: "TEST-CHANGE-DISPATCH", employeeId: "TEST-CHANGE-DISPATCH", employeeNo: "TEST-CHANGE-DISPATCH", name: "TEST调度", position: "车队长", team: "管理组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true }
    ]));
    localStorage.setItem("currentPersonId", "TEST-CHANGE-DISPATCH");
    localStorage.setItem("selectedPosition", "车队长");
    localStorage.setItem("equipmentRecords", JSON.stringify([
      { equipmentId: newTruck, equipmentNumber: newTruck, equipmentType: "汽车", currentStatus: "可用", status: "available", equipmentStatus: "available", testFixture: true }
    ]));
    localStorage.setItem("dispatchPublishedTasks", JSON.stringify([
      { taskId: "TEST-CHANGE-TASK-01", status: "active", bindings: [{ excavatorId: "TEST-CHANGE-EXC-01", truckIds: ["TEST-CHANGE-OLD-TRUCK"] }], driverAssignments: [], testFixture: true },
      { taskId: "TEST-CHANGE-TASK-02", status: "active", bindings: [], driverAssignments: [], testFixture: true }
    ]));
    localStorage.setItem("driverVehicleChangeRequests", JSON.stringify([
      { requestId: "TEST-CHANGE-REQUEST-01", taskId: "TEST-CHANGE-TASK-01", driverId: "TEST-CHANGE-DRIVER-01", driverName: "TEST司机", oldVehicleId: "TEST-CHANGE-OLD-TRUCK", oldVehicleNumber: "TEST-CHANGE-OLD-TRUCK", status: "pending", reason: "TEST车辆故障", testFixture: true }
    ]));
    window.__testAlerts = [];
    window.alert = message => window.__testAlerts.push(String(message));
  });
  await page.route("**/*", async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (!["GET", "HEAD"].includes(req.method()) || url.origin !== ORIGIN) {
      blocked.push(req.method() + " " + req.url());
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

  await page.goto(ORIGIN + "/dispatch.html", { waitUntil: "domcontentloaded" });
  await page.locator("#openVehicleChangeButton").click();
  const modal = page.locator("#vehicleChangeModal");
  await expect(modal).toBeVisible();
  const vehicleSelect = modal.locator('[data-change-vehicle="TEST-CHANGE-REQUEST-01"]');
  await expect(vehicleSelect.locator('option[value="TEST-CHANGE-NEW-TRUCK"]')).toHaveCount(1);
  await vehicleSelect.selectOption("TEST-CHANGE-NEW-TRUCK");

  await page.evaluate(() => {
    const tasks = JSON.parse(localStorage.getItem("dispatchPublishedTasks"));
    tasks.find(task => task.taskId === "TEST-CHANGE-TASK-02").bindings = [
      { excavatorId: "TEST-CHANGE-EXC-02", truckIds: ["TEST-CHANGE-NEW-TRUCK"] }
    ];
    localStorage.setItem("dispatchPublishedTasks", JSON.stringify(tasks));
  });
  await modal.locator('[data-change-approve="TEST-CHANGE-REQUEST-01"]').click();
  let request = await page.evaluate(() => JSON.parse(localStorage.getItem("driverVehicleChangeRequests"))[0]);
  let tasks = await page.evaluate(() => JSON.parse(localStorage.getItem("dispatchPublishedTasks")));
  expect(request.status).toBe("pending");
  expect(tasks.find(task => task.taskId === "TEST-CHANGE-TASK-01").bindings[0].truckIds).toEqual(["TEST-CHANGE-OLD-TRUCK"]);
  expect(tasks.find(task => task.taskId === "TEST-CHANGE-TASK-02").bindings[0].truckIds).toEqual(["TEST-CHANGE-NEW-TRUCK"]);

  await page.evaluate(() => {
    window.prompt = () => {
      const rows = JSON.parse(localStorage.getItem("driverVehicleChangeRequests"));
      rows[0].status = "approved";
      rows[0].approvedBy = "TEST另一调度窗口";
      localStorage.setItem("driverVehicleChangeRequests", JSON.stringify(rows));
      return "TEST旧窗口驳回";
    };
  });
  await modal.locator('[data-change-reject="TEST-CHANGE-REQUEST-01"]').click();
  request = await page.evaluate(() => JSON.parse(localStorage.getItem("driverVehicleChangeRequests"))[0]);
  expect(request).toMatchObject({ status: "approved", approvedBy: "TEST另一调度窗口" });
  expect(request.rejectReason).toBeUndefined();
  await page.locator("#closeVehicleChangeModal").click();

  await page.evaluate(() => {
    const requests = JSON.parse(localStorage.getItem("driverVehicleChangeRequests"));
    requests[0].status = "pending";
    delete requests[0].approvedBy;
    localStorage.setItem("driverVehicleChangeRequests", JSON.stringify(requests));
    const tasks = JSON.parse(localStorage.getItem("dispatchPublishedTasks"));
    tasks.find(task => task.taskId === "TEST-CHANGE-TASK-02").bindings = [];
    localStorage.setItem("dispatchPublishedTasks", JSON.stringify(tasks));
  });
  await page.locator("#openVehicleChangeButton").click();
  const reopened = page.locator("#vehicleChangeModal");
  const reopenedSelect = reopened.locator('[data-change-vehicle="TEST-CHANGE-REQUEST-01"]');
  await reopenedSelect.selectOption("TEST-CHANGE-NEW-TRUCK");
  await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem("driverVehicleChangeRequests"));
    rows[0].status = "approved";
    rows[0].approvedBy = "TEST另一调度窗口";
    localStorage.setItem("driverVehicleChangeRequests", JSON.stringify(rows));
  });
  await reopened.locator('[data-change-approve="TEST-CHANGE-REQUEST-01"]').click();
  request = await page.evaluate(() => JSON.parse(localStorage.getItem("driverVehicleChangeRequests"))[0]);
  tasks = await page.evaluate(() => JSON.parse(localStorage.getItem("dispatchPublishedTasks")));
  expect(request).toMatchObject({ status: "approved", approvedBy: "TEST另一调度窗口" });
  expect(request.approvedVehicleNumber).toBeUndefined();
  expect(tasks.find(task => task.taskId === "TEST-CHANGE-TASK-01").bindings[0].truckIds).toEqual(["TEST-CHANGE-OLD-TRUCK"]);

  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
