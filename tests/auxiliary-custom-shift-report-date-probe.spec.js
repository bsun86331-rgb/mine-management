"use strict";
const { evidencePath } = require("./evidence-path.cjs");
const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST辅助车辆自定义夜班完成记录进入日历完成日报而非任务生产日报", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => await dialog.accept());
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
      const contentType = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body: await fs.readFile(file) });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  await page.addInitScript(() => {
    if (location.pathname !== "/auxiliary.html") return;
    const driver = { personId: "TEST-AUX-SHIFT-DRIVER", employeeNo: "TEST-AUX-SHIFT-DRIVER", name: "TEST洒水车司机", position: "洒水车司机", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", team: "生产A组" };
    const admin = { personId: "TEST-AUX-SHIFT-ADMIN", employeeNo: "TEST-AUX-SHIFT-ADMIN", name: "TEST报表管理员", position: "管理员", status: "approved", approvalStatus: "approved" };
    localStorage.setItem("personnelRecords", JSON.stringify([driver, admin]));
    localStorage.setItem("currentPersonId", driver.personId);
    localStorage.setItem("selectedPosition", driver.position);
    localStorage.setItem("auxiliaryVehicleProfile", JSON.stringify({ vehicleType: "洒水车", vehicleNumber: "TEST-AUX-SHIFT-TRUCK" }));
    localStorage.setItem("dispatchPublishedTasks", JSON.stringify([{ taskId: "TEST-AUX-SHIFT-TASK", taskType: "auxiliary", status: "active", area: "TEST道路", shift: "夜班", shiftDate: "2026-10-13", publishedAt: new Date().toISOString(), auxiliaryAssignments: [{ vehicleId: "TEST-AUX-SHIFT-TRUCK", work: "TEST洒水作业" }] }]));
    localStorage.setItem("auxiliaryWorkRecords", "[]");
    localStorage.setItem("fuelRecords", "[]");
    localStorage.setItem("equipmentOperationalStatus", "[]");
    localStorage.setItem("equipmentRecords", "[]");
    localStorage.setItem("tripRecords", "[]");
    localStorage.setItem("driverTripRecords", "[]");
    localStorage.setItem("transportRecords", "[]");
  });

  await page.goto(`${ORIGIN}/auxiliary.html`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#currentTaskArea")).toContainText("TEST洒水作业");
  await page.locator("#currentTaskArea").getByRole("button", { name: "开始作业" }).click();
  const beforeFinish = await page.evaluate(() => JSON.parse(localStorage.getItem("auxiliaryWorkRecords") || "[]")[0]);
  await page.clock.setFixedTime(new Date("2026-10-14T00:30:00.000Z")); // 08:30 Asia/Ulaanbaatar
  await page.locator("#currentTaskArea").getByRole("button", { name: "结束作业" }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("auxiliaryWorkRecords") || "[]")[0]);
  expect(saved.taskId).toBe("TEST-AUX-SHIFT-TASK");
  expect(saved.shift).toBe("夜班");
  expect(saved.completedAt).toBe("2026-10-14T00:30:00.000Z");
  expect(saved).not.toHaveProperty("shiftDate");
  expect(saved).not.toHaveProperty("productionDate");

  await page.evaluate(() => {
    const adminId = "TEST-AUX-SHIFT-ADMIN";
    localStorage.setItem("currentPersonId", adminId);
    localStorage.setItem("selectedPosition", "管理员");
    sessionStorage.setItem("managementSession", JSON.stringify({ verified: true, personId: adminId, position: "管理员", expiresAt: Date.now() + 600000 }));
  });
  await page.goto(`${ORIGIN}/report-center.html`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-report="production"]').click();
  await page.locator("#productionDate").fill("2026-10-13");
  await page.evaluate(() => renderAuxiliaryProductionReport());
  const taskProductionDayCount = await page.locator("#auxiliaryReportDayCount").innerText();
  await page.locator("#productionDate").fill("2026-10-14");
  await page.evaluate(() => renderAuxiliaryProductionReport());
  const completionCalendarDayCount = await page.locator("#auxiliaryReportDayCount").innerText();

  console.log("TEST辅助车辆班次日期与完成日报观察:", JSON.stringify({ beforeFinish, saved, taskProductionDayCount, completionCalendarDayCount }));
  await page.screenshot({ path: evidencePath("证据_辅助车辆自定义班次报表日期", "auxiliary-custom-shift-report-date-probe"), fullPage: true });
  expect(taskProductionDayCount).toBe("0");
  expect(completionCalendarDayCount).toBe("1");
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

