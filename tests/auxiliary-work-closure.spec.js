"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST辅助车辆司机开始并完成调度作业", async ({ page }) => {
  const errors = [];
  const blocked = [];
  const dialogs = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, rawValue) {
      if (key === "auxiliaryWorkRecords") {
        try { const rows = JSON.parse(rawValue); for (const row of rows || []) if (row.workRecordId && !String(row.workRecordId).startsWith("TEST-")) row.workRecordId = `TEST-${row.workRecordId}`; rawValue = JSON.stringify(rows); } catch {}
      }
      return originalSetItem.call(this, key, rawValue);
    };
    if (!localStorage.getItem("personnelRecords")) {
      localStorage.setItem("personnelRecords", JSON.stringify([{ personId: "TEST-AUX-001", employeeNo: "TEST-AUX-001", name: "TEST洒水车司机", position: "洒水车司机", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", team: "生产A组" }]));
      localStorage.setItem("currentPersonId", "TEST-AUX-001");
      localStorage.setItem("selectedPosition", "洒水车司机");
      localStorage.setItem("auxiliaryVehicleProfile", JSON.stringify({ vehicleType: "洒水车", vehicleNumber: "TEST-AUX-TRUCK-01" }));
      localStorage.setItem("dispatchPublishedTasks", JSON.stringify([{ taskId: "TEST-AUX-TASK-001", taskType: "auxiliary", status: "active", area: "TEST东侧运输道路", shift: "白班", publishedAt: new Date().toISOString(), auxiliaryAssignments: [{ vehicleId: "TEST-AUX-TRUCK-01", work: "TEST道路洒水" }] }]));
      localStorage.setItem("auxiliaryWorkRecords", "[]");
      localStorage.setItem("equipmentOperationalStatus", "[]");
      localStorage.setItem("equipmentRecords", "[]");
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
  await page.goto(`${ORIGIN}/auxiliary.html`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#currentTaskArea")).toContainText("TEST道路洒水");
  await page.locator("#currentTaskArea").getByRole("button", { name: "开始作业" }).click();
  let records = await page.evaluate(() => JSON.parse(localStorage.getItem("auxiliaryWorkRecords") || "[]"));
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({ workRecordId: expect.stringContaining("TEST-"), taskId: "TEST-AUX-TASK-001", personId: "TEST-AUX-001", vehicleNumber: "TEST-AUX-TRUCK-01", area: "TEST东侧运输道路", work: "TEST道路洒水", status: "working" });
  await expect(page.locator("#taskStatusBadge")).toHaveText("作业中");
  await page.locator("#currentTaskArea").getByRole("button", { name: "结束作业" }).click();
  records = await page.evaluate(() => JSON.parse(localStorage.getItem("auxiliaryWorkRecords") || "[]"));
  expect(records).toHaveLength(1);
  expect(records[0].status).toBe("completed");
  expect(records[0].completedAt).toBeTruthy();
  const startedAt = Date.parse(records[0].startedAt);
  const completedAt = Date.parse(records[0].completedAt);
  expect(Number.isFinite(startedAt)).toBe(true);
  expect(Number.isFinite(completedAt)).toBe(true);
  expect(completedAt).toBeGreaterThanOrEqual(startedAt);
  expect(records[0].durationMinutes).toBe(Math.max(1, Math.round((completedAt - startedAt) / 60000)));
  await expect(page.locator("#taskStatusBadge")).toHaveText("待执行");
  expect(dialogs.some(message => message.includes("本次作业已完成"))).toBe(true);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

