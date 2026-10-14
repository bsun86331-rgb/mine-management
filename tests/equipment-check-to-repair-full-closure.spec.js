"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGk0AAAAASUVORK5CYII=", "base64");

test("TEST设备使用前异常检查到维修申请、派工和验收完整闭环", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", dialog => dialog.accept());

  await page.addInitScript(() => {
    if (localStorage.getItem("TEST-REPAIR-FULL-SETUP")) return;
    const people = [
      { personId: "TEST-REPAIR-FULL-DRIVER", employeeId: "TEST-REPAIR-FULL-DRIVER", employeeNo: "TEST-REPAIR-FULL-DRIVER", name: "TEST检查司机", position: "汽车司机", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用" },
      { personId: "TEST-REPAIR-FULL-DISPATCH", employeeId: "TEST-REPAIR-FULL-DISPATCH", employeeNo: "TEST-REPAIR-FULL-DISPATCH", name: "TEST调度", position: "车队长", team: "管理组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用" },
      { personId: "TEST-REPAIR-FULL-MANAGER", employeeId: "TEST-REPAIR-FULL-MANAGER", employeeNo: "TEST-REPAIR-FULL-MANAGER", name: "TEST维修管理", position: "维修管理", team: "维修组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用" },
      { personId: "TEST-REPAIR-FULL-WORKER", employeeId: "TEST-REPAIR-FULL-WORKER", employeeNo: "TEST-REPAIR-FULL-WORKER", name: "维修工01", position: "维修员", team: "维修组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用" }
    ];
    localStorage.setItem("personnelRecords", JSON.stringify(people));
    localStorage.setItem("currentPersonId", "TEST-REPAIR-FULL-DRIVER");
    localStorage.setItem("selectedPosition", "汽车司机");
    localStorage.setItem("equipmentMaintenanceSettings", JSON.stringify([{ equipmentId: "TEST-REPAIR-FULL-PICKUP", lastMaintenanceReading: 100, maintenanceInterval: 50, warningAdvance: 10 }]));
    localStorage.setItem("equipmentRecords", JSON.stringify([{ equipmentId: "TEST-REPAIR-FULL-PICKUP", equipmentNumber: "TEST-REPAIR-FULL-PICKUP", vehicleNumber: "TEST-REPAIR-FULL-PICKUP", equipmentType: "皮卡", status: "active" }]));
    localStorage.setItem("workshopBays", JSON.stringify([{ bayId: "TEST-REPAIR-FULL-BAY", name: "TEST工位", status: "free" }]));
    localStorage.setItem("maintenanceRequests", "[]");
    localStorage.setItem("maintenanceWorkOrders", "[]");
    localStorage.setItem("maintenanceCosts", "[]");
    localStorage.setItem("TEST-REPAIR-FULL-SETUP", "done");
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
      const ext = path.extname(file);
      const contentType = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  // Driver completes a documented abnormal pre-use check.
  await page.goto(`${ORIGIN}/equipment-check.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => setMode("usage"));
  await page.getByRole("button", { name: /② 当前人员与设备/ }).click();
  await page.getByRole("button", { name: /③ 设备读数/ }).click();
  await page.locator("#manualVehicleType").selectOption("皮卡");
  await page.locator("#manualVehicleNumber").fill("TEST-REPAIR-FULL-PICKUP");
  await page.locator("#usagePurpose").fill("TEST夜班巡检");
  await page.locator("#meterReading").fill("145");
  await page.locator("#meterPhotoInput").setInputFiles({ name: "meter.png", mimeType: "image/png", buffer: PNG });
  await page.waitForFunction(() => typeof meterPhoto === "string" && meterPhoto.length > 0);
  await page.locator("#badBox").click();
  await page.getByRole("button", { name: /⑤ 异常情况/ }).click();
  await page.locator("#abnormalDescription").fill("TEST刹车异常");
  await page.locator("#abnormalPhotoInput").setInputFiles({ name: "abnormal.png", mimeType: "image/png", buffer: PNG });
  await page.waitForFunction(() => Array.isArray(abPhotos) && abPhotos.length > 0);
  await page.getByRole("button", { name: "✅ 提交并锁定" }).click();
  let state = await page.evaluate(() => ({
    checks: JSON.parse(localStorage.getItem("equipmentUsageChecks") || "[]"),
    requests: JSON.parse(localStorage.getItem("maintenanceRequests") || "[]"),
    usage: JSON.parse(localStorage.getItem("equipmentUsageRecords") || "[]")
  }));
  expect(state.checks).toHaveLength(1);
  expect(state.requests).toHaveLength(1);
  expect(state.requests[0]).toMatchObject({ source: "equipment_usage_check", status: "pending_dispatch", dispatchRequired: true, equipmentId: "TEST-REPAIR-FULL-PICKUP", description: "TEST刹车异常" });
  const generatedRequestId = state.requests[0].requestId;
  expect(generatedRequestId).toBeTruthy();

  // Dispatch approves the same request generated by the inspection.
  await page.evaluate(() => {
    localStorage.setItem("currentPersonId", "TEST-REPAIR-FULL-DISPATCH");
    localStorage.setItem("dispatchPersonId", "TEST-REPAIR-FULL-DISPATCH");
    localStorage.setItem("selectedPosition", "车队长");
    const roles = JSON.parse(localStorage.getItem("rolePersonIds") || "{}");
    roles["车队长"] = "TEST-REPAIR-FULL-DISPATCH";
    localStorage.setItem("rolePersonIds", JSON.stringify(roles));
  });
  await page.goto(`${ORIGIN}/dispatch.html`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#maintenanceReviewTodoCount")).toHaveText("1");
  await page.locator("#openMaintenanceReviewButton").click();
  await expect(page.locator("#maintenanceReviewList")).toContainText("TEST-REPAIR-FULL-PICKUP");
  await page.getByRole("button", { name: "✅ 批准进厂" }).click();
  state = await page.evaluate(() => JSON.parse(localStorage.getItem("maintenanceRequests") || "[]"));
  expect(state.find(row => row.requestId === generatedRequestId)).toMatchObject({ status: "waiting_entry", dispatchStatus: "approved" });

  // Workshop manager receives the approved vehicle and assigns bay/worker.
  await page.evaluate(() => { localStorage.setItem("currentPersonId", "TEST-REPAIR-FULL-MANAGER"); localStorage.setItem("selectedPosition", "维修管理"); });
  await page.goto(`${ORIGIN}/maintenance.html`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-page="waiting"]').click();
  await expect(page.locator("#waitingWorkshopList")).toContainText("TEST-REPAIR-FULL-PICKUP");
  await page.locator("#waitingWorkshopList").getByRole("button", { name: "确认车辆已进厂" }).click();
  state = await page.evaluate(() => JSON.parse(localStorage.getItem("maintenanceRequests") || "[]"));
  expect(state.find(row => row.requestId === generatedRequestId).status).toBe("waiting_assignment");
  await page.locator("#assignmentList").getByRole("button", { name: "分配工位 / 维修工" }).click();
  await page.locator("#assignmentBay").selectOption("TEST-REPAIR-FULL-BAY");
  await page.locator("#assignmentWorker").selectOption("维修工01");
  await page.locator("#assignmentProject").fill("TEST维修刹车系统");
  await page.getByRole("button", { name: "确认派工" }).click();
  let orders = await page.evaluate(() => JSON.parse(localStorage.getItem("maintenanceWorkOrders") || "[]"));
  expect(orders).toHaveLength(1);
  expect(orders[0]).toMatchObject({ requestId: generatedRequestId, equipmentNumber: "TEST-REPAIR-FULL-PICKUP", bayId: "TEST-REPAIR-FULL-BAY", workerName: "维修工01", status: "assigned" });
  console.log("TEST full repair assigned order:", JSON.stringify(orders[0]));

  // Worker documents before/after photos and submits the same job for acceptance.
  await page.evaluate(() => { localStorage.setItem("currentPersonId", "TEST-REPAIR-FULL-WORKER"); localStorage.setItem("selectedPosition", "维修员"); });
  await page.goto(`${ORIGIN}/maintenance-worker.html`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#assignedTaskList")).toContainText("TEST-REPAIR-FULL-PICKUP");
  await page.locator("#assignedTaskList").getByRole("button", { name: "接车 / 开始维修" }).click();
  await page.locator("#beforePhotoInput").setInputFiles({ name: "before.png", mimeType: "image/png", buffer: PNG });
  await page.waitForFunction(() => typeof pendingBeforePhoto === "string" && pendingBeforePhoto.length > 0);
  await page.getByRole("button", { name: "▶ 拍照后开始维修" }).click();
  await page.locator("#faultCause").fill("TEST刹车片磨损");
  await page.locator("#repairProcess").fill("TEST检查并更换刹车片");
  await page.locator("#actualRepairContent").fill("TEST更换刹车片并试车");
  await page.locator("#partsUsed").fill("TEST刹车片1套");
  await page.locator("#afterPhotoInput").setInputFiles({ name: "after.png", mimeType: "image/png", buffer: PNG });
  await page.waitForFunction(() => typeof pendingAfterPhoto === "string" && pendingAfterPhoto.length > 0);
  await page.getByRole("button", { name: "✅ 完成维修并提交验收" }).click();
  orders = await page.evaluate(() => JSON.parse(localStorage.getItem("maintenanceWorkOrders") || "[]"));
  expect(orders[0]).toMatchObject({ status: "waiting_inspection", faultCause: "TEST刹车片磨损", repairResult: "TEST更换刹车片并试车" });

  // Manager accepts, closes costs, and frees the same bay.
  await page.evaluate(() => { localStorage.setItem("currentPersonId", "TEST-REPAIR-FULL-MANAGER"); localStorage.setItem("selectedPosition", "维修管理"); });
  await page.goto(`${ORIGIN}/maintenance.html`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-page="inspection"]').click();
  await expect(page.locator("#inspectionList")).toContainText("TEST-REPAIR-FULL-PICKUP");
  await page.locator("#inspectionList").getByRole("button", { name: "维修验收" }).click();
  await page.getByRole("button", { name: /验收通过/ }).click();
  await expect(page.locator("#costModal")).toBeVisible();
  await page.locator("#laborCost").fill("100");
  await page.locator("#partsCost").fill("20");
  await page.locator("#partsDescription").fill("TEST刹车片1套");
  await page.getByRole("button", { name: "保存维修费用单" }).click();
  orders = await page.evaluate(() => JSON.parse(localStorage.getItem("maintenanceWorkOrders") || "[]"));
  state = await page.evaluate(requestId => ({
    request: JSON.parse(localStorage.getItem("maintenanceRequests") || "[]").find(row => row.requestId === requestId),
    costs: JSON.parse(localStorage.getItem("maintenanceCosts") || "[]"),
    bay: JSON.parse(localStorage.getItem("workshopBays") || "[]").find(row => row.bayId === "TEST-REPAIR-FULL-BAY")
  }), generatedRequestId);
  expect(orders[0]).toMatchObject({ status: "completed", requestId: generatedRequestId, beforePhotoData: expect.stringContaining("data:image/"), afterPhotoData: expect.stringContaining("data:image/") });
  expect(state.request.status).toBe("completed");
  expect(state.costs).toHaveLength(1);
  expect(state.costs[0]).toMatchObject({ totalCost: 120, orderId: orders[0].orderId });
  expect(orders[0].orderId).toBeTruthy();
  expect(state.costs[0].costId).toBeTruthy();
  expect(state.bay.status).toBe("free");
  await page.screenshot({ path: "C:/Users/Administrator/Documents/Codex/2026-10-11/new-chat/outputs/证据_设备检查至维修验收闭环_2026-10-14.png", fullPage: true });
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

