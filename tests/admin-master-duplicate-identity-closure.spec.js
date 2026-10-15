"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST管理员新增和编辑人员档案均阻止重复身份证或护照", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", dialog => dialog.accept());
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("personnelRecords", JSON.stringify([
      { personId: "TEST-ADMIN-001", name: "TEST管理员", phone: "13800000001", position: "管理员", status: "active", approvalStatus: "approved", personnelStatus: "在职可用" },
      { personId: "TEST-PERSON-ID-OWNER", name: "TEST身份证原档案", phone: "13800000002", position: "汽车司机", idCardNumber: "TEST-ID-DUPLICATE-\u200b001", status: "active", approvalStatus: "approved", personnelStatus: "在职可用" },
      { personId: "TEST-PERSON-PASSPORT-OWNER", name: "TEST护照原档案", phone: "13800000003", position: "汽车司机", passportNumber: "TEST-PASSPORT-DUPLICATE-\u2060001", status: "active", approvalStatus: "approved", personnelStatus: "在职可用" },
      { personId: "TEST-PERSON-EDIT", name: "TEST待编辑档案", phone: "13800000004", position: "汽车司机", idCardNumber: "TEST-ID-EDIT-001", status: "active", approvalStatus: "approved", personnelStatus: "在职可用" }
    ]));
    localStorage.setItem("adminPersonId", "TEST-ADMIN-001");
    sessionStorage.setItem("managementSession", JSON.stringify({ verified: true, position: "管理员", personId: "TEST-ADMIN-001", expiresAt: Date.now() + 60000 }));
  });
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
      const contentType = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" }[ext] || "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body: await fs.readFile(file) });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  await page.goto(`${ORIGIN}/admin-master.html`);
  await expect(page).toHaveTitle(/^管理员基础资料中心 V\d+\.\d+\.\d+$/);
  await expect(page.locator("header p")).toContainText(/V\d+\.\d+\.\d+/);
  await page.getByRole("button", { name: "+ 新增人员" }).click();
  await page.locator("#personnelName").fill("TEST重复身份证新档案");
  await page.locator("#personnelPhone").fill("13800000005");
  await page.locator("#personnelPosition").selectOption("汽车司机");
  await page.locator("#personnelIdCard").fill(" test-id-duplicate-001 ");
  await page.locator("#personnelPassport").fill("");
  await page.locator("#personnelEmergencyContact").fill("TEST联系人");
  await page.locator("#personnelEmergencyPhone").fill("13900000000");
  await page.locator("#personnelModal").getByRole("button", { name: "保存人员资料" }).click();
  let people = await page.evaluate(() => JSON.parse(localStorage.getItem("personnelRecords") || "[]"));
  expect(people).toHaveLength(4);
  expect(people.some(person => person.name === "TEST重复身份证新档案")).toBe(false);

  await page.evaluate(() => openPersonnelModal("TEST-PERSON-EDIT"));
  await page.locator("#personnelIdCard").fill("TEST-ID-DUPLICATE-001");
  await page.locator("#personnelModal").getByRole("button", { name: "保存人员资料" }).click();
  people = await page.evaluate(() => JSON.parse(localStorage.getItem("personnelRecords") || "[]"));
  expect(people.find(person => person.personId === "TEST-PERSON-EDIT").idCardNumber).toBe("TEST-ID-EDIT-001");

  await page.evaluate(() => openPersonnelModal("TEST-PERSON-EDIT"));
  await page.locator("#personnelIdCard").fill("TEST-ID-EDIT-001");
  await page.locator("#personnelPassport").fill(" test-passport-duplicate-001 ");
  await page.locator("#personnelModal").getByRole("button", { name: "保存人员资料" }).click();
  people = await page.evaluate(() => JSON.parse(localStorage.getItem("personnelRecords") || "[]"));
  expect(people.find(person => person.personId === "TEST-PERSON-EDIT").passportNumber).toBeFalsy();

  await page.evaluate(() => openPersonnelModal("TEST-PERSON-EDIT"));
  await page.locator("#personnelIdCard").fill("test-id-edit-001");
  await page.locator("#personnelModal").getByRole("button", { name: "保存人员资料" }).click();
  people = await page.evaluate(() => JSON.parse(localStorage.getItem("personnelRecords") || "[]"));
  expect(people.find(person => person.personId === "TEST-PERSON-EDIT").idCardNumber).toBe("test-id-edit-001");
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

