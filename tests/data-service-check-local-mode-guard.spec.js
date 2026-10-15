"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST数据库诊断在未配置时保持本机模式且不发送/同步数据", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));

  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("mineDataPendingQueue", JSON.stringify([
      {
        queue_id: "TEST-DB-CHECK-PENDING-001",
        table: "trip_records",
        action: "upsert",
        status: "pending",
        payload: { tripId: "TEST-DB-CHECK-TRIP-001" }
      }
    ]));
  });

  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!["GET", "HEAD"].includes(request.method()) || url.origin !== ORIGIN) {
      blocked.push(request.method() + " " + request.url());
      return route.abort();
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const ext = path.extname(file).toLowerCase();
      const contentType = ext === ".html"
        ? "text/html; charset=utf-8"
        : ext === ".js"
          ? "text/javascript; charset=utf-8"
          : "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body: await fs.readFile(file) });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  await page.goto(ORIGIN + "/data-service-check.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#serviceState")).toHaveText("READY");
  await expect(page.locator("#modeState")).toHaveText("LOCAL");
  await expect(page.locator("#configState")).toHaveText("未配置");
  await expect(page.locator("#pendingState")).toHaveText("1");

  const before = await page.evaluate(() =>
    JSON.stringify(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]))
  );

  for (const name of [
    "测试连接",
    "写入 TEST 并回读",
    "测试 pending queue",
    "测试正式配置映射"
  ]) {
    await page.getByRole("button", { name }).click();
    await expect(page.locator("#result")).toContainText("Supabase 尚未配置");
    await expect(page.locator("#result")).toHaveClass(/fail/);
    await expect(page.locator("#modeState")).toHaveText("LOCAL");
  }

  await page.getByRole("button", { name: "测试管理权限 RLS" }).click();
  await expect(page.locator("#authResult")).toContainText("Supabase 尚未配置");
  await expect(page.locator("#authResult")).toHaveClass(/fail/);

  const after = await page.evaluate(() =>
    JSON.stringify(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]))
  );
  expect(after).toBe(before);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("mineDataPendingQueue") || "[]"))).toHaveLength(1);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
