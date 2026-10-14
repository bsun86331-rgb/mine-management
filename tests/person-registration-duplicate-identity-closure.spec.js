"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=", "base64");

test("TEST登记阻止重复身份证或护照，但允许本人更新原档案", async ({ page }) => {
  const dialogs = [];
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
  await page.addInitScript(() => {
    if (localStorage.getItem("TEST-PERSON-DUPLICATE-IDENTITY-SETUP") === "done") return;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("personnelRecords", JSON.stringify([
      { personId: "TEST-PERSON-ID-OWNER", employeeNo: "TEST-PERSON-ID-OWNER", name: "TEST身份证原档案", phone: "13800000001", position: "汽车司机", team: "生产A组", idCardNumber: "TEST-ID-DUPLICATE-001", passportNumber: "", status: "rejected", approvalStatus: "rejected", personnelStatus: "待修改", testFixture: true },
      { personId: "TEST-PERSON-PASSPORT-OWNER", employeeNo: "TEST-PERSON-PASSPORT-OWNER", name: "TEST护照原档案", phone: "13800000002", position: "汽车司机", team: "生产B组", idCardNumber: "", passportNumber: "TEST-PASSPORT-DUPLICATE-001", status: "pending", approvalStatus: "pending", personnelStatus: "待审核", testFixture: true }
    ]));
    localStorage.setItem("TEST-PERSON-DUPLICATE-IDENTITY-SETUP", "done");
  });
  await page.route("**/*", async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (!["GET", "HEAD"].includes(req.method()) || url.origin !== ORIGIN) {
      blocked.push(`${req.method()} ${req.url()}`);
      return route.abort();
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const body = await fs.readFile(file);
      const ext = path.extname(file).toLowerCase();
      const contentType = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" }[ext] || "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  async function fillRequiredFields(name) {
    await page.locator("#name").fill(name);
    await page.locator("#phone").fill("13800000000");
    await page.locator("#team").selectOption("生产A组");
    await page.locator("#selfiePhoto").setInputFiles({ name: "test.png", mimeType: "image/png", buffer: PNG });
    await page.locator("#emergencyContact").fill("TEST联系人");
    await page.locator("#emergencyPhone").fill("13900000000");
  }

  await page.goto(`${ORIGIN}/person-register.html?position=${encodeURIComponent("汽车司机")}`);
  await fillRequiredFields("TEST重复身份证申请人");
  await page.locator("#idCardNumber").fill(" test-id-duplicate-001 ");
  await page.locator("#submitButton").click();
  await expect.poll(() => dialogs.length).toBe(1);
  expect(dialogs[0]).toContain("身份证号已存在");
  await expect(page).toHaveURL(/person-register\.html/);
  let people = await page.evaluate(() => JSON.parse(localStorage.getItem("personnelRecords") || "[]"));
  expect(people).toHaveLength(2);
  expect(people.some(person => person.name === "TEST重复身份证申请人")).toBe(false);

  await page.goto(`${ORIGIN}/person-register.html?position=${encodeURIComponent("汽车司机")}`);
  await fillRequiredFields("TEST重复护照申请人");
  await page.locator("#passportNumber").fill("test-passport-duplicate-001");
  await page.locator("#submitButton").click();
  await expect.poll(() => dialogs.length).toBe(2);
  expect(dialogs[1]).toContain("护照号已存在");
  await expect(page).toHaveURL(/person-register\.html/);
  people = await page.evaluate(() => JSON.parse(localStorage.getItem("personnelRecords") || "[]"));
  expect(people).toHaveLength(2);
  expect(people.some(person => person.name === "TEST重复护照申请人")).toBe(false);

  await page.evaluate(() => {
    localStorage.setItem("waitingApplicantPersonId", "TEST-PERSON-ID-OWNER");
    localStorage.setItem("waitingApplicantPosition", "汽车司机");
    localStorage.setItem("currentPersonId", "TEST-PERSON-ID-OWNER");
    localStorage.setItem("selectedPosition", "汽车司机");
  });
  await page.goto(`${ORIGIN}/person-register.html?position=${encodeURIComponent("汽车司机")}`);
  await fillRequiredFields("TEST身份证原档案");
  await page.locator("#idCardNumber").fill("TEST-ID-DUPLICATE-001");
  await page.locator("#submitButton").click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/person-waiting.html");
  people = await page.evaluate(() => JSON.parse(localStorage.getItem("personnelRecords") || "[]"));
  expect(people).toHaveLength(2);
  expect(people.find(person => person.personId === "TEST-PERSON-ID-OWNER")).toMatchObject({ name: "TEST身份证原档案", idCardNumber: "TEST-ID-DUPLICATE-001", resubmitCount: 1, approvalStatus: "pending" });
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

