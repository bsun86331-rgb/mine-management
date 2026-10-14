"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("总经理入口引用 general-manager.html，但当前仓库没有该页面", async ({ page }) => {
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

  const [home, login, waiting] = await Promise.all([
    fs.readFile(path.join(ROOT, "index.html"), "utf8"),
    fs.readFile(path.join(ROOT, "management-login.html"), "utf8"),
    fs.readFile(path.join(ROOT, "person-waiting.html"), "utf8")
  ]);
  expect(home).toContain('"总经理"');
  expect(home).toContain('"general-manager.html"');
  expect(login).toContain('"总经理"');
  expect(login).toContain('"general-manager.html"');
  expect(waiting).toContain('"general-manager.html"');

  const response = await page.goto(`${ORIGIN}/general-manager.html`, { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(404);
  expect(await page.locator("body").innerText()).toContain("missing test asset");
  await page.screenshot({ path: "C:/Users/Administrator/Documents/Codex/2026-10-11/new-chat/outputs/证据_OPS-08_总经理路由404_2026-10-14.png", fullPage: true });
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
