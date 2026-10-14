"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("多个中层岗位入口引用 management.html，但当前仓库没有该页面", async ({ page }) => {
  const blocked = [];
  const errors = [];
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
      const ext = path.extname(file);
      const contentType = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : "text/css; charset=utf-8";
      return route.fulfill({ status: 200, contentType, body: await fs.readFile(file) });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  const [home, waiting, chat] = await Promise.all([
    fs.readFile(path.join(ROOT, "index.html"), "utf8"),
    fs.readFile(path.join(ROOT, "person-waiting.html"), "utf8"),
    fs.readFile(path.join(ROOT, "js", "work-chat.js"), "utf8")
  ]);
  for (const position of ["测量员", "安全员", "统计", "会计", "后勤"]) {
    expect(home).toContain(`"${position}"`);
    expect(home).toContain('"management.html"');
  }
  expect(waiting).toContain('"management.html"');
  expect(chat).toContain('"management.html"');

  const response = await page.goto(`${ORIGIN}/management.html`, { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(404);
  expect(await page.locator("body").innerText()).toContain("missing test asset");
  await page.screenshot({ path: "C:/Users/Administrator/Documents/Codex/2026-10-11/new-chat/outputs/证据_OPS-09_中层岗位路由404_2026-10-14.png", fullPage: true });
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
