"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("没有有效管理员会话时基础资料页拒绝访问并退回首页", async ({ page }) => {
  const blocked = [];
  const errors = [];
  const dialogs = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
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

  const response = await page.goto(`${ORIGIN}/admin-master.html`, { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  // The access guard redirects immediately, so wait for the destination before
  // inspecting the page context; evaluating during navigation is inherently racy.
  await page.waitForURL(`${ORIGIN}/index.html`);
  expect(await page.evaluate(() => ({
    managementSession: sessionStorage.getItem("managementSession"),
    adminPersonId: localStorage.getItem("adminPersonId"),
    managerPersonId: localStorage.getItem("managerPersonId")
  }))).toEqual({ managementSession: null, adminPersonId: null, managerPersonId: null });
  expect(dialogs).toContain("管理员基础资料中心需要管理员二次验证，请从系统首页重新进入。");
  await expect(page.locator("#personnelModal")).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
