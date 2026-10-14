"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const { installAGroupRobotContext } = require("./a-group-multi-robot-fixture");
const { TruckDriverBot } = require("./bots/truck-driver-bot");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST 临时卸料经调度批准后只生成一趟正式运输记录", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
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
      const contentType = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" }[ext] || "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });
  await page.goto(`${ORIGIN}/index.html`, { waitUntil: "domcontentloaded" });
  await installAGroupRobotContext(page, "TEST-A-D-001");
  const bot = new TruckDriverBot(page);
  await bot.installTestGpsBeforeOpen();
  await bot.open();
  const { profile, task } = await bot.assertSafeContext();
  const driverId = profile.driverId || profile.personId;
  const taskId = task.taskId || task.dispatchTaskId;
  const vehicleId = task.vehicleNumber || task.vehicleId;
  await page.reload({ waitUntil: "domcontentloaded" });
  const shiftId = task.shiftId || "TEST-A-SHIFT-001";
  await page.evaluate(({ taskId, shiftId, driverId, vehicleId }) => {
    const currentTask = JSON.parse(localStorage.getItem("driverCurrentTask") || "null");
    if (currentTask) { currentTask.status = "working"; localStorage.setItem("driverCurrentTask", JSON.stringify(currentTask)); }
    localStorage.setItem("driverTransportCycleState", JSON.stringify({
      cycleKey: `${taskId}|${shiftId}|${vehicleId}|${driverId}`,
      phase: "enroute_unload", taskId, shiftId, vehicleNumber: vehicleId,
      loadedAt: new Date().toISOString(), departedLoadingAt: new Date().toISOString(),
      unloadingZoneId: "", materialType: "", updatedAt: new Date().toISOString(), robotFixture: true
    }));
    window.dispatchEvent(new StorageEvent("storage", { key: "driverTransportCycleState" }));
  }, { taskId, shiftId, driverId, vehicleId });
  await bot.assertTemporaryUnloadReady();
  await bot.submitTestTemporaryUnload();
  let requests = await bot.readLocalStorage("temporaryUnloadRequests");
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ taskId, driverId, vehicleNumber: vehicleId, status: "pending_dispatch", materialType: "渣", reason: "修路垫料" });
  expect(requests[0].requestId).toMatch(/^TEST-/);

  await page.addInitScript(() => {
    localStorage.setItem("currentPersonId", "TEST-A-DISPATCH-001");
    localStorage.setItem("selectedPosition", "车队长");
  });
  await page.goto(`${ORIGIN}/dispatch.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const original = window.temporaryUnloadTripId;
    window.temporaryUnloadTripId = request => {
      const id = original(request);
      return String(id).startsWith("TEST-") ? id : `TEST-${id}`;
    };
  });
  await page.locator("#openTemporaryUnloadReviewButton").click();
  await expect(page.locator("#temporaryUnloadReviewList")).toContainText("TEST-A组汽车司机01");
  page.once("dialog", async dialog => await dialog.accept());
  await page.locator("#temporaryUnloadReviewList").getByRole("button", { name: "✅ 确认有效并计入" }).click();

  requests = await page.evaluate(() => JSON.parse(localStorage.getItem("temporaryUnloadRequests") || "[]"));
  expect(requests[0]).toMatchObject({ requestId: requests[0].requestId, status: "approved", dispatchConfirmation: "confirmed", officialCountEligible: true });
  const trips = await page.evaluate(() => JSON.parse(localStorage.getItem("tripRecords") || "[]"));
  expect(trips).toHaveLength(1);
  expect(trips[0]).toMatchObject({ taskId, vehicleNumber: vehicleId, materialType: "渣" });
  expect(String(trips[0].tripId || trips[0].id)).toMatch(/^TEST-/);
  await page.goto(`${ORIGIN}/dispatch.html`, { waitUntil: "domcontentloaded" });
  await page.locator('#production-board [data-action="toggle"]').click();
  const board = page.locator("#production-board");
  await expect(board).toContainText(/当日总趟数\s*1/);
  await expect(board).toContainText(/A组渣总趟数\s*1/);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

test("TEST 临时卸料被驳回时不增加正式趟数", async ({ page }) => {
  const blocked = [];
  await page.addInitScript(() => {
    localStorage.setItem("personnelRecords", JSON.stringify([{
      personId: "TEST-A-DISPATCH-001", employeeNo: "TEST-A-DISPATCH-001", name: "TEST调度员",
      position: "车队长", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用"
    }]));
    localStorage.setItem("currentPersonId", "TEST-A-DISPATCH-001");
    localStorage.setItem("selectedPosition", "车队长");
    localStorage.setItem("temporaryUnloadRequests", JSON.stringify([{
      requestId: "TEST-REJECT-UNLOAD-001", taskId: "TEST-A-TASK-001", driverId: "TEST-A-D-001",
      driverName: "TEST-A组汽车司机01", vehicleNumber: "TEST-A-T-001", materialType: "渣",
      reason: "修路垫料", remark: "TEST驳回分支", status: "pending_dispatch", createdAt: new Date().toISOString(), testFixture: true
    }]));
    localStorage.setItem("tripRecords", JSON.stringify([]));
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
      const contentType = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" }[ext] || "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });
  await page.goto(`${ORIGIN}/dispatch.html`, { waitUntil: "domcontentloaded" });
  await page.locator("#openTemporaryUnloadReviewButton").click();
  await expect(page.locator("#temporaryUnloadReviewList")).toContainText("TEST驳回分支");
  page.once("dialog", async dialog => await dialog.accept());
  await page.locator("#temporaryUnloadReviewList").getByRole("button", { name: "❌ 驳回" }).click();
  const result = await page.evaluate(() => ({
    requests: JSON.parse(localStorage.getItem("temporaryUnloadRequests") || "[]"),
    trips: JSON.parse(localStorage.getItem("tripRecords") || "[]")
  }));
  expect(result.requests[0]).toMatchObject({ requestId: "TEST-REJECT-UNLOAD-001", status: "rejected", officialCountEligible: false });
  expect(result.trips).toHaveLength(0);
  expect(blocked).toEqual([]);
});

