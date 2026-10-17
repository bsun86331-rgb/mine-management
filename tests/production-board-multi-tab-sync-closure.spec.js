"use strict";

const { test, expect } = require("@playwright/test");
const { evidencePath } = require("./evidence-path.cjs");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

async function routeSnapshot(page, blocked) {
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
      const ext = path.extname(file).toLowerCase();
      const contentType = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body: await fs.readFile(file) });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });
}

test("TEST调度首次发布、旧草稿冲突保护和再次换绑跨标签同步", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    if (localStorage.getItem("TEST-MULTITAB-SETUP") === "done") return;
    localStorage.clear();
    sessionStorage.clear();
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const shift = minutes >= 480 && minutes < 1200 ? "白班" : "夜班";
    const boardDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (minutes < 480) boardDate.setDate(boardDate.getDate() - 1);
    const date = `${boardDate.getFullYear()}-${String(boardDate.getMonth() + 1).padStart(2, "0")}-${String(boardDate.getDate()).padStart(2, "0")}`;
    const people = [
      { personId: "TEST-MULTITAB-DISPATCH", employeeNo: "TEST-MULTITAB-DISPATCH", name: "TEST调度", position: "车队长", team: "管理组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true },
      { personId: "TEST-MULTITAB-EX-D", employeeNo: "TEST-MULTITAB-EX-D", name: "TEST挖机司机", position: "挖机司机", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true },
      { personId: "TEST-MULTITAB-TR-D", employeeNo: "TEST-MULTITAB-TR-D", name: "TEST汽车司机", position: "汽车司机", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true },
      { personId: "TEST-MULTITAB-TR-D2", employeeNo: "TEST-MULTITAB-TR-D2", name: "TEST汽车司机二", position: "汽车司机", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true }
    ];
    localStorage.setItem("personnelRecords", JSON.stringify(people));
    localStorage.setItem("currentPersonId", "TEST-MULTITAB-DISPATCH");
    localStorage.setItem("selectedPosition", "车队长");
    localStorage.setItem("rolePersonIds", JSON.stringify({ "车队长": "TEST-MULTITAB-DISPATCH" }));
    localStorage.setItem("equipmentRecords", JSON.stringify([
      { equipmentId: "TEST-MULTITAB-EX", equipmentNumber: "TEST-MULTITAB-EX", equipmentType: "挖掘机", status: "available", testFixture: true },
      { equipmentId: "TEST-MULTITAB-TRUCK", equipmentNumber: "TEST-MULTITAB-TRUCK", equipmentType: "矿卡", status: "available", testFixture: true }
    ]));
    localStorage.setItem("transportZones", JSON.stringify([
      { zoneId: "TEST-MULTITAB-LOAD", zoneName: "TEST装载区", zoneType: "loading", enabled: true, testFixture: true },
      { zoneId: "TEST-MULTITAB-DUMP", zoneName: "TEST排土场", zoneType: "unloading", materialType: "渣", enabled: true, testFixture: true }
    ]));
    localStorage.setItem("attendanceRecords", JSON.stringify([
      { attendanceId: "TEST-MULTITAB-EX-ATT", personId: "TEST-MULTITAB-EX-D", date, shift, status: "present", checkInAt: `${date}T08:00:00`, testFixture: true },
      { attendanceId: "TEST-MULTITAB-TR-ATT", personId: "TEST-MULTITAB-TR-D", date, shift, status: "present", checkInAt: `${date}T08:00:00`, testFixture: true },
      { attendanceId: "TEST-MULTITAB-TR-ATT2", personId: "TEST-MULTITAB-TR-D2", date, shift, status: "present", checkInAt: `${date}T08:00:00`, testFixture: true }
    ]));
    for (const key of ["mineProductionBoardV2", "dispatchPublishedTasks", "dispatchShiftExecutions", "maintenanceRequests", "maintenanceWorkOrders", "leaveRequests", "driverLeaveRequests", "equipmentOperationalStatus"]) localStorage.removeItem(key);
    localStorage.setItem("TEST-MULTITAB-SETUP", "done");
  });
  await routeSnapshot(page, blocked);

  await page.goto(`${ORIGIN}/dispatch.html`, { waitUntil: "domcontentloaded" });
  const board = page.locator("#production-board");
  await expect(board.locator("[data-action=edit]")).toContainText("下发任务");

  // Keep a second dispatch tab on revision 0 with an unpublished draft.
  const staleDispatchPage = await page.context().newPage();
  staleDispatchPage.on("pageerror", error => errors.push(error.message));
  await routeSnapshot(staleDispatchPage, blocked);
  await staleDispatchPage.goto(`${ORIGIN}/dispatch.html`, { waitUntil: "domcontentloaded" });
  const staleBoard = staleDispatchPage.locator("#production-board");
  await staleBoard.locator('[data-action="edit"]').click();
  const staleDialog = staleDispatchPage.locator("dialog.pb-dialog");
  await staleDialog.locator('select[name="team"]').selectOption("A");
  await staleDialog.getByRole("button", { name: "确认" }).click();
  await expect(staleBoard.locator('[data-action="publish"]')).toBeVisible();

  // Open the driver role before either dispatch tab publishes.
  await page.evaluate(() => {
    localStorage.setItem("currentPersonId", "TEST-MULTITAB-TR-D");
    localStorage.setItem("selectedPosition", "汽车司机");
  });
  const driverPage = await page.context().newPage();
  driverPage.on("pageerror", error => errors.push(error.message));
  await routeSnapshot(driverPage, blocked);
  await driverPage.goto(`${ORIGIN}/driver-work.html`, { waitUntil: "domcontentloaded" });
  await expect(driverPage.locator("#driverName")).toHaveText("TEST汽车司机");
  const driverBoard = driverPage.locator("#production-board");
  await driverBoard.locator('[data-action="toggle"]').click();
  await expect(driverBoard).toContainText("该班次尚未设置生产组");

  // The shared localStorage identity mapping must keep the dispatch tab editable.
  await expect(board.locator("[data-action=edit]")).toContainText("下发任务");
  await board.locator("[data-action=edit]").click();
  const dialog = page.locator("dialog.pb-dialog");
  await dialog.locator('select[name="team"]').selectOption("A");
  await dialog.getByRole("button", { name: "确认" }).click();
  const group = board.locator(".pb-group").first();
  await board.locator('[data-action="add-group"]').click();
  await group.locator(".pb-pair").first().locator('[data-action="choose-equipment"]').click();
  await dialog.locator('select[name="value"]').selectOption("TEST-MULTITAB-EX");
  await dialog.getByRole("button", { name: "确认" }).click();
  await group.locator(".pb-pair").first().locator('[data-action="choose-person"]').click();
  await dialog.locator('select[name="value"]').selectOption("TEST-MULTITAB-EX-D");
  await dialog.getByRole("button", { name: "确认" }).click();
  await group.locator('[data-action="add-truck"]').click();
  const truck = group.locator(".pb-pair").last();
  await truck.locator('[data-action="choose-equipment"]').click();
  await dialog.locator('select[name="value"]').selectOption("TEST-MULTITAB-TRUCK");
  await dialog.getByRole("button", { name: "确认" }).click();
  await truck.locator('[data-action="choose-person"]').click();
  await dialog.locator('select[name="value"]').selectOption("TEST-MULTITAB-TR-D");
  await dialog.getByRole("button", { name: "确认" }).click();
  await group.locator('[data-action="group-settings"]').click();
  await dialog.locator('select[name="load"]').selectOption("TEST-MULTITAB-LOAD");
  await dialog.locator('input[name="unload"][value="TEST-MULTITAB-DUMP"]').check();
  await dialog.getByRole("button", { name: "确认" }).click();
  await board.locator('[data-action="publish"]').click();

  await expect(board).toContainText("绑定已发布");
  // Publishing the old draft must be rejected instead of overwriting revision 1.
  await staleBoard.locator('[data-action="publish"]').click();
  await expect(staleBoard).toContainText("看板已经被其他页面修改，请取消编辑后重新进入。");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("mineProductionBoardV2") || "{}").revision)).toBe(1);
  await expect(driverBoard.locator(".pb-group").first()).toContainText("TEST-MULTITAB-TRUCK", { timeout: 5000 });
  await expect(driverBoard.locator(".pb-group").first()).toContainText("TEST汽车司机");
  await expect(driverBoard.locator(".pb-tag")).toContainText("只读");
  expect(await driverBoard.locator('[data-action="edit"], [data-action="publish"]').count()).toBe(0);
  const result = await page.evaluate(() => ({
    revision: JSON.parse(localStorage.getItem("mineProductionBoardV2") || "{}").revision,
    activeTasks: JSON.parse(localStorage.getItem("dispatchPublishedTasks") || "[]").filter(task => task.status === "active").length
  }));
  expect(result.revision).toBe(1);
  expect(result.activeTasks).toBe(1);

  // Rebind the truck while its driver page stays open; the new board revision must replace the old assignment live.
  await board.locator('[data-action="toggle"]').click();
  await board.locator('[data-action="edit"]').click();
  await dialog.locator('select[name="team"]').selectOption("A");
  await dialog.getByRole("button", { name: "确认" }).click();
  const editedGroup = board.locator(".pb-group").first();
  const editedTruck = editedGroup.locator(".pb-pair").last();
  await editedTruck.locator('[data-action="choose-person"]').click();
  await dialog.locator('select[name="value"]').selectOption("TEST-MULTITAB-TR-D2");
  await dialog.getByRole("button", { name: "确认" }).click();
  const publishObstruction = await page.evaluate(() => {
    const button = document.querySelector('#production-board [data-action="publish"]');
    const launcher = document.querySelector("#mineChatLauncher");
    const a = button?.getBoundingClientRect();
    const b = launcher?.getBoundingClientRect();
    return { overlap: !!a && !!b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top, button: a && { left: a.left, right: a.right, top: a.top, bottom: a.bottom }, launcher: b && { left: b.left, right: b.right, top: b.top, bottom: b.bottom } };
  });
  await page.screenshot({ path: evidencePath("证据_看板编辑时工作聊天入口避开发布按钮", "production-board-chat-clear-of-editor") });
  console.log("TEST publish/chat overlap after fix:", JSON.stringify(publishObstruction));
  expect(publishObstruction.overlap).toBe(false);
  await board.locator('[data-action="publish"]').click();

  await expect(board).toContainText("绑定已发布");
  await expect(driverBoard.locator(".pb-group").first()).toContainText("TEST汽车司机二", { timeout: 5000 });
  await expect(driverBoard.locator(".pb-group").first().getByText("TEST汽车司机", { exact: true })).toHaveCount(0);
  const revised = await page.evaluate(() => ({
    revision: JSON.parse(localStorage.getItem("mineProductionBoardV2") || "{}").revision,
    driverId: JSON.parse(localStorage.getItem("mineProductionBoardV2") || "{}").boards[Object.keys(JSON.parse(localStorage.getItem("mineProductionBoardV2") || "{}").boards)[0]].groups[0].trucks[0].driverId
  }));
  expect(revised).toEqual({ revision: 2, driverId: "TEST-MULTITAB-TR-D2" });
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
  await staleDispatchPage.close();
  await driverPage.close();
});


