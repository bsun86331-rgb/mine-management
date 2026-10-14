"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST员工确认奖励、罚款和加班记录后状态闭环", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => await dialog.accept());
  await page.addInitScript(() => {
    if (!localStorage.getItem("personnelRecords")) {
      localStorage.setItem("personnelRecords", JSON.stringify([{ personId: "TEST-RPO-001", employeeNo: "TEST-RPO-001", name: "TEST汽车司机", position: "汽车司机", status: "approved", approvalStatus: "approved", department: "生产A组" }]));
      localStorage.setItem("currentPersonId", "TEST-RPO-001");
      localStorage.setItem("selectedPosition", "汽车司机");
      const day = new Date().toISOString().slice(0, 10);
      const common = { personId: "TEST-RPO-001", personName: "TEST汽车司机", vehicleNumber: "TEST-TRUCK-01", workDate: day, issuedBy: "TEST调度", status: "pending_acknowledgement", createdAt: new Date().toISOString() };
      localStorage.setItem("rewardRecords", JSON.stringify([{ ...common, rewardId: "TEST-REWARD-001", amount: 20, description: "TEST安全奖励" }]));
      localStorage.setItem("penaltyRecords", JSON.stringify([{ ...common, penaltyId: "TEST-PENALTY-001", amount: 5, description: "TEST记录罚款" }]));
      localStorage.setItem("overtimeRecords", JSON.stringify([{ ...common, overtimeId: "TEST-OVERTIME-001", amount: 10, description: "TEST加班" }]));
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
  await page.goto(`${ORIGIN}/reward-penalty-overtime.html`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#pendingCount")).toHaveText("3 条新信息");
  for (const type of ["reward", "penalty", "overtime"]) {
    await page.locator(`[data-filter="${type}"]`).click();
    await page.locator("#recordList").getByRole("button", { name: "我已知晓" }).click();
    await expect(page.locator("#recordList")).toContainText("已确认");
  }
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("rewardRecords"))[0].status)).toBe("acknowledged");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("penaltyRecords"))[0].status)).toBe("acknowledged");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("overtimeRecords"))[0].status)).toBe("acknowledged");
  await page.locator('[data-filter=""]').click();
  await expect(page.locator("#pendingCount")).toHaveText("0 条新信息");
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
