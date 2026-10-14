"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const { installAGroupRobotContext } = require("./a-group-multi-robot-fixture");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST生产看板显示车辆、设备、人员和岗位汇总", async ({ page }) => {
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

  const { payload } = await installAGroupRobotContext(page, "TEST-A-DISPATCH-001");
  await page.goto(`${ORIGIN}/dispatch.html`, { waitUntil: "domcontentloaded" });
  const board = page.locator("#production-board");
  await board.locator('[data-action="toggle"]').click();

  const values = await board.locator(".pb-metrics").evaluateAll(groups => {
    const result = {};
    for (const group of groups) {
      for (const metric of group.querySelectorAll(".pb-metric")) {
        const label = metric.querySelector("span")?.textContent.trim();
        const value = metric.querySelector("strong")?.textContent.trim();
        if (label) result[label] = value;
      }
    }
    return result;
  });
  const currentBoard = Object.values(payload.productionBoardState.boards).find(item => item.published);
  const assignedPeople = new Set(currentBoard.groups.flatMap(group => [group.excavatorDriverId, ...group.trucks.map(truck => truck.driverId), ...(group.dumpManagementPeople || [])]).filter(Boolean));
  expect(values["汽车总数（辆）"]).toBe("6");
  expect(values["出勤作业（辆）"]).toBe("6");
  expect(values["全部设备（台）"]).toBe("8");
  expect(values["生产组绑定人员"]).toBe(String(assignedPeople.size));
  await expect(board).toContainText("挖机司机 2 人 · 汽车司机 6 人 · 排土管理 1 人");
  expect(values["人员总数"]).toBe(String(payload.personnel.length));
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
