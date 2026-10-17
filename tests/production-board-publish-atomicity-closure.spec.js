"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST任务看板投影中途写入失败时不发布部分数据", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const shift = minutes >= 480 && minutes < 1200 ? "白班" : "夜班";
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (minutes < 480) day.setDate(day.getDate() - 1);
    const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    localStorage.setItem("personnelRecords", JSON.stringify([
      { personId: "TEST-ATOMIC-DISPATCH", employeeNo: "TEST-ATOMIC-DISPATCH", name: "TEST调度", position: "车队长", team: "管理组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用" },
      { personId: "TEST-ATOMIC-EX-D", employeeNo: "TEST-ATOMIC-EX-D", name: "TEST挖机司机", position: "挖机司机", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用" },
      { personId: "TEST-ATOMIC-TRUCK-D", employeeNo: "TEST-ATOMIC-TRUCK-D", name: "TEST汽车司机", position: "汽车司机", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用" },
      { personId: "TEST-ATOMIC-TRUCK-D2", employeeNo: "TEST-ATOMIC-TRUCK-D2", name: "TEST备用汽车司机", position: "汽车司机", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用" }
    ]));
    localStorage.setItem("currentPersonId", "TEST-ATOMIC-DISPATCH");
    localStorage.setItem("selectedPosition", "车队长");
    localStorage.setItem("rolePersonIds", JSON.stringify({ "车队长": "TEST-ATOMIC-DISPATCH" }));
    localStorage.setItem("equipmentRecords", JSON.stringify([
      { equipmentId: "TEST-ATOMIC-EX", equipmentNumber: "TEST-ATOMIC-EX", equipmentType: "挖掘机", status: "available" },
      { equipmentId: "TEST-ATOMIC-TRUCK", equipmentNumber: "TEST-ATOMIC-TRUCK", equipmentType: "矿卡", status: "available" },
      { equipmentId: "TEST-ATOMIC-TRUCK2", equipmentNumber: "TEST-ATOMIC-TRUCK2", equipmentType: "矿卡", status: "available" }
    ]));
    localStorage.setItem("transportZones", JSON.stringify([
      { zoneId: "TEST-ATOMIC-LOAD", zoneName: "TEST装载区", zoneType: "loading", enabled: true },
      { zoneId: "TEST-ATOMIC-DUMP", zoneName: "TEST排土场", zoneType: "unloading", enabled: true, materialType: "渣" }
    ]));
    localStorage.setItem("attendanceRecords", JSON.stringify([
      { attendanceId: "TEST-ATOMIC-EX-ATT", personId: "TEST-ATOMIC-EX-D", date, shift, status: "present" },
      { attendanceId: "TEST-ATOMIC-TRUCK-ATT", personId: "TEST-ATOMIC-TRUCK-D", date, shift, status: "present" },
      { attendanceId: "TEST-ATOMIC-TRUCK-ATT2", personId: "TEST-ATOMIC-TRUCK-D2", date, shift, status: "present" }
    ]));
    localStorage.removeItem("mineProductionBoardV2");
    localStorage.setItem("dispatchPublishedTasks", "[]");
    localStorage.setItem("dispatchShiftExecutions", "[]");
    localStorage.setItem("maintenanceRequests", "[]");
    localStorage.setItem("maintenanceWorkOrders", "[]");
    localStorage.setItem("leaveRequests", "[]");
    localStorage.setItem("driverLeaveRequests", "[]");
    localStorage.setItem("equipmentOperationalStatus", "[]");
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
      const body = await fs.readFile(file);
      const ext = path.extname(file).toLowerCase();
      const contentType = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing TEST asset" });
    }
  });

  await page.goto(`${ORIGIN}/dispatch.html`, { waitUntil: "domcontentloaded" });
  const board = page.locator("#production-board");
  await board.locator('[data-action="edit"]').click();
  const dialog = page.locator("dialog.pb-dialog");
  await dialog.locator('select[name="team"]').selectOption("A");
  await dialog.getByRole("button", { name: "确认" }).click();
  await board.locator('[data-action="add-group"]').click();
  const group = board.locator(".pb-group").first();
  const excavator = group.locator(".pb-pair").first();
  await excavator.locator('[data-action="choose-equipment"]').click();
  await dialog.locator('select[name="value"]').selectOption("TEST-ATOMIC-EX");
  await dialog.getByRole("button", { name: "确认" }).click();
  await excavator.locator('[data-action="choose-person"]').click();
  await dialog.locator('select[name="value"]').selectOption("TEST-ATOMIC-EX-D");
  await dialog.getByRole("button", { name: "确认" }).click();
  await group.locator('[data-action="add-truck"]').click();
  const truck = group.locator(".pb-pair").last();
  await truck.locator('[data-action="choose-equipment"]').click();
  await dialog.locator('select[name="value"]').selectOption("TEST-ATOMIC-TRUCK");
  await dialog.getByRole("button", { name: "确认" }).click();
  await truck.locator('[data-action="choose-person"]').click();
  await dialog.locator('select[name="value"]').selectOption("TEST-ATOMIC-TRUCK-D");
  await dialog.getByRole("button", { name: "确认" }).click();
  await group.locator('[data-action="group-settings"]').click();
  await dialog.locator('select[name="load"]').selectOption("TEST-ATOMIC-LOAD");
  await dialog.locator('input[name="unload"][value="TEST-ATOMIC-DUMP"]').check();
  await dialog.getByRole("button", { name: "确认" }).click();

  await board.locator('[data-action="publish"]').click();
  await expect(board).toContainText("绑定已发布");
  await board.locator('[data-action="edit"]').click();
  await dialog.locator('select[name="team"]').selectOption("A");
  await dialog.getByRole("button", { name: "确认" }).click();
  const editedTruck = board.locator(".pb-group").first().locator(".pb-pair").last();
  await editedTruck.locator('[data-action="choose-equipment"]').click();
  await dialog.locator('select[name="value"]').selectOption("TEST-ATOMIC-TRUCK2");
  await dialog.getByRole("button", { name: "确认" }).click();
  await editedTruck.locator('[data-action="choose-person"]').click();
  await dialog.locator('select[name="value"]').selectOption("TEST-ATOMIC-TRUCK-D2");
  await dialog.getByRole("button", { name: "确认" }).click();

  await page.evaluate(() => {
    localStorage.setItem("publishedDispatchTask", JSON.stringify({ taskId: "TEST-LEGACY-TASK", boardManaged: true, testFixture: true }));
    localStorage.setItem("driverCurrentTask", JSON.stringify({ taskId: "BOARD-TEST-LEGACY-TASK", boardManaged: true, testFixture: true }));
  });
  const transactionKeys = ["mineProductionBoardV2", "dispatchPublishedTasks", "dispatchShiftExecutions", "publishedDispatchTask", "driverCurrentTask"];
  const before = await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), transactionKeys);
  await page.evaluate(() => {
    const nativeSetItem = Storage.prototype.setItem;
    let failed = false;
    Storage.prototype.setItem = function(key, value) {
      if (key === "dispatchShiftExecutions" && !failed) {
        failed = true;
        throw new DOMException("TEST projection write failure", "QuotaExceededError");
      }
      return nativeSetItem.call(this, key, value);
    };
  });
  await board.locator('[data-action="publish"]').click();
  await expect(board.locator(".pb-error")).toContainText("看板保存失败，已恢复原数据");

  const after = await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), transactionKeys);
  expect(after).toEqual(before);
  await board.locator('[data-action="publish"]').click();
  await expect(board).toContainText("绑定已发布");
  await expect.poll(() => page.evaluate(() => ["publishedDispatchTask", "driverCurrentTask"].every(key => localStorage.getItem(key) === null))).toBe(true);
  const retried = await page.evaluate(() => ({
    board: JSON.parse(localStorage.getItem("mineProductionBoardV2") || "{}"),
    tasks: JSON.parse(localStorage.getItem("dispatchPublishedTasks") || "[]"),
    executions: JSON.parse(localStorage.getItem("dispatchShiftExecutions") || "[]")
  }));
  const savedBoard = Object.values(retried.board.boards || {}).find(item => item.published);
  expect(savedBoard.version).toBe(2);
  expect(savedBoard.groups[0].trucks).toEqual([{ equipmentId: "TEST-ATOMIC-TRUCK2", driverId: "TEST-ATOMIC-TRUCK-D2" }]);
  expect(retried.tasks.find(item => item.boardManaged).driverAssignments).toContainEqual(expect.objectContaining({ vehicleNumber: "TEST-ATOMIC-TRUCK2", driverId: "TEST-ATOMIC-TRUCK-D2" }));
  expect(retried.executions).toContainEqual(expect.objectContaining({ boardManaged: true }));
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

