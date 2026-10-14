"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const { installAGroupRobotContext } = require("./a-group-multi-robot-fixture");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST运输统计按生产日边界分组去重并拆分A/B煤渣趟次", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
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
      const ext = path.extname(file).toLowerCase();
      const contentType = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body: await fs.readFile(file) });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  const { payload } = await installAGroupRobotContext(page, "TEST-A-D-001");
  await page.goto(`${ORIGIN}/index.html`, { waitUntil: "domcontentloaded" });
  const board = Object.values(payload.productionBoardState.boards)[0];
  const nextDate = new Date(`${board.date}T12:00:00`);
  nextDate.setDate(nextDate.getDate() + 1);
  const dateAfter = nextDate.toISOString().slice(0, 10);
  const trips = [
    { tripId: "TEST-TRIP-A-COAL", completedAt: `${board.date}T08:00:00`, status: "completed", team: "A", materialType: "煤" },
    { tripId: "TEST-TRIP-A-SLAG", completedAt: `${board.date}T19:59:59`, status: "completed", team: "A", materialType: "岩石" },
    { tripId: "TEST-TRIP-B-COAL", completedAt: `${board.date}T20:00:00`, status: "completed", team: "B", materialType: "煤" },
    { tripId: "TEST-TRIP-B-SLAG", completedAt: `${dateAfter}T07:59:59`, status: "completed", team: "B", materialType: "渣" },
    { tripId: "TEST-TRIP-A-COAL", completedAt: `${board.date}T08:00:00`, status: "completed", team: "A", materialType: "煤" },
    { tripId: "TEST-TRIP-OUTSIDE", completedAt: `${dateAfter}T08:00:00`, status: "completed", team: "A", materialType: "煤" },
    { tripId: "TEST-TRIP-PENDING", completedAt: `${board.date}T12:00:00`, status: "pending_dispatch", team: "B", materialType: "煤" }
  ];
  await page.evaluate(rows => {
    localStorage.setItem("currentPersonId", "TEST-A-DISPATCH-001");
    localStorage.setItem("dispatchPersonId", "TEST-A-DISPATCH-001");
    localStorage.setItem("selectedPosition", "车队长");
    const roles = JSON.parse(localStorage.getItem("rolePersonIds") || "{}");
    roles["车队长"] = "TEST-A-DISPATCH-001";
    localStorage.setItem("rolePersonIds", JSON.stringify(roles));
    localStorage.setItem("tripRecords", JSON.stringify(rows));
  }, trips);

  await page.goto(`${ORIGIN}/dispatch.html`, { waitUntil: "domcontentloaded" });
  const boardElement = page.locator("#production-board");
  await boardElement.locator('[data-action="toggle"]').click();
  await expect(boardElement).toContainText(/当日总趟数\s*4/);
  await expect(boardElement).toContainText(/A组总趟数\s*2/);
  await expect(boardElement).toContainText(/A组渣总趟数\s*1/);
  await expect(boardElement).toContainText(/A组煤总趟数\s*1/);
  await expect(boardElement).toContainText(/B组总趟数\s*2/);
  await expect(boardElement).toContainText(/B组渣总趟数\s*1/);
  await expect(boardElement).toContainText(/B组煤总趟数\s*1/);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("tripRecords") || "[]"));
  expect(saved).toHaveLength(7);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
