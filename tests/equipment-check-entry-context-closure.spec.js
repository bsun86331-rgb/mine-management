"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

async function installPage(page, identity, extra = {}) {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    const url = new URL(request.url());
    if (!["GET", "HEAD"].includes(request.method()) || url.origin !== ORIGIN) {
      blocked.push(`${request.method()} ${request.url()}`);
    }
  });
  page.on("dialog", dialog => dialog.accept());
  await page.addInitScript(({ identity, extra }) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("personnelRecords", JSON.stringify([{
      personId: identity.id,
      employeeId: identity.id,
      employeeNo: identity.id,
      name: identity.name,
      position: identity.position,
      team: identity.team || "生产A组",
      status: "approved",
      approvalStatus: "approved",
      personnelStatus: "在职可用",
      enabled: true,
      testFixture: true
    }]));
    localStorage.setItem("currentPersonId", identity.id);
    localStorage.setItem("selectedPosition", identity.position);
    for (const [key, value] of Object.entries(extra)) {
      localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    }
  }, { identity, extra });

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
      return route.fulfill({ status: 404, body: "missing TEST asset" });
    }
  });
  return { errors, blocked };
}

async function openEquipmentCheck(page, source, errors, blocked) {
  await page.goto(`${ORIGIN}/${source}`, { waitUntil: "domcontentloaded" });
  const entry = source === "driver-work.html"
    ? page.locator("#equipmentCheckButton")
    : page.locator('button[onclick*="equipment-check.html"]').first();
  await expect(entry).toBeVisible();
  await entry.click();
  await expect(page).toHaveURL(/\/equipment-check\.html(?:\?|$)/);
  await expect(page.locator("#contextBadge")).toContainText("已识别使用人");
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
}

function testTask(id, assignment) {
  return [{
    taskId: "TEST-CHECK-TASK-001",
    status: "active",
    currentShiftId: "TEST-CHECK-SHIFT-001",
    shiftId: "TEST-CHECK-SHIFT-001",
    shift: "白班",
    shiftDate: "2026-10-16",
    team: "生产A组",
    ...assignment
  }];
}

test("TEST挖机端入口将挖机司机、班次和小时数检查上下文带入", async ({ page }) => {
  const identity = { id: "TEST-CHECK-EX-DRIVER", name: "TEST挖机司机", position: "挖机司机" };
  const extra = {
    dispatchPublishedTasks: testTask(identity.id, {
      bindings: [{ excavatorDriverId: identity.id, excavatorDriverName: identity.name, excavatorNumber: "TEST-EX-01" }]
    }),
    dispatchShiftExecutions: []
  };
  const state = await installPage(page, identity, extra);
  await openEquipmentCheck(page, "excavator.html", state.errors, state.blocked);
  await expect(page.locator("#personName")).toHaveValue(identity.name);
  await expect(page.locator("#position")).toHaveValue("挖机司机");
  await expect(page.locator("#modeBadge")).toHaveText("班次接班检查");
  await expect(page.locator("#taskId")).toHaveValue("TEST-CHECK-TASK-001");
  await expect(page.locator("#shiftId")).toHaveValue("TEST-CHECK-SHIFT-001");
  await expect(page.locator("#equipmentSelect")).toHaveValue("0");
  await expect(page.locator("#equipmentSelect option:checked")).toContainText("TEST-EX-01");
  await expect(page.locator("#meterBadge")).toContainText("挖机 · 小时数");
});

test("TEST辅助车辆端入口预填本机登记车辆和公里数检查", async ({ page }) => {
  const identity = { id: "TEST-CHECK-AUX-DRIVER", name: "TEST洒水车司机", position: "洒水车司机" };
  const state = await installPage(page, identity, {
    auxiliaryVehicleProfile: { personId: identity.id, vehicleType: "洒水车", vehicleNumber: "TEST-WATER-01" }
  });
  await openEquipmentCheck(page, "auxiliary.html", state.errors, state.blocked);
  await expect(page.locator("#personName")).toHaveValue(identity.name);
  await expect(page.locator("#position")).toHaveValue("洒水车司机");
  await expect(page.locator("#modeBadge")).toHaveText("用车前检查");
  await expect(page.locator("#manualVehicleType")).toHaveValue("洒水车");
  await expect(page.locator("#manualVehicleNumber")).toHaveValue("TEST-WATER-01");
  await expect(page.locator("#meterBadge")).toContainText("车辆 · 公里数");
});

test("TEST加油端入口预填加油车辆并保留当前使用人", async ({ page }) => {
  const identity = { id: "TEST-CHECK-FUEL-DRIVER", name: "TEST加油车司机", position: "加油车司机" };
  const state = await installPage(page, identity, {
    auxiliaryVehicleProfile: { personId: identity.id, vehicleType: "加油车", vehicleNumber: "TEST-FUEL-01" }
  });
  await openEquipmentCheck(page, "fuel.html", state.errors, state.blocked);
  await expect(page.locator("#personName")).toHaveValue(identity.name);
  await expect(page.locator("#position")).toHaveValue("加油车司机");
  await expect(page.locator("#manualVehicleType")).toHaveValue("加油车");
  await expect(page.locator("#manualVehicleNumber")).toHaveValue("TEST-FUEL-01");
});

test("TEST维修员工作端入口带入当前使用人", async ({ page }) => {
  const identity = { id: "TEST-CHECK-WORKER", name: "TEST维修员", position: "维修员" };
  const state = await installPage(page, identity);
  await openEquipmentCheck(page, "maintenance-worker.html", state.errors, state.blocked);
  await expect(page.locator("#personName")).toHaveValue(identity.name);
  await expect(page.locator("#position")).toHaveValue(identity.position);
  await expect(page.locator("#modeBadge")).toHaveText("用车前检查");
});

test("TEST维修管理端入口带入当前使用人", async ({ page }) => {
  const identity = { id: "TEST-CHECK-MANAGER", name: "TEST维修管理", position: "维修管理" };
  const state = await installPage(page, identity);
  await openEquipmentCheck(page, "maintenance.html", state.errors, state.blocked);
  await expect(page.locator("#personName")).toHaveValue(identity.name);
  await expect(page.locator("#position")).toHaveValue(identity.position);
  await expect(page.locator("#modeBadge")).toHaveText("用车前检查");
});
