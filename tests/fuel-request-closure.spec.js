"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST司机加油申请按范围门禁自动读取调度绑定并进入加油车队列", async ({ page }) => {
  const errors = [];
  const blocked = [];
  const alerts = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => { alerts.push(dialog.message()); await dialog.accept(); });
  await page.addInitScript(() => {
    if (localStorage.getItem("TEST-FUEL-REQUEST-SETUP") === "done") return;
    localStorage.clear();
    sessionStorage.clear();
    const driverId = "TEST-FUEL-REQUEST-DRIVER";
    const date = new Date().toISOString().slice(0, 10);
    localStorage.setItem("personnelRecords", JSON.stringify([{
      personId: driverId, employeeNo: driverId, name: "TEST汽车司机", position: "汽车司机", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true
    }]));
    localStorage.setItem("currentPersonId", driverId);
    localStorage.setItem("selectedPosition", "汽车司机");
    localStorage.setItem("dispatchPublishedTasks", JSON.stringify([{
      taskId: "TEST-FUEL-REQUEST-TASK", status: "active", shiftDate: date, updatedAt: new Date().toISOString(),
      driverAssignments: [{ driverId, driverName: "TEST汽车司机", equipmentNumber: "TEST-FUEL-TRUCK-01", equipmentType: "矿卡" }], testFixture: true
    }]));
    localStorage.setItem("dispatchShiftExecutions", "[]");
    localStorage.setItem("fuelRequests", "[]");
    localStorage.setItem("fuelRecords", "[]");
    localStorage.setItem("fuelStationConfig", JSON.stringify({ latitude: null, longitude: null, radius: 50, fuelTruckNumber: "TEST-FUEL-TRUCK" }));
    localStorage.setItem("fuelRequestDraft", "{}");
    localStorage.setItem("fuelRequestManualPerson", "null");
    localStorage.setItem("TEST-FUEL-REQUEST-SETUP", "done");
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

  await page.goto(`${ORIGIN}/fuel-request.html`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#personName")).toHaveText("TEST汽车司机");
  await expect(page.locator("#equipmentType")).toHaveValue("矿卡");
  await expect(page.locator("#equipmentNumber")).toHaveValue("TEST-FUEL-TRUCK-01");
  const submit = page.locator("#submitRequestButton");
  await expect(submit).toBeDisabled();
  await page.getByRole("button", { name: "测试离开范围" }).click();
  await expect(submit).toBeDisabled();
  await page.evaluate(() => window.submitFuelRequest());
  await expect.poll(() => alerts.length).toBe(1);
  expect(alerts[0]).toContain("不在加油车加油范围");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fuelRequests") || "[]"))).toHaveLength(0);

  await page.getByRole("button", { name: "测试进入范围" }).click();
  await expect(submit).toBeEnabled();
  await page.locator("#requestRemark").fill("TEST生产作业加油");
  await submit.click();
  await expect.poll(() => alerts.length).toBe(2);
  let requests = await page.evaluate(() => JSON.parse(localStorage.getItem("fuelRequests") || "[]"));
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ applicantId: "TEST-FUEL-REQUEST-DRIVER", equipmentType: "矿卡", equipmentNumber: "TEST-FUEL-TRUCK-01", vehicleNumber: "TEST-FUEL-TRUCK-01", status: "waiting", gpsStatus: "范围内", fuelTruckNumber: "TEST-FUEL-TRUCK", shiftDate: new Date().toISOString().slice(0, 10), remark: "TEST生产作业加油" });

  await page.getByRole("button", { name: "测试进入范围" }).click();
  await submit.click();
  await expect.poll(() => alerts.length).toBe(3);
  expect(alerts[2]).toContain("已有正在处理的加油申请");
  requests = await page.evaluate(() => JSON.parse(localStorage.getItem("fuelRequests") || "[]"));
  expect(requests).toHaveLength(1);

  await page.evaluate(() => { localStorage.setItem("currentPersonId", "TEST-FUEL-OPERATOR"); localStorage.setItem("selectedPosition", "加油车司机"); });
  await page.goto(`${ORIGIN}/fuel.html`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-page="fueling"]').click();
  await expect(page.locator("#fuelQueueList")).toContainText("TEST-FUEL-TRUCK-01");
  await expect(page.locator("#fuelQueueList")).toContainText("TEST汽车司机");
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

