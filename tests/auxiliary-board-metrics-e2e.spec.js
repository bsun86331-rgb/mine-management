"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const { installAGroupRobotContext } = require("./a-group-multi-robot-fixture");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST辅助车辆出勤、空闲、维修状态和比例显示正确", async ({ page }) => {
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

  await installAGroupRobotContext(page, "TEST-A-DISPATCH-001");
  await page.addInitScript(() => {
    const extras = [
      { equipmentId: "TEST-AUX-WATER-01", equipmentNumber: "TEST-AUX-WATER-01", equipmentType: "洒水车", status: "available", testFixture: true },
      { equipmentId: "TEST-AUX-FUEL-01", equipmentNumber: "TEST-AUX-FUEL-01", equipmentType: "加油车", status: "available", testFixture: true },
      { equipmentId: "TEST-AUX-GRADER-01", equipmentNumber: "TEST-AUX-GRADER-01", equipmentType: "平路机", status: "available", currentStatus: "维修中", testFixture: true }
    ];
    localStorage.setItem("equipmentRecords", JSON.stringify([
      ...JSON.parse(localStorage.getItem("equipmentRecords") || "[]").filter(row => !row.equipmentId?.startsWith("TEST-AUX-")),
      ...extras
    ]));
  });

  await page.goto(`${ORIGIN}/dispatch.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const C = window.ProductionBoardCore;
    const state = JSON.parse(localStorage.getItem("mineProductionBoardV2") || "null") || C.emptyState();
    const slot = C.currentSlot(new Date(), state.schedule);
    const data = {
      people: JSON.parse(localStorage.getItem("personnelRecords") || "[]"),
      equipment: JSON.parse(localStorage.getItem("equipmentRecords") || "[]"),
      tasks: JSON.parse(localStorage.getItem("dispatchPublishedTasks") || "[]"),
      executions: JSON.parse(localStorage.getItem("dispatchShiftExecutions") || "[]"),
      zones: JSON.parse(localStorage.getItem("transportZones") || "[]"),
      operational: JSON.parse(localStorage.getItem("equipmentOperationalStatus") || "[]"),
      maintenance: [],
      leaves: [],
      attendance: [],
      trips: []
    };
    const board = C.boardFor(state, slot.date, slot.shift, data);
    board.auxiliary = [{ equipmentId: "TEST-AUX-WATER-01", driverId: "TEST-A-AUX-WATER-001", team: "A", work: "TEST道路洒水" }];
    board.published = true;
    board.version = 1;
    state.boards[C.slotKey(slot.date, slot.shift)] = board;
    localStorage.setItem("mineProductionBoardV2", JSON.stringify(state));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  const board = page.locator("#production-board");
  await board.locator('[data-action="toggle"]').click();
  const values = await board.locator(".pb-metrics").evaluateAll(groups => {
    const result = {};
    for (const group of groups) for (const metric of group.querySelectorAll(".pb-metric")) {
      const label = metric.querySelector("span")?.textContent.trim();
      if (label) result[label] = metric.querySelector("strong")?.textContent.trim();
    }
    return result;
  });
  expect(values["全部设备（台）"]).toBe("11");
  expect(values["汽车总数（辆）"]).toBe("6");
  await expect(board).toContainText(/辅助车辆：3 辆，出勤 1 辆，出勤率 33\.3%/);
  await expect(board).toContainText(/全部设备：出勤 9 台 · 空闲 1 台 · 维修 \/ 保养 1 台 · 出勤率 81\.8%/);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
