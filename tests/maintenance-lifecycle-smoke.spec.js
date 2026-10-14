"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGk0AAAAASUVORK5CYII=", "base64");

test("TEST 设备异常维修申请从调度审批闭环到维修验收", async ({ page }) => {
  const pageErrors = [];
  const blocked = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.addInitScript(() => {
    if (!location.pathname.endsWith("/dispatch.html")) return;
    const people = [
      { personId: "TEST-DISPATCH-REPAIR-001", employeeId: "TEST-DISPATCH-REPAIR-001", employeeNo: "TEST-DISPATCH-REPAIR-001", name: "TEST调度", position: "车队长", team: "管理组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true },
      { personId: "TEST-MANAGER-REPAIR-001", employeeId: "TEST-MANAGER-REPAIR-001", employeeNo: "TEST-MANAGER-REPAIR-001", name: "TEST维修管理", position: "维修管理", team: "维修组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true },
      { personId: "TEST-WORKER-REPAIR-001", employeeId: "TEST-WORKER-REPAIR-001", employeeNo: "TEST-WORKER-REPAIR-001", name: "维修工01", position: "维修员", team: "维修组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true }
    ];
    localStorage.setItem("personnelRecords", JSON.stringify(people));
    localStorage.setItem("currentPersonId", "TEST-DISPATCH-REPAIR-001");
    localStorage.setItem("selectedPosition", "车队长");
    localStorage.setItem("maintenanceRequests", JSON.stringify([{
      requestId: "TEST-REPAIR-REQ-001", maintenanceRequestId: "TEST-REPAIR-REQ-001", source: "equipment_usage_check",
      equipmentId: "TEST-PK-REPAIR-01", equipmentNumber: "TEST-PK-REPAIR-01", equipmentType: "皮卡",
      reportedById: "TEST-DRIVER-REPAIR-001", reportedByName: "TEST司机", applicantName: "TEST司机",
      status: "pending_dispatch", dispatchStatus: "pending", dispatchRequired: true, maintenanceType: "故障维修",
      description: "TEST刹车异常", createdAt: new Date().toISOString(), testFixture: true
    }]));
    localStorage.setItem("workshopBays", JSON.stringify([{ bayId: "TEST-BAY-01", name: "TEST工位1", status: "free", testFixture: true }]));
    localStorage.setItem("maintenanceWorkOrders", JSON.stringify([]));
  });
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
      const contentType = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });
  page.on("dialog", async dialog => { if (dialog.type() === "confirm") await dialog.accept(); else await dialog.accept(); });

  await page.goto(`${ORIGIN}/dispatch.html`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#maintenanceReviewTodoCount")).toHaveText("1");
  await page.locator("#openMaintenanceReviewButton").click();
  await expect(page.locator("#maintenanceReviewList")).toContainText("TEST-PK-REPAIR-01");
  await page.getByRole("button", { name: "✅ 批准进厂" }).click();
  let request = await page.evaluate(() => JSON.parse(localStorage.getItem("maintenanceRequests"))[0]);
  expect(request).toMatchObject({ status: "waiting_entry", dispatchStatus: "approved" });

  await page.evaluate(() => { localStorage.setItem("currentPersonId", "TEST-MANAGER-REPAIR-001"); localStorage.setItem("selectedPosition", "维修管理"); });
  await page.goto(`${ORIGIN}/maintenance.html`, { waitUntil: "domcontentloaded" });
  console.log("MAINTENANCE PAGE", await page.evaluate(() => ({ href: location.href, text: document.body.innerText.slice(0, 250), current: localStorage.getItem("currentPersonId"), people: localStorage.getItem("personnelRecords") })));
  await page.locator('[data-page="waiting"]').click();
  await expect(page.locator("#waitingWorkshopList")).toContainText("TEST-PK-REPAIR-01");
  await page.locator("#waitingWorkshopList").getByRole("button", { name: "确认车辆已进厂" }).click();
  request = await page.evaluate(() => JSON.parse(localStorage.getItem("maintenanceRequests"))[0]);
  expect(request.status).toBe("waiting_assignment");
  await expect(page.locator("#assignmentList")).toContainText("TEST-PK-REPAIR-01");
  await page.locator("#assignmentList").getByRole("button", { name: "分配工位 / 维修工" }).click();
  await page.locator("#assignmentBay").selectOption("TEST-BAY-01");
  await page.locator("#assignmentWorker").selectOption("维修工01");
  await page.locator("#assignmentProject").fill("TEST检查刹车系统并修复");
  await page.getByRole("button", { name: "确认派工" }).click();
  let orders = await page.evaluate(() => JSON.parse(localStorage.getItem("maintenanceWorkOrders")));
  expect(orders).toHaveLength(1);
  expect(orders[0]).toMatchObject({ requestId: "TEST-REPAIR-REQ-001", equipmentNumber: "TEST-PK-REPAIR-01", bayId: "TEST-BAY-01", workerName: "维修工01", status: "assigned" });

  await page.evaluate(() => { localStorage.setItem("currentPersonId", "TEST-WORKER-REPAIR-001"); localStorage.setItem("selectedPosition", "维修员"); });
  await page.goto(`${ORIGIN}/maintenance-worker.html`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#assignedTaskList")).toContainText("TEST-PK-REPAIR-01");
  await page.locator("#assignedTaskList").getByRole("button", { name: "接车 / 开始维修" }).click();
  await page.locator("#beforePhotoInput").setInputFiles({ name: "before.png", mimeType: "image/png", buffer: PNG });
  await page.waitForFunction(() => typeof pendingBeforePhoto === "string" && pendingBeforePhoto.length > 0);
  await page.getByRole("button", { name: "▶ 拍照后开始维修" }).click();
  orders = await page.evaluate(() => JSON.parse(localStorage.getItem("maintenanceWorkOrders")));
  expect(orders[0].status).toBe("working");
  await page.locator("#faultCause").fill("TEST刹车片磨损");
  await page.locator("#repairProcess").fill("TEST检查并更换刹车片");
  await page.locator("#actualRepairContent").fill("TEST更换前后刹车片并试车");
  await page.locator("#partsUsed").fill("TEST刹车片1套");
  await page.locator("#afterPhotoInput").setInputFiles({ name: "after.png", mimeType: "image/png", buffer: PNG });
  await page.waitForFunction(() => typeof pendingAfterPhoto === "string" && pendingAfterPhoto.length > 0);
  await page.getByRole("button", { name: "✅ 完成维修并提交验收" }).click();
  orders = await page.evaluate(() => JSON.parse(localStorage.getItem("maintenanceWorkOrders")));
  expect(orders[0]).toMatchObject({ status: "waiting_inspection", faultCause: "TEST刹车片磨损", repairResult: "TEST更换前后刹车片并试车" });

  await page.evaluate(() => { localStorage.setItem("currentPersonId", "TEST-MANAGER-REPAIR-001"); localStorage.setItem("selectedPosition", "维修管理"); });
  await page.goto(`${ORIGIN}/maintenance.html`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-page="inspection"]').click();
  await expect(page.locator("#inspectionList")).toContainText("TEST-PK-REPAIR-01");
  await page.locator("#inspectionList").getByRole("button", { name: "维修验收" }).click();
  await page.getByRole("button", { name: /验收通过/ }).click();
  await expect(page.locator("#costModal")).toBeVisible();
  await page.locator("#laborCost").fill("100");
  await page.locator("#partsCost").fill("20");
  await page.locator("#partsDescription").fill("TEST刹车片1套");
  await page.getByRole("button", { name: "保存维修费用单" }).click();
  orders = await page.evaluate(() => JSON.parse(localStorage.getItem("maintenanceWorkOrders")));
  expect(orders[0].status).toBe("completed");
  expect(orders[0].beforePhotoData).toContain("data:image/jpeg");
  expect(orders[0].afterPhotoData).toContain("data:image/jpeg");
  request = await page.evaluate(() => JSON.parse(localStorage.getItem("maintenanceRequests"))[0]);
  expect(request.status).toBe("completed");
  const costs = await page.evaluate(() => JSON.parse(localStorage.getItem("maintenanceCosts")));
  expect(costs).toHaveLength(1);
  expect(costs[0].totalCost).toBe(120);
  const bays = await page.evaluate(() => JSON.parse(localStorage.getItem("workshopBays")));
  expect(bays[0]).toMatchObject({ bayId: "TEST-BAY-01", status: "free" });
  expect(pageErrors).toEqual([]);
  expect(blocked).toEqual([]);
});
