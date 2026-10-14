"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");
const STORAGE_KEYS = [
  "transportZones",
  "dispatchPublishedTasks",
  "tripRecords",
  "driverTripRecords",
  "dispatchShiftExecutions",
  "shiftAssignmentChanges",
  "driverTransportCycleState"
];

test("TEST运输联调页的空数据检查能提示缺项且不写业务数据", async ({ page }) => {
  const errors = [];
  const blocked = [];
  await page.addInitScript(keys => {
    for (const key of keys) localStorage.setItem(key, "[]");
  }, STORAGE_KEYS);
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!["GET", "HEAD"].includes(request.method()) || url.origin !== ORIGIN) {
      blocked.push(`${request.method()} ${request.url()}`);
      return route.abort();
    }
    const file = path.resolve(ROOT, decodeURIComponent(url.pathname).slice(1) || "index.html");
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const body = await fs.readFile(file);
      const contentType = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8"
      }[path.extname(file)] || "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  await page.goto(`${ORIGIN}/transport.html`, { waitUntil: "domcontentloaded" });
  const before = await page.evaluate(keys => Object.fromEntries(
    keys.map(key => [key, localStorage.getItem(key)])
  ), STORAGE_KEYS);

  await expect(page.locator("#issues")).toContainText("还没有创建运输区域");
  await page.getByRole("button", { name: "▶ 开始完整联调" }).click();
  await expect(page.locator("#issues")).toContainText("装载区数量");
  await expect(page.locator("#totalTrips")).toHaveText("0");
  await expect(page.locator("#coalTrips")).toHaveText("0");
  await expect(page.locator("#wasteTrips")).toHaveText("0");

  const after = await page.evaluate(keys => Object.fromEntries(
    keys.map(key => [key, localStorage.getItem(key)])
  ), STORAGE_KEYS);
  expect(after).toEqual(before);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

