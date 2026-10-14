"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST一线司机不能进入工资标准管理或综合报表", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => await dialog.accept());
  await page.addInitScript(() => {
    if (!localStorage.getItem("personnelRecords")) {
      localStorage.setItem("personnelRecords", JSON.stringify([{ personId: "TEST-DR-AUTH-001", name: "TEST司机", employeeNo: "TEST-DR-AUTH-001", position: "汽车司机", status: "approved", approvalStatus: "approved" }]));
      localStorage.setItem("currentPersonId", "TEST-DR-AUTH-001");
      localStorage.setItem("selectedPosition", "汽车司机");
    }
  });
  await page.route("**/*", async route => {
    const req = route.request(); const url = new URL(req.url());
    if (!["GET", "HEAD"].includes(req.method()) || url.origin !== ORIGIN) { blocked.push(`${req.method()} ${req.url()}`); return route.abort(); }
    const file = path.resolve(ROOT, decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html");
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try { return route.fulfill({ status: 200, contentType: path.extname(file) === ".html" ? "text/html; charset=utf-8" : "text/javascript; charset=utf-8", body: await fs.readFile(file) }); }
    catch { return route.fulfill({ status: 404, body: "missing test asset" }); }
  });
  await page.goto(`${ORIGIN}/payroll-settings.html`, { waitUntil: "domcontentloaded" });
  await expect.poll(() => new URL(page.url()).pathname).toBe("/management-login.html");
  expect(new URL(page.url()).searchParams.get("position")).toBe("管理员");
  await page.evaluate(() => { localStorage.removeItem("pendingProtectedPosition"); localStorage.removeItem("pendingProtectedPersonId"); });
  await page.goto(`${ORIGIN}/report-center.html`, { waitUntil: "domcontentloaded" });
  await expect.poll(() => new URL(page.url()).pathname).toBe("/index.html");
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
