"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");
const NON_STATIC_ROUTES = new Set([
  "general-manager.html",
  "management.html",
  // This page is served by tests/robot-control-server.js, not GitHub Pages.
  "robot-test-center.html"
]);

test("隔离快照全部页面可加载且静态资源无404", async ({ page }) => {
  const blocked = [];
  const failures = [];
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("response", response => {
    if (response.status() >= 400) {
      const pathname = new URL(response.url()).pathname.replace(/^\/+/, "");
      if (!NON_STATIC_ROUTES.has(pathname)) failures.push(`${response.status()} ${pathname}`);
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
  const pageSet = new Set(pages);
  const brokenLinks = [];
  const hrefPattern = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  for (const source of pages) {
    const html = await fs.readFile(path.join(ROOT, source), "utf8");
    hrefPattern.lastIndex = 0;
    let match;
    while ((match = hrefPattern.exec(html))) {
      const href = (match[1] ?? match[2] ?? match[3] ?? "").replace(/&amp;/g, "&").trim();
      if (!href || href.includes("${") || href.startsWith("#") ||
          /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) continue;
      const pathname = href.split(/[?#]/, 1)[0];
      if (!/\.html?$/i.test(pathname)) continue;
      let decodedPath;
      try {
        decodedPath = decodeURIComponent(pathname);
      } catch {
        brokenLinks.push(`${source}: invalid encoded link ${href}`);
        continue;
      }
      const segments = decodedPath.startsWith("/")
        ? []
        : source.split("/").slice(0, -1);
      let escapesRoot = false;
      for (const segment of decodedPath.replace(/\\/g, "/").split("/")) {
        if (!segment || segment === ".") continue;
        if (segment === "..") {
          if (!segments.length) { escapesRoot = true; break; }
          segments.pop();
        } else {
          segments.push(segment);
        }
      }
      const target = segments.join("/") || "index.html";
      if (escapesRoot || !pageSet.has(target)) {
        brokenLinks.push(`${source}: ${href} -> ${escapesRoot ? "outside site root" : target}`);
      }
    }
  }
  expect(brokenLinks, `Dead internal HTML links: ${brokenLinks.join("; ")}`).toEqual([]);
  const routeSources = new Set(pages);
  const scriptSourcePattern = /<script\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  const brokenScriptSources = [];
  function resolveSitePath(value) {
    let pathname;
    try {
      pathname = decodeURIComponent(value.split(/[?#]/, 1)[0]);
    } catch {
      return null;
    }
    const segments = [];
    for (const segment of pathname.replace(/\\/g, "/").split("/")) {
      if (!segment || segment === ".") continue;
      if (segment === "..") {
        if (!segments.length) return null;
        segments.pop();
      } else {
        segments.push(segment);
      }
    }
    return segments.join("/") || "index.html";
  }
  for (const source of pages) {
    const html = await fs.readFile(path.join(ROOT, source), "utf8");
    scriptSourcePattern.lastIndex = 0;
    let match;
    while ((match = scriptSourcePattern.exec(html))) {
      const src = (match[1] ?? match[2] ?? match[3] ?? "").trim();
      if (!src || src.includes("\${") || src.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(src)) continue;
      const scriptPath = resolveSitePath(src);
      if (!scriptPath || !scriptPath.toLowerCase().endsWith(".js")) continue;
      try {
        await fs.access(path.join(ROOT, scriptPath));
        routeSources.add(scriptPath);
      } catch {
        brokenScriptSources.push(`${source}: missing script ${src}`);
      }
    }
  }
  expect(brokenScriptSources, `Missing local scripts: ${brokenScriptSources.join("; ")}`).toEqual([]);

  const literalRoutePattern = /["'\x60]([^"'\x60]{1,240}?\.html(?:[?#][^"'\x60]*?)?)["'\x60]/gi;
  const brokenRoutes = [];
  for (const source of routeSources) {
    const body = await fs.readFile(path.join(ROOT, source), "utf8");
    literalRoutePattern.lastIndex = 0;
    let match;
    while ((match = literalRoutePattern.exec(body))) {
      const href = (match[1] ?? "").replace(/&amp;/g, "&").trim();
      if (!href || href.includes("\${") || href.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(href)) continue;
      const pathname = href.split(/[?#]/, 1)[0];
      if (!/.html?$/i.test(pathname)) continue;
      const target = resolveSitePath(href);
      if (!target || !pageSet.has(target)) {
        brokenRoutes.push(`${source}: ${href} -> ${target || "outside site root"}`);
      }
    }
  }
  expect(brokenRoutes, `Dead literal HTML routes: ${brokenRoutes.join("; ")}`).toEqual([]);
  const checked = [];
  for (const file of pages) {
    if (NON_STATIC_ROUTES.has(file)) continue;
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

