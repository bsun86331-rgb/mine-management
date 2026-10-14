"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST调度首次下发生产A组任务后司机端只读看板同步显示", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    if (localStorage.getItem("TEST-FIRST-SETUP") === "done") return;
    localStorage.clear();
    sessionStorage.clear();
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const shift = minutes >= 480 && minutes < 1200 ? "白班" : "夜班";
    const boardDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (minutes < 480) boardDate.setDate(boardDate.getDate() - 1);
    const date = `${boardDate.getFullYear()}-${String(boardDate.getMonth() + 1).padStart(2, "0")}-${String(boardDate.getDate()).padStart(2, "0")}`;
    const personnel = [
      { personId: "TEST-FIRST-DISPATCH", employeeNo: "TEST-FIRST-DISPATCH", name: "TEST调度", position: "车队长", team: "管理组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true },
      { personId: "TEST-FIRST-EX-D", employeeNo: "TEST-FIRST-EX-D", name: "TEST挖机司机", position: "挖机司机", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true },
      { personId: "TEST-FIRST-TRUCK-D", employeeNo: "TEST-FIRST-TRUCK-D", name: "TEST汽车司机", position: "汽车司机", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true },
    ];
    localStorage.setItem("personnelRecords", JSON.stringify(personnel));
    localStorage.setItem("currentPersonId", "TEST-FIRST-DISPATCH");
    localStorage.setItem("selectedPosition", "车队长");
    localStorage.setItem("rolePersonIds", JSON.stringify({ "车队长": "TEST-FIRST-DISPATCH" }));
    localStorage.setItem("equipmentRecords", JSON.stringify([
      { equipmentId: "TEST-FIRST-EX", equipmentNumber: "TEST-FIRST-EX", equipmentType: "挖掘机", status: "available", testFixture: true },
      { equipmentId: "TEST-FIRST-TRUCK", equipmentNumber: "TEST-FIRST-TRUCK", equipmentType: "矿卡", status: "available", testFixture: true },
    ]));
    localStorage.setItem("transportZones", JSON.stringify([
      { zoneId: "TEST-FIRST-LOAD", zoneName: "TEST装载区", zoneType: "loading", enabled: true, testFixture: true },
      { zoneId: "TEST-FIRST-DUMP", zoneName: "TEST排土场", zoneType: "unloading", materialType: "渣", enabled: true, testFixture: true },
    ]));
    localStorage.setItem("attendanceRecords", JSON.stringify([
      { attendanceId: "TEST-FIRST-EX-ATT", personId: "TEST-FIRST-EX-D", date, shift, status: "present", checkInAt: `${date}T08:00:00`, testFixture: true },
      { attendanceId: "TEST-FIRST-TRUCK-ATT", personId: "TEST-FIRST-TRUCK-D", date, shift, status: "present", checkInAt: `${date}T08:00:00`, testFixture: true },
    ]));
    for (const key of ["mineProductionBoardV2", "dispatchPublishedTasks", "dispatchShiftExecutions", "maintenanceRequests", "maintenanceWorkOrders", "leaveRequests", "driverLeaveRequests", "equipmentOperationalStatus"]) localStorage.removeItem(key);
    localStorage.setItem("TEST-FIRST-SETUP", "done");
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
      const ext = path.extname(file).toLowerCase();
      const type = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType: type, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  await page.goto(`${ORIGIN}/dispatch.html`, { waitUntil: "domcontentloaded" });
  const board = page.locator("#production-board");
  await expect(board.locator("[data-action=edit]")).toContainText("下发任务");
  await board.locator("[data-action=edit]").click();
  const dialog = page.locator("dialog.pb-dialog");
  await expect(dialog.locator("h3")).toHaveText("选择本班生产班组");
  await dialog.locator('select[name="team"]').selectOption("A");
  await dialog.getByRole("button", { name: "确认" }).click();
  await board.locator('[data-action="add-group"]').click();
  const group = board.locator(".pb-group").first();
  await group.locator(".pb-pair").first().locator('[data-action="choose-equipment"]').click();
  await dialog.locator('select[name="value"]').selectOption("TEST-FIRST-EX");
  await dialog.getByRole("button", { name: "确认" }).click();
  await group.locator(".pb-pair").first().locator('[data-action="choose-person"]').click();
  await dialog.locator('select[name="value"]').selectOption("TEST-FIRST-EX-D");
  await dialog.getByRole("button", { name: "确认" }).click();
  await group.locator('[data-action="add-truck"]').click();
  const truck = group.locator(".pb-pair").last();
  await truck.locator('[data-action="choose-equipment"]').click();
  await dialog.locator('select[name="value"]').selectOption("TEST-FIRST-TRUCK");
  await dialog.getByRole("button", { name: "确认" }).click();
  await truck.locator('[data-action="choose-person"]').click();
  await dialog.locator('select[name="value"]').selectOption("TEST-FIRST-TRUCK-D");
  await dialog.getByRole("button", { name: "确认" }).click();
  await group.locator('[data-action="group-settings"]').click();
  await dialog.locator('select[name="load"]').selectOption("TEST-FIRST-LOAD");
  await dialog.locator('input[name="unload"][value="TEST-FIRST-DUMP"]').check();
  await dialog.getByRole("button", { name: "确认" }).click();
  await board.locator('[data-action="publish"]').click();

  await expect(board).toContainText("绑定已发布");
  let saved = await page.evaluate(() => ({
    board: JSON.parse(localStorage.getItem("mineProductionBoardV2") || "{}"),
    tasks: JSON.parse(localStorage.getItem("dispatchPublishedTasks") || "[]"),
    executions: JSON.parse(localStorage.getItem("dispatchShiftExecutions") || "[]"),
  }));
  const published = Object.values(saved.board.boards || {}).find(row => row.published);
  expect(published).toMatchObject({ published: true, version: 1 });
  expect(published.groups[0]).toMatchObject({ team: "A", excavatorId: "TEST-FIRST-EX", excavatorDriverId: "TEST-FIRST-EX-D", loadingZoneId: "TEST-FIRST-LOAD", unloadingZoneIds: ["TEST-FIRST-DUMP"] });
  expect(published.groups[0].trucks).toEqual([{ equipmentId: "TEST-FIRST-TRUCK", driverId: "TEST-FIRST-TRUCK-D" }]);
  const projectedTask = saved.tasks.find(row => row.boardManaged);
  expect(projectedTask).toBeTruthy();
  expect(projectedTask.bindings[0].truckIds).toContain("TEST-FIRST-TRUCK");
  expect(projectedTask.driverAssignments).toContainEqual(expect.objectContaining({ vehicleNumber: "TEST-FIRST-TRUCK", driverId: "TEST-FIRST-TRUCK-D" }));
  expect(saved.executions).toContainEqual(expect.objectContaining({ boardManaged: true, taskId: projectedTask.taskId }));

  await page.evaluate(() => {
    localStorage.setItem("currentPersonId", "TEST-FIRST-TRUCK-D");
    localStorage.setItem("selectedPosition", "汽车司机");
  });
  await page.goto(`${ORIGIN}/driver-work.html`, { waitUntil: "domcontentloaded" });
  const driverBoard = page.locator("#production-board");
  await driverBoard.locator('[data-action="toggle"]').click();
  await expect(driverBoard.locator(".pb-tag")).toContainText("只读");
  await expect(driverBoard.locator(".pb-group").first()).toContainText("TEST-FIRST-TRUCK");
  await expect(driverBoard.locator(".pb-group").first()).toContainText("TEST汽车司机");
  expect(await driverBoard.locator('[data-action="edit"], [data-action="publish"]').count()).toBe(0);
  saved = await page.evaluate(() => ({
    board: JSON.parse(localStorage.getItem("mineProductionBoardV2") || "{}"),
    tasks: JSON.parse(localStorage.getItem("dispatchPublishedTasks") || "[]"),
  }));
  expect(Object.values(saved.board.boards || {}).find(row => row.published).version).toBe(1);
  expect(saved.tasks.filter(row => row.boardManaged)).toHaveLength(1);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

