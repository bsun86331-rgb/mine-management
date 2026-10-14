"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const { installAGroupRobotContext } = require("./a-group-multi-robot-fixture");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST调度设置白夜班边界、实时归班并可切换查看另一班", async ({ page }) => {
  test.setTimeout(15000);
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
  await page.goto(`${ORIGIN}/index.html`, { waitUntil: "domcontentloaded" });
  await page.goto(`${ORIGIN}/dispatch.html`, { waitUntil: "domcontentloaded" });
  const board = page.locator("#production-board");
  await board.locator('[data-action="toggle"]').click();
  await board.locator('[data-action="schedule"]').click();
  const dialog = page.locator("dialog.pb-dialog");
  await expect(dialog).toContainText("设置白班、夜班时间");
  await dialog.locator('[name="dayStart"]').fill("07:00");
  await dialog.locator('[name="dayEnd"]').fill("19:00");
  await dialog.locator('[name="nightStart"]').fill("19:00");
  await dialog.locator('[name="nightEnd"]').fill("07:00");
  await dialog.getByRole("button", { name: "确认" }).click();

  const actual = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("mineProductionBoardV2"));
    const current = window.ProductionBoardCore.currentSlot(new Date(), state.schedule);
    return { schedule: state.schedule, current, date: document.querySelector('#production-board [data-action="date"]').value };
  });
  expect(actual.schedule).toEqual({ dayStart: "07:00", dayEnd: "19:00", nightStart: "19:00", nightEnd: "07:00" });
  expect(actual.date).toBe(actual.current.date);
  await expect(board.locator('.pb-tabs [data-action="shift"].pb-active')).toContainText(actual.current.shift);
  await expect(board.locator('.pb-tabs')).toContainText("次日结束");

  const alternate = actual.current.shift === "白班" ? "夜班" : "白班";
  await board.locator(`[data-action="shift"][data-shift="${alternate}"]`).click();
  await expect(board.locator('.pb-tabs [data-action="shift"].pb-active')).toContainText(alternate);
  await board.locator('[data-action="auto"]').click();
  await expect(board.locator('.pb-tabs [data-action="shift"].pb-active')).toContainText(actual.current.shift);

  await board.locator('[data-action="schedule"]').click();
  const beforeInvalidSave = await page.evaluate(() => JSON.parse(localStorage.getItem("mineProductionBoardV2")).schedule);
  const invalid = page.locator("dialog.pb-dialog");
  await invalid.locator('[name="dayEnd"]').fill("18:30");
  await invalid.getByRole("button", { name: "确认" }).click();
  await expect(invalid.locator("#pb-dialog-error")).toContainText("白班结束须等于夜班开始");
  const afterInvalidSave = await page.evaluate(() => JSON.parse(localStorage.getItem("mineProductionBoardV2")).schedule);
  expect(afterInvalidSave).toEqual(beforeInvalidSave);
  await invalid.getByRole("button", { name: "关闭" }).click();
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
