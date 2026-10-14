"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");
const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=", "base64");

test("TEST 排土管理人员可按生产组完成岗位登记", async ({ page }) => {
  const errors = [];
  const externalRequests = [];
  const alerts = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => { alerts.push(dialog.message()); await dialog.dismiss(); });
  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (this === window.localStorage && key === "personnelRecords") {
        try {
          const rows = JSON.parse(value);
          rows.forEach(person => {
            if (person?.name === "TEST排土管理员") {
              person.personId = "TEST-PERSON-DUMP-001";
              if ("employeeId" in person) person.employeeId = "TEST-PERSON-DUMP-001";
              if ("employeeNo" in person) person.employeeNo = "TEST-PERSON-DUMP-001";
              if ("id" in person) person.id = "TEST-PERSON-DUMP-001";
            }
          });
          value = JSON.stringify(rows);
        } catch {}
      }
      return originalSetItem.call(this, key, value);
    };
  });
  await page.route("**/*", async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (!['GET', 'HEAD'].includes(req.method()) || url.origin !== ORIGIN) {
      externalRequests.push(`${req.method()} ${req.url()}`);
      return route.abort();
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const body = await fs.readFile(file);
      const ext = path.extname(file);
      const contentType = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  await page.goto(`${ORIGIN}/person-register.html?position=${encodeURIComponent("排土管理")}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#position")).toHaveValue("排土管理");
  await page.locator("#name").fill("TEST排土管理员");
  await page.locator("#phone").fill("13800000000");
  await page.locator("#passportNumber").fill("TEST-PASSPORT-001");
  await page.locator("#selfiePhoto").setInputFiles({ name: "test.png", mimeType: "image/png", buffer: PNG_1PX });
  await expect(page.locator("#selfiePreview")).toHaveAttribute("src", /^data:image\//);
  await page.locator("#emergencyContact").fill("TEST联系人");
  await page.locator("#emergencyPhone").fill("13900000000");
  await page.locator("#submitButton").click();
  await expect.poll(() => alerts.length).toBe(1);
  expect(alerts[0]).toContain("一线生产岗位必须选择生产A组或生产B组");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("personnelRecords") || "[]").some(person => person.name === "TEST排土管理员"))).toBe(false);

  await page.locator("#team").selectOption("生产A组");
  await page.locator("#submitButton").click();

  const records = await page.evaluate(() => JSON.parse(localStorage.getItem("personnelRecords") || "[]"));
  const row = records.find(person => person.name === "TEST排土管理员");
  expect(row).toBeTruthy();
  expect(row.personId).toBe("TEST-PERSON-DUMP-001");
  expect(row.position).toBe("排土管理");
  expect(row.team).toBe("生产A组");
  expect(row.phone).toBe("13800000000");
  expect(row.avatarPhoto || row.profilePhoto || row.selfiePhoto).toMatch(/^data:image\//);
  expect(page.url()).toContain("person-waiting.html");
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
});

