"use strict";
const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const ORIGIN = "https://mine.test";
const ROOT = path.resolve(process.env.MINE_MANAGEMENT_TEST_ROOT || path.resolve(__dirname, ".."));
test("OPS-64 candidate blocks duplicate ID through legacy alias in admin master", async ({ page }) => {
  const errors = []; const dialogs = []; page.on("dialog", async d => { dialogs.push(d.message()); await d.accept(); });
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem("personnelRecords", JSON.stringify([{ personId: "TEST-OPS64-ADMIN", name: "TEST管理员", phone: "TEST-OPS64-ADMIN-PHONE", position: "管理员", status: "active", approvalStatus: "approved", personnelStatus: "在职可用" }, {
      personId: "TEST-OPS64-ORIGINAL", name: "TEST原档", phone: "TEST-OPS64-PHONE-1",
      position: "汽车司机", status: "active", idCardNumber: "   ", idCard: "TEST-OPS64-LEGACY-ID-001"
    }]));
    localStorage.setItem("adminPersonId", "TEST-OPS64-ADMIN");
    localStorage.setItem("selectedPosition", "管理员");
    sessionStorage.setItem("managementSession", JSON.stringify({ verified: true, position: "管理员", personId: "TEST-OPS64-ADMIN", expiresAt: Date.now() + 60000 }));
  });
  await page.route("**/*", async route => {
    const request = route.request(); const url = new URL(request.url());
    if (!["GET", "HEAD"].includes(request.method()) || url.origin !== ORIGIN) { blocked.push(`${request.method()} ${request.url()}`); return route.abort(); }
    const relative = decodeURIComponent(url.pathname.slice(1)) || "index.html";
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try { const body = await fs.readFile(file); const ext = path.extname(file).toLowerCase(); const contentType = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream"; return route.fulfill({ status: 200, contentType, body }); }
    catch (error) { console.log("missing", request.url(), file, String(error)); return route.fulfill({ status: 404, body: "missing test asset" }); }
  });
  await page.goto(`${ORIGIN}/admin-master.html`);
  await expect(page).toHaveTitle(/^管理员基础资料中心 V/);
  await page.evaluate(() => openPersonnelModal());
  await expect(page.locator("#personnelModal")).toBeVisible();
  await page.locator("#personnelName").fill("TEST别名重复人员");
  await page.locator("#personnelPhone").fill("TEST-OPS64-PHONE-2");
  await page.locator("#personnelPosition").selectOption({ label: "汽车司机" });
  await page.locator("#personnelIdCard").fill("TEST-OPS64-LEGACY-ID-001");
  await page.locator("#personnelModal").getByRole("button", { name: "保存人员资料" }).click();
  const people = await page.evaluate(() => JSON.parse(localStorage.getItem("personnelRecords") || "[]"));
  expect(people).toHaveLength(2);
  expect(people.some(row => row.name === "TEST别名重复人员")).toBe(false); await expect(page.locator("body")).toContainText("该身份证号已存在人员档案");
  expect(errors).toEqual([]); expect(blocked).toEqual([]);
});







