"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");
const KNOWN_MISSING = new Set(["general-manager.html", "management.html"]);

test("隔离快照全部页面可加载且静态资源无404", async ({ page }) => {
  const blocked = [];
  const failures = [];
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("response", response => {
    if (response.status() >= 400) {
      const pathname = new URL(response.url()).pathname.replace(/^\/+/, "");
      if (!KNOWN_MISSING.has(pathname)) failures.push(`${response.status()} ${pathname}`);
    }
  });
  page.on("dialog", dialog => dialog.accept());
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
      const contentType = ({
        ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp",
        ".woff": "font/woff", ".woff2": "font/woff2"
      })[ext] || "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body: await fs.readFile(file) });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  const pages = (await fs.readdir(ROOT)).filter(file => file.toLowerCase().endsWith(".html")).sort();
  const checked = [];
  for (const file of pages) {
    if (KNOWN_MISSING.has(file)) continue;
    let response;
    try {
      response = await page.goto(`${ORIGIN}/${encodeURIComponent(file)}`, { waitUntil: "domcontentloaded" });
    } catch (error) {
      // Some protected pages immediately redirect unauthenticated visitors.
      // The original response is still captured by the response listener.
      if (!/interrupted by another navigation/.test(error.message)) throw error;
      await page.waitForLoadState("domcontentloaded");
    }
    checked.push(`${file}:${response?.status() || "redirected"}`);
  }

  expect(checked.length).toBeGreaterThan(0);
  expect(failures, `HTTP resource failures: ${failures.join("; ")}`).toEqual([]);
  expect(pageErrors, `Page script errors: ${pageErrors.join("; ")}`).toEqual([]);
  expect(blocked, `Non-local or non-GET requests: ${blocked.join("; ")}`).toEqual([]);
});
