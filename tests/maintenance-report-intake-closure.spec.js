const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST司机统一维修上报保存工单、锁定设备并拦截重复申请", async ({ page }) => {
  const errors = [];
  const blocked = [];
  const dialogs = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
  await page.addInitScript(() => {
    if (localStorage.getItem("TEST-REPORT-SETUP") === "done") return;
    localStorage.clear();
    sessionStorage.clear();
    const person = { personId: "TEST-REPORT-DRIVER", employeeNo: "TEST-REPORT-DRIVER", name: "TEST报修司机", position: "汽车司机", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用" };
    const dispatch = { personId: "TEST-REPORT-DISPATCH", employeeNo: "TEST-REPORT-DISPATCH", name: "TEST调度", position: "车队长", team: "管理组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用" };
    const manager = { personId: "TEST-REPORT-MANAGER", employeeNo: "TEST-REPORT-MANAGER", name: "TEST维修管理", position: "维修管理", team: "维修组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用" };
    const worker = { personId: "TEST-REPORT-WORKER", employeeNo: "TEST-REPORT-WORKER", name: "维修工01", position: "维修员", team: "维修组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用" };
    localStorage.setItem("personnelRecords", JSON.stringify([person, dispatch, manager, worker]));
    localStorage.setItem("currentPersonId", person.personId);
    localStorage.setItem("selectedPosition", person.position);
    localStorage.setItem("equipmentRecords", JSON.stringify([{ equipmentId: "TEST-REPORT-TRUCK", equipmentNumber: "TEST-REPORT-TRUCK", equipmentType: "汽车", status: "standby" }]));
    localStorage.setItem("maintenanceRequests", "[]");
    localStorage.setItem("equipmentOperationalStatus", JSON.stringify([{ equipmentId: "TEST-REPORT-TRUCK", status: "standby", testFixture: true }]));
    localStorage.setItem("driverVehicleChangeRequests", JSON.stringify([{ requestId: "TEST-REPORT-LEGACY", status: "pending" }]));
    localStorage.setItem("workshopBays", JSON.stringify([{ bayId: "TEST-REPORT-BAY", name: "TEST维修工位", status: "free" }]));
    localStorage.setItem("maintenanceWorkOrders", "[]");
    localStorage.setItem("TEST-REPORT-SETUP", "done");
  });
  await page.route("**/*", async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (!["GET", "HEAD"].includes(req.method()) || url.origin !== ORIGIN) {
      blocked.push(req.method() + " " + req.url());
      return route.abort();
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const body = await fs.readFile(file);
      const ext = path.extname(file).toLowerCase();
      const type = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType: type, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  await page.goto(ORIGIN + "/driver-work.html", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("driverCurrentTask", JSON.stringify({ taskId: "TEST-REPORT-TASK", shiftId: "TEST-REPORT-SHIFT", vehicleNumber: "TEST-REPORT-TRUCK", equipmentType: "汽车" })));
  await page.getByRole("button", { name: /设备异常上报/ }).click();
  await expect(page).toHaveURL(/maintenance-report\.html$/);
  await expect(page.locator("#reporterName")).toHaveText("TEST报修司机");
  await expect(page.locator("#currentTaskText")).toHaveText("TEST-REPORT-TASK");
  await expect(page.locator("#equipmentType")).toHaveValue("汽车");
  await expect(page.locator("#equipmentNumber")).toHaveValue("TEST-REPORT-TRUCK");

  await page.locator("#faultType").fill("TEST刹车故障");
  await page.locator("#description").fill("TEST刹车制动异常，停止运行");
  await page.locator("#canMove").selectOption("false");
  await page.locator("#submitButton").click();
  await expect(page).toHaveURL(/driver-work\.html$/);

  let state = await page.evaluate(() => ({
    requests: JSON.parse(localStorage.getItem("maintenanceRequests") || "[]"),
    operational: JSON.parse(localStorage.getItem("equipmentOperationalStatus") || "[]"),
    legacy: JSON.parse(localStorage.getItem("driverVehicleChangeRequests") || "[]")
  }));
  expect(state.requests).toHaveLength(1);
  expect(state.requests[0]).toMatchObject({ applicantId: "TEST-REPORT-DRIVER", taskId: "TEST-REPORT-TASK", shiftId: "TEST-REPORT-SHIFT", equipmentType: "汽车", equipmentNumber: "TEST-REPORT-TRUCK", previousEquipmentStatus: "standby", status: "pending_dispatch", dispatchRequired: true, dispatchStatus: "pending", productionReleased: false, canMove: false });
  expect(state.operational).toContainEqual(expect.objectContaining({ equipmentId: "TEST-REPORT-TRUCK", status: "maintenance", previousStatus: "standby", source: "maintenance_request" }));
  expect(state.legacy).toContainEqual(expect.objectContaining({ requestId: "TEST-REPORT-LEGACY", status: "legacy_cancelled" }));
  expect(dialogs[0]).toContain("维修申请已提交");

  await page.goto(ORIGIN + "/maintenance-report.html", { waitUntil: "domcontentloaded" });
  await page.locator("#equipmentNumber").fill("TEST-REPORT-TRUCK");
  await page.locator("#faultType").fill("TEST再次报修");
  await page.locator("#description").fill("TEST重复故障申请");
  await page.locator("#submitButton").click();
  await expect.poll(() => dialogs.length).toBe(2);
  expect(dialogs[1]).toContain("未结束的维修流程");
  state = await page.evaluate(() => ({
    requests: JSON.parse(localStorage.getItem("maintenanceRequests") || "[]"),
    operational: JSON.parse(localStorage.getItem("equipmentOperationalStatus") || "[]")
  }));
  expect(state.requests).toHaveLength(1);
  expect(state.operational.filter(row => row.equipmentId === "TEST-REPORT-TRUCK")).toHaveLength(1);
  const submittedRequestId = state.requests[0].requestId;
  await page.evaluate(() => {
    localStorage.setItem("currentPersonId", "TEST-REPORT-DISPATCH");
    localStorage.setItem("dispatchPersonId", "TEST-REPORT-DISPATCH");
    localStorage.setItem("selectedPosition", "车队长");
    const roles = JSON.parse(localStorage.getItem("rolePersonIds") || "{}");
    roles["车队长"] = "TEST-REPORT-DISPATCH";
    localStorage.setItem("rolePersonIds", JSON.stringify(roles));
  });
  await page.goto(ORIGIN + "/dispatch.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#maintenanceReviewTodoCount")).toHaveText("1");
  await page.locator("#openMaintenanceReviewButton").click();
  await expect(page.locator("#maintenanceReviewList")).toContainText("TEST-REPORT-TRUCK");
  await page.getByRole("button", { name: "✅ 批准进厂" }).click();
  state = await page.evaluate(() => JSON.parse(localStorage.getItem("maintenanceRequests") || "[]"));
  expect(state.find(row => row.requestId === submittedRequestId)).toMatchObject({ status: "waiting_entry", dispatchStatus: "approved" });

  await page.evaluate(() => {
    localStorage.setItem("currentPersonId", "TEST-REPORT-MANAGER");
    localStorage.setItem("selectedPosition", "维修管理");
  });
  await page.goto(ORIGIN + "/maintenance.html", { waitUntil: "domcontentloaded" });
  await page.locator('[data-page="waiting"]').click();
  await expect(page.locator("#waitingWorkshopList")).toContainText("TEST-REPORT-TRUCK");
  await page.locator("#waitingWorkshopList").getByRole("button", { name: "确认车辆已进厂" }).click();
  state = await page.evaluate(() => JSON.parse(localStorage.getItem("maintenanceRequests") || "[]"));
  expect(state.find(row => row.requestId === submittedRequestId).status).toBe("waiting_assignment");
  await page.locator("#assignmentList").getByRole("button", { name: "分配工位 / 维修工" }).click();
  await page.locator("#assignmentBay").selectOption("TEST-REPORT-BAY");
  await page.locator("#assignmentWorker").selectOption("维修工01");
  await page.locator("#assignmentProject").fill("TEST刹车检查维修");
  await page.getByRole("button", { name: "确认派工" }).click();
  const orders = await page.evaluate(() => JSON.parse(localStorage.getItem("maintenanceWorkOrders") || "[]"));
  expect(orders).toHaveLength(1);
  expect(orders[0]).toMatchObject({ requestId: submittedRequestId, equipmentNumber: "TEST-REPORT-TRUCK", bayId: "TEST-REPORT-BAY", workerName: "维修工01", status: "assigned" });
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

