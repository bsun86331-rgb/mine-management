"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

async function attachSnapshotRoutes(page, blocked) {
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!["GET", "HEAD"].includes(request.method()) || url.origin !== ORIGIN) {
      blocked.push(request.method() + " " + request.url());
      return route.abort();
    }
    const relative = decodeURIComponent(url.pathname).split("/").filter(Boolean).join("/") || "index.html";
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const ext = path.extname(file);
      const contentType = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body: await fs.readFile(file) });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });
}

test("中层岗位跳转到有权限的报表中心，未建设岗位入口被暂停", async ({ page }) => {
  const blocked = [];
  const errors = [];
  const roles = ["统计", "会计", "后勤", "测量员", "安全员"];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", dialog => dialog.accept());

  await page.addInitScript(testRoles => {
    localStorage.setItem("personnelRecords", JSON.stringify(
      testRoles.map((position, index) => ({
        personId: "TEST-MGMT-" + (index + 1),
        name: "测试" + position,
        employeeNo: "TEST-MGMT-" + (index + 1),
        position,
        status: "active",
        approvalStatus: "approved",
        personnelStatus: "在职可用"
      }))
    ));
  }, roles);
  await attachSnapshotRoutes(page, blocked);

  for (const position of ["统计", "会计", "后勤"]) {
    await page.goto(ORIGIN + "/index.html", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => openRoleModal("management"));
    await page.getByRole("button", { name: position, exact: true }).click();
    await page.waitForURL(url => url.pathname.endsWith("/report-center.html"));
    expect(await page.evaluate(() => localStorage.getItem("selectedPosition"))).toBe(position);
    expect(await page.locator("body").innerText()).toContain("综合报表中心");
  }

  for (const position of ["测量员", "安全员"]) {
    await page.goto(ORIGIN + "/index.html", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => openRoleModal("management"));
    await page.getByRole("button", { name: position, exact: true }).click();
    await expect(page).toHaveURL(url => url.pathname.endsWith("/index.html"));
    expect(await page.locator("body").innerText()).toContain("该岗位工作页面正在建设中");
  }

  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
