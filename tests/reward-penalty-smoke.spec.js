"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const { installAGroupRobotContext } = require("./a-group-multi-robot-fixture");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST 调度奖励按生产班组人员绑定车辆，并进入奖罚台账", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (!['GET', 'HEAD'].includes(req.method()) || url.origin !== ORIGIN) {
      blocked.push(`${req.method()} ${req.url()}`);
      return route.abort();
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const body = await fs.readFile(file);
      const ext = path.extname(file);
      const contentType = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" }[ext] || "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });
  await page.goto(`${ORIGIN}/index.html`, { waitUntil: "domcontentloaded" });
  await installAGroupRobotContext(page, "TEST-A-DISPATCH-001");
  await page.goto(`${ORIGIN}/dispatch.html`, { waitUntil: "domcontentloaded" });
  await page.locator("#issueRewardPenaltyButton").click();
  await page.locator("#rpoRecordType").selectOption("reward");
  await page.locator("#rpoWorkDate").fill(new Date().toISOString().slice(0, 10));
  await page.locator("#rpoCrew").selectOption("生产A组");
  await expect(page.locator("#rpoPerson option")).toContainText(["TEST-A-D-01"]);
  const value = await page.locator('#rpoPerson option').evaluateAll(options => options.find(option => option.textContent.includes("TEST-A组汽车司机01"))?.value);
  expect(value).toBe("TEST-A-D-001");
  const vehicle = await page.locator(`#rpoPerson option[value="${value}"]`).getAttribute("data-vehicle");
  expect(vehicle).toBe("TEST-A-T-001");
  await page.locator("#rpoPerson").selectOption(value);
  await page.locator("#rpoAmount").fill("50");
  await page.locator("#rpoDescription").fill("TEST安全生产奖励");
  await page.evaluate(() => {
    const original = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (key, value) => {
      if (["rewardRecords", "penaltyRecords", "overtimeRecords"].includes(key)) {
        const rows = JSON.parse(value || "[]");
        for (const row of rows) {
          for (const idKey of ["rewardId", "penaltyId", "overtimeId"]) {
            if (row[idKey] && !String(row[idKey]).startsWith("TEST-")) row[idKey] = `TEST-${row[idKey]}`;
          }
        }
        value = JSON.stringify(rows);
      }
      return original(key, value);
    };
  });
  page.once("dialog", async dialog => await dialog.accept());
  await page.locator("#submitRewardPenaltyButton").click();
  const rewards = await page.evaluate(() => JSON.parse(localStorage.getItem("rewardRecords") || "[]"));
  expect(rewards).toHaveLength(1);
  expect(rewards[0]).toMatchObject({ personId: "TEST-A-D-001", personName: "TEST-A组汽车司机01", crew: "生产A组", vehicleNumber: "TEST-A-T-001", amount: 50, status: "issued" });
  expect(rewards[0].rewardId).toMatch(/^TEST-/);
  await page.locator("#openRewardPenaltyManagerButton").click();
  await expect(page.locator("#rewardPenaltyManagerList")).toContainText("TEST安全生产奖励");
  await expect(page.locator("#rpoRewardTotal")).toHaveText("50.00");
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
