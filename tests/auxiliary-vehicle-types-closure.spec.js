"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");
const AUXILIARY_TYPES = [
  ["铲车司机", "铲车"],
  ["推土机司机", "推土机"],
  ["平路机司机", "平路机"],
  ["大巴司机", "大巴"],
  ["洒水车司机", "洒水车"],

  ["其他辅助车辆司机", "其他辅助车辆"]
];

test("TEST六类辅助车辆岗位作业闭环", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => await dialog.accept());
  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, rawValue) {
      if (key === "auxiliaryWorkRecords") {
        try { const rows = JSON.parse(rawValue); rows.forEach(row => { if (row.workRecordId && !String(row.workRecordId).startsWith("TEST-")) row.workRecordId = `TEST-${row.workRecordId}`; }); rawValue = JSON.stringify(rows); } catch {}
      }
      return originalSetItem.call(this, key, rawValue);
    };
    const positions = ["铲车司机", "推土机司机", "平路机司机", "大巴司机", "洒水车司机", "其他辅助车辆司机"];
    localStorage.setItem("personnelRecords", JSON.stringify(positions.map((position, index) => ({ personId: `TEST-AUX-TYPE-${index + 1}`, employeeNo: `TEST-AUX-TYPE-${index + 1}`, name: `TEST${position}`, position, status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", team: "生产A组" }))));
    localStorage.setItem("auxiliaryWorkRecords", "[]");
    localStorage.setItem("equipmentOperationalStatus", "[]");
    localStorage.setItem("equipmentRecords", "[]");
  });
  await page.route("**/*", async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (!["GET", "HEAD"].includes(req.method()) || url.origin !== ORIGIN) {
      blocked.push(`${req.method()} ${req.url()}`);
      return route.abort();
    }
    const file = path.resolve(ROOT, decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html");
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const body = await fs.readFile(file);
      const ext = path.extname(file);
      return route.fulfill({ status: 200, contentType: ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream", body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  await page.goto(`${ORIGIN}/index.html`, { waitUntil: "domcontentloaded" });
  for (const [index, [position, vehicleType]] of AUXILIARY_TYPES.entries()) {
    const personId = `TEST-AUX-TYPE-${index + 1}`;
    const vehicleNumber = `TEST-AUX-VEHICLE-${index + 1}`;
    const taskId = `TEST-AUX-TYPE-TASK-${index + 1}`;
    const work = `TEST${vehicleType}专项作业`;
    await page.evaluate(({ position, personId, vehicleType, vehicleNumber, taskId, work }) => {
      localStorage.setItem("currentPersonId", personId);
      localStorage.setItem("selectedPosition", position);
      localStorage.setItem("auxiliaryVehicleProfile", JSON.stringify({ vehicleType, vehicleNumber }));
      localStorage.setItem("dispatchPublishedTasks", JSON.stringify([{ taskId, taskType: "auxiliary", status: "active", area: "TEST专项作业区", shift: "夜班", publishedAt: new Date().toISOString(), auxiliaryAssignments: [{ vehicleId: vehicleNumber, work }] }]));
      localStorage.setItem("auxiliaryWorkRecords", "[]");
      localStorage.setItem("equipmentOperationalStatus", "[]");
    }, { position, personId, vehicleType, vehicleNumber, taskId, work });
    await page.goto(`${ORIGIN}/auxiliary.html`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#currentTaskArea")).toContainText(work);
    await expect(page.locator("#currentTaskArea")).toContainText("TEST专项作业区");
    await page.locator("#currentTaskArea").getByRole("button", { name: "开始作业" }).click();
    let rows = await page.evaluate(() => JSON.parse(localStorage.getItem("auxiliaryWorkRecords") || "[]"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ workRecordId: expect.stringContaining("TEST-"), taskId, personId, position, vehicleType, vehicleNumber, area: "TEST专项作业区", shift: "夜班", work, status: "working" });
    await page.locator("#currentTaskArea").getByRole("button", { name: "结束作业" }).click();
    rows = await page.evaluate(() => JSON.parse(localStorage.getItem("auxiliaryWorkRecords") || "[]"));
    expect(rows[0]).toMatchObject({ status: "completed", completedAt: expect.any(String), durationMinutes: expect.any(Number) });
    expect(rows[0].durationMinutes).toBeGreaterThanOrEqual(1);
  }
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});





