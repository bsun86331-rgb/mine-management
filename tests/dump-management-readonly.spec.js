"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const { installAGroupRobotContext } = require("./a-group-multi-robot-fixture");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST排土管理人员看到已发布本班A组看板且只有查看权限", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", async route => {
    const req = route.request(); const url = new URL(req.url());
    if (!["GET", "HEAD"].includes(req.method()) || url.origin !== ORIGIN) { blocked.push(`${req.method()} ${req.url()}`); return route.abort(); }
    const file = path.resolve(ROOT, decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html");
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try { return route.fulfill({ status: 200, contentType: path.extname(file) === ".html" ? "text/html; charset=utf-8" : "text/javascript; charset=utf-8", body: await fs.readFile(file) }); }
    catch { return route.fulfill({ status: 404, body: "missing test asset" }); }
  });
  const { payload } = await installAGroupRobotContext(page, "TEST-A-DISPATCH-001");
  await page.addInitScript(() => {
    localStorage.setItem("currentPersonId", "TEST-A-DUMP-MGR-001");
    localStorage.setItem("selectedPosition", "排土管理");
    localStorage.setItem("transportZones", JSON.stringify([
      { zoneId: "TEST-LOAD-001", name: "TEST装载区", zoneType: "loading", enabled: true, testFixture: true },
      { zoneId: "TEST-UNLOAD-WASTE", name: "TEST排土场", zoneType: "unloading", materialType: "渣", enabled: true, testFixture: true }
    ]));
  });
  await page.goto(`${ORIGIN}/dump-management.html`, { waitUntil: "domcontentloaded" });
  const board = page.locator("#production-board");
  await expect(board.locator(".pb-tag")).toContainText("只读");
  await board.locator('[data-action="toggle"]').click();
  const group = board.locator(".pb-group").first();
  await expect(group).toContainText("TEST-A组挖机司机01");
  await expect(group).toContainText("TEST-A组汽车司机01");
  await expect(group).toContainText("TEST-A组排土管理01");
  await expect(group).toContainText("TEST排土场");
  await expect(board.locator('[data-action="edit"]')).toHaveCount(0);
  expect(payload.productionBoardState.revision).toBe(1);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
