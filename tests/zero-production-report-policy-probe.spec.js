"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST司机的零产量报备是否要求车队长确认", async ({ page, context }) => {
  const errors = [];
  const blocked = [];
  const dialogs = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => {
    dialogs.push(dialog.message());
    if (dialog.type() === "prompt") await dialog.accept("TEST请补充维修工单编号");
    else await dialog.accept();
  });
  await page.addInitScript(() => {
    if (!localStorage.getItem("personnelRecords")) {
      localStorage.setItem("personnelRecords", JSON.stringify([
        { personId: "TEST-ZERO-001", employeeNo: "TEST-ZERO-001", name: "TEST汽车司机", position: "汽车司机", status: "approved", approvalStatus: "approved", department: "生产A组" },
        { personId: "TEST-ZERO-DISPATCH-001", employeeNo: "TEST-ZERO-DISPATCH-001", name: "TEST车队长", position: "车队长", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用" }
      ]));
      localStorage.setItem("currentPersonId", "TEST-ZERO-001");
      localStorage.setItem("selectedPosition", "汽车司机");
      localStorage.setItem("attendanceGeofenceConfig", JSON.stringify({ enabled: false, radiusMeters: 100, maxAccuracyMeters: 50, name: "TEST不限制围栏" }));
      localStorage.setItem("attendanceRecords", "[]");
      localStorage.setItem("attendanceGeofenceAttempts", "[]");
      localStorage.setItem("zeroProductionReports", "[]");
      localStorage.setItem("tripRecords", "[]");
      localStorage.setItem("driverTripRecords", "[]");
      localStorage.setItem("dispatchShiftExecutions", "[]");
      localStorage.setItem("dispatchPublishedTasks", "[]");
      localStorage.setItem("leaveRequests", "[]");
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
  await context.grantPermissions(["geolocation"], { origin: ORIGIN });
  await context.setGeolocation({ latitude: 47.9, longitude: 106.9, accuracy: 10 });
  await page.goto(`${ORIGIN}/attendance.html`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "上班打卡" }).click();
  await expect.poll(() => dialogs.at(-1)).toContain("上班打卡成功");
  await expect(page.locator("#zeroProductionForm")).toBeVisible();
  await page.locator("#zeroReason").selectOption("设备故障");
  await page.locator("#zeroRemark").fill("TEST设备故障等待维修，无运输趟次");
  await page.getByRole("button", { name: "提交报备" }).click();
  await expect.poll(() => dialogs.at(-1)).toContain("已提交零产量异常，等待车队长 / 调度审核");
  const reports = await page.evaluate(() => JSON.parse(localStorage.getItem("zeroProductionReports") || "[]"));
  expect(reports).toHaveLength(1);
  expect(reports[0]).toMatchObject({ personId: "TEST-ZERO-001", reporterId: "TEST-ZERO-001", reporterName: "TEST汽车司机", status: "pending_review", reason: "设备故障", remark: "TEST设备故障等待维修，无运输趟次" });
  expect(reports[0].approverRole).toBeUndefined();
  await expect(page.locator("#zeroProductionBadge")).toHaveText("待审核");

  await page.addInitScript(() => {
    localStorage.setItem("currentPersonId", "TEST-ZERO-DISPATCH-001");
    localStorage.setItem("selectedPosition", "车队长");
  });
  await page.goto(`${ORIGIN}/dispatch.html`, { waitUntil: "domcontentloaded" });
  await page.locator("#openZeroProductionReviewButton").click();
  await expect(page.locator("#zeroProductionReviewList")).toContainText("TEST汽车司机");
  await page.locator("#zeroProductionReviewList").getByRole("button", { name: "驳回并要求补充" }).click();
  await expect.poll(() => dialogs.at(-1)).toContain("请填写驳回原因");
  let rejected = await page.evaluate(() => JSON.parse(localStorage.getItem("zeroProductionReports") || "[]"));
  expect(rejected[0]).toMatchObject({ status: "rejected", reviewReason: "TEST请补充维修工单编号", reviewedBy: "TEST-ZERO-DISPATCH-001" });

  await page.addInitScript(() => {
    localStorage.setItem("currentPersonId", "TEST-ZERO-001");
    localStorage.setItem("selectedPosition", "汽车司机");
  });
  await page.goto(`${ORIGIN}/attendance.html`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#zeroProductionBadge")).toHaveText("已驳回");
  await expect(page.locator("#zeroProductionResult")).toContainText("TEST请补充维修工单编号");
  await expect(page.locator("#zeroProductionForm")).toBeVisible();
  await expect(page.locator("#zeroRemark")).toHaveValue("TEST设备故障等待维修，无运输趟次");
  await page.locator("#zeroRemark").fill("TEST设备故障等待维修，无运输趟次；维修工单TEST-WO-001");
  const dialogsBeforeResubmit = dialogs.length;
  await page.getByRole("button", { name: "提交报备" }).click();
  await expect.poll(() => dialogs.length).toBeGreaterThan(dialogsBeforeResubmit);
  expect(dialogs.at(-1)).toContain("已提交零产量异常，等待车队长 / 调度审核");
  await expect.poll(() => dialogs.at(-1)).toContain("已提交零产量异常，等待车队长 / 调度审核");
  let resubmitted = await page.evaluate(() => JSON.parse(localStorage.getItem("zeroProductionReports") || "[]"));
  expect(resubmitted).toHaveLength(1);
  expect(resubmitted[0]).toMatchObject({ status: "pending_review", reviewHistory: [{ status: "rejected", reviewReason: "TEST请补充维修工单编号", reviewedBy: "TEST-ZERO-DISPATCH-001" }], remark: "TEST设备故障等待维修，无运输趟次；维修工单TEST-WO-001" });

  await page.addInitScript(() => {
    localStorage.setItem("currentPersonId", "TEST-ZERO-DISPATCH-001");
    localStorage.setItem("selectedPosition", "车队长");
  });
  await page.goto(`${ORIGIN}/dispatch.html`, { waitUntil: "domcontentloaded" });
  await page.locator("#openZeroProductionReviewButton").click();
  await expect(page.locator("#zeroProductionReviewList")).toContainText("维修工单TEST-WO-001");
  await page.locator("#zeroProductionReviewList").getByRole("button", { name: "审核通过" }).click();
  const approved = await page.evaluate(() => JSON.parse(localStorage.getItem("zeroProductionReports") || "[]"));
  expect(approved[0]).toMatchObject({ status: "approved", reviewedBy: "TEST-ZERO-DISPATCH-001", reviewedByName: "TEST车队长", approverRole: "车队长", remark: "TEST设备故障等待维修，无运输趟次；维修工单TEST-WO-001" });
  await page.addInitScript(() => {
    localStorage.setItem("currentPersonId", "TEST-ZERO-001");
    localStorage.setItem("selectedPosition", "汽车司机");
  });
  await page.goto(`${ORIGIN}/attendance.html`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#zeroProductionBadge")).toHaveText("审核通过");
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});


