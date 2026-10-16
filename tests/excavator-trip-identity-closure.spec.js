"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

async function openExcavator(page, trips) {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(({ trips }) => {
    const personId = "TEST-EXCAVATOR-PERSON-001";
    const taskId = "TEST-EXCAVATOR-TASK-001";
    const now = new Date().toISOString();
    const personName = "TEST挖机司机";
    localStorage.setItem("personnelRecords", JSON.stringify([{
      personId, employeeId: personId, employeeNo: personId, name: personName,
      position: "挖机司机", status: "approved", approvalStatus: "approved",
      personnelStatus: "在职可用", testFixture: true
    }]));
    localStorage.setItem("currentPersonId", personId);
    localStorage.setItem("selectedPosition", "挖机司机");
    localStorage.setItem("dispatchPublishedTasks", JSON.stringify([{
      taskId, id: taskId, status: "active", date: now.slice(0, 10),
      shiftDate: now.slice(0, 10), shift: "白班", publishedAt: now,
      title: "TEST挖机班次任务", team: "生产A组", area: "TEST装载区",
      loadingPoint: "TEST装载区", unloadingPoint: "TEST卸载区",
      bindings: [{
        excavatorId: "TEST-EXCAVATOR-001", excavatorNumber: "TEST-EXCAVATOR-001",
        excavatorDriverId: personId, excavatorDriverName: personName,
        truckIds: ["TEST-TRUCK-001"], truckNumbers: ["TEST-TRUCK-001"]
      }],
      excavatorDriverAssignments: [{
        driverId: personId, driverName: personName,
        excavatorId: "TEST-EXCAVATOR-001", excavatorNumber: "TEST-EXCAVATOR-001"
      }],
      truckBindingHistory: []
    }]));
    localStorage.setItem("driverTripRecords", JSON.stringify(trips.map(row => ({
      status: "completed", vehicleNumber: "TEST-TRUCK-001",
      excavatorId: "TEST-EXCAVATOR-001", excavatorDriverId: personId,
      completedAt: now, createdAt: now, ...row
    }))));
  }, { trips });
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!["GET", "HEAD"].includes(request.method()) || url.origin !== ORIGIN) {
      blocked.push(request.method() + " " + request.url());
      return route.abort();
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const body = await fs.readFile(file);
      const ext = path.extname(file).toLowerCase();
      const contentType = ext === ".html" ? "text/html; charset=utf-8"
        : ext === ".js" ? "text/javascript; charset=utf-8"
        : ext === ".css" ? "text/css; charset=utf-8"
        : ext === ".png" ? "image/png" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });
  await page.goto(`${ORIGIN}/excavator.html`, { waitUntil: "domcontentloaded" });
  return { errors, blocked };
}

test("TEST挖机本班趟数与月度明细按稳定趟次编号去重", async ({ page }) => {
  const taskId = "TEST-EXCAVATOR-TASK-001";
  const result = await openExcavator(page, [
    { tripId: "TEST-EXCAVATOR-TRIP-001", taskId },
    { client_record_id: "TEST-EXCAVATOR-TRIP-001", dispatchTaskId: taskId }
  ]);
  await expect(page.locator("#excavatorShiftTripCount")).toHaveText("1");
  await expect(page.locator("#totalTripCount")).toHaveText("1");
  expect(result.errors).toEqual([]);
  expect(result.blocked).toEqual([]);
});

test("TEST挖机端兼容数据库 snake_case 任务关联字段", async ({ page }) => {
  const result = await openExcavator(page, [
    { trip_id: "TEST-EXCAVATOR-TRIP-002", task_id: "TEST-EXCAVATOR-TASK-001" }
  ]);
  await expect(page.locator("#excavatorShiftTripCount")).toHaveText("1");
  await expect(page.locator("#totalTripCount")).toHaveText("1");
  expect(result.errors).toEqual([]);
  expect(result.blocked).toEqual([]);
});
