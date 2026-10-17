"use strict";
const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");
const API_ORIGIN = "https://api.github.com";
const API_ROOT = API_ORIGIN + "/repos/bsun86331-rgb/mine-management";
const MAIN_SHA = "a".repeat(40);
const OLD_SHA = "b".repeat(40);
const RUN_URL = "https://github.com/bsun86331-rgb/mine-management/actions/runs/123456789";

async function openReadinessCase(page, options = {}) {
  const { mainSha = MAIN_SHA, runSha = MAIN_SHA, status = "completed", conclusion = "success", apiStatus = 200 } = options;
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!["GET", "HEAD"].includes(request.method())) return route.abort();

    if (url.origin === API_ORIGIN) {
      if (apiStatus !== 200) return route.fulfill({
        status: apiStatus, headers: { "access-control-allow-origin": ORIGIN },
        contentType: "application/json", body: JSON.stringify({ message: "TEST GitHub API unavailable" })
      });
      if (url.pathname.endsWith("/commits/main")) return route.fulfill({
        status: 200, headers: { "access-control-allow-origin": ORIGIN },
        contentType: "application/json", body: JSON.stringify({ sha: mainSha })
      });
      if (url.pathname.endsWith("/actions/workflows/robot-tests.yml/runs")) return route.fulfill({
        status: 200, headers: { "access-control-allow-origin": ORIGIN },
        contentType: "application/json",
        body: JSON.stringify({ workflow_runs: [{
          event: "push", head_branch: "main", head_sha: runSha, status, conclusion,
          created_at: "2026-10-17T02:10:00Z", updated_at: "2026-10-17T02:20:45Z", html_url: RUN_URL
        }] })
      });
      return route.fulfill({ status: 404, body: "Unexpected TEST GitHub request" });
    }

    if (url.origin !== ORIGIN) return route.abort();
    if (url.pathname === "/api/status") return route.fulfill({ status: 503, body: "TEST robot controller intentionally offline" });
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const body = await fs.readFile(file);
      const ext = path.extname(file).toLowerCase();
      const contentType = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" }[ext] || "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing TEST asset" });
    }
  });
  await page.goto(ORIGIN + "/robot-test-center.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#fullSuiteReadyValue")).not.toHaveText("核验中");
  return errors;
}

test("TEST快速检查与GitHub main全量门槛分开并显示SHA和时间", async ({ page }) => {
  const errors = await openReadinessCase(page);
  await expect(page.locator("#overallReadyValue")).toHaveText("待验证");
  await expect(page.locator("#overallReadySub")).toContainText("发布前仍需完整 Playwright 全套通过");
  await expect(page.locator("#fullSuiteReadyValue")).toHaveText("当前 main 全量通过");
  await expect(page.locator("#fullSuiteReadySub")).toContainText("测试提交 aaaaaaaaaaaa");
  await expect(page.locator("#fullSuiteReadySub")).toContainText("当前 main aaaaaaaaaaaa");
  await expect(page.locator("#fullSuiteRunLink")).toBeVisible();
  await expect(page.locator("#fullSuiteRunLink")).toHaveAttribute("href", RUN_URL);
  expect(errors).toEqual([]);
});

test("TEST旧SHA即使历史CI成功也不能显示当前main全量通过", async ({ page }) => {
  const errors = await openReadinessCase(page, { runSha: OLD_SHA });
  await expect(page.locator("#fullSuiteReadyValue")).toHaveText("最近运行已过时");
  await expect(page.locator("#fullSuiteReadyValue")).toHaveClass(/ready-unknown/);
  await expect(page.locator("#fullSuiteReadySub")).toContainText("测试提交 bbbbbbbbbbbb");
  await expect(page.locator("#fullSuiteReadySub")).toContainText("当前 main aaaaaaaaaaaa");
  expect(errors).toEqual([]);
});

test("TEST当前SHA失败或GitHub不可用时不显示全量PASS", async ({ page }) => {
  let errors = await openReadinessCase(page, { conclusion: "failure" });
  await expect(page.locator("#fullSuiteReadyValue")).toHaveText("当前 main 全量未通过");
  await expect(page.locator("#fullSuiteReadyValue")).toHaveClass(/ready-fail/);
  expect(errors).toEqual([]);
  errors = await openReadinessCase(page, { apiStatus: 403 });
  await expect(page.locator("#fullSuiteReadyValue")).toHaveText("未能核验");
  await expect(page.locator("#fullSuiteReadyValue")).toHaveClass(/ready-unknown/);
  await expect(page.locator("#fullSuiteReadySub")).toContainText("不能据此判定通过");
  expect(errors).toEqual([]);
});
