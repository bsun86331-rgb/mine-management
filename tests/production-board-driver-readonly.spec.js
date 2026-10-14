"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const { installAGroupRobotContext } = require("./a-group-multi-robot-fixture");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST汽车司机能查看生产任务板但没有调度编辑入口", async ({ page }) => {
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
  const { payload } = await installAGroupRobotContext(page, "TEST-A-D-001");
  await page.goto(`${ORIGIN}/dispatch.html`, { waitUntil: "domcontentloaded" });
  const board = page.locator("#production-board");
  await board.locator('[data-action="toggle"]').click();
  await expect(board.locator(".pb-tag")).toContainText("只读");
  await expect(board.locator('[data-action="edit"]')).toHaveCount(0);
  await expect(board.locator('[data-action="publish"]')).toHaveCount(0);
  await expect(board.locator(".pb-group").first()).toContainText("TEST-A组汽车司机01");
  const savedBefore = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem("mineProductionBoardV2"))));
  await board.locator('[data-action="equipment-info"]').first().click();
  await expect(page.locator("dialog.pb-dialog")).toBeVisible();
  await page.locator("dialog.pb-dialog").getByRole("button", { name: "关闭" }).click();
  const savedAfter = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem("mineProductionBoardV2"))));
  expect(savedAfter).toBe(savedBefore);
  expect(await page.evaluate(() => window.ProductionBoardCore.canEdit({ personId: localStorage.getItem("currentPersonId") }, JSON.parse(localStorage.getItem("personnelRecords"))))).toBe(false);
  expect(payload.productionBoardState.revision).toBe(1);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
