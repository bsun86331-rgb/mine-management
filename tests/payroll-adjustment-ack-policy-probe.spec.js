"use strict";
const { evidencePath } = require("./evidence-path.cjs");

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST工资汇总探测奖励罚款待确认与已确认状态的纳入情况", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", dialog => dialog.accept());
  await page.addInitScript(() => {
    if (localStorage.getItem("TEST-POLICY-SETUP")) return;
    const month = new Date().toISOString().slice(0, 7);
    const admin = { personId: "TEST-POLICY-ADMIN-001", employeeNo: "TEST-POLICY-ADMIN-001", name: "TEST工资管理员", position: "管理员", status: "approved", approvalStatus: "approved" };
    const worker = { personId: "TEST-POLICY-WORKER-001", employeeNo: "TEST-POLICY-WORKER-001", name: "TEST工资员工", position: "维修员", status: "approved", approvalStatus: "approved" };
    const driver = { personId: "TEST-POLICY-DRIVER-001", employeeNo: "TEST-POLICY-DRIVER-001", name: "TEST汽车司机", position: "汽车司机", status: "approved", approvalStatus: "approved" };
    localStorage.setItem("personnelRecords", JSON.stringify([admin, worker, driver]));
    localStorage.setItem("currentPersonId", admin.personId);
    localStorage.setItem("selectedPosition", "管理员");
    sessionStorage.setItem("managementSession", JSON.stringify({ verified: true, personId: admin.personId, position: "管理员", expiresAt: Date.now() + 600000 }));
    localStorage.setItem("adminAttendanceMonthlyLocks", JSON.stringify([{ lockId: `ADMIN_ATT_LOCK_${month.replaceAll("-", "")}`, month, status: "locked", rows: [admin, worker, driver].map(person => ({ personId: person.personId, employeeNo: person.employeeNo, personName: person.name, finalAttendance: 20, deduction: 0 })) }]));
    localStorage.setItem("payrollStandards", JSON.stringify([
      { standardId: "TEST-POLICY-ADMIN-STANDARD", scope: "person", standardType: "fixed_person", personId: admin.personId, salaryStage: "regular", regularSalary: 1000, probationSalary: 1000, baseSalary: 1000, effectiveDate: "2026-01-01", status: "active" },
      { standardId: "TEST-POLICY-WORKER-STANDARD", scope: "person", standardType: "fixed_person", personId: worker.personId, salaryStage: "regular", regularSalary: 5000, probationSalary: 5000, baseSalary: 5000, effectiveDate: "2026-01-01", status: "active" },
      { standardId: "TEST-POLICY-DRIVER-STANDARD", scope: "position", standardType: "frontline_position", position: "汽车司机", salaryMode: "performance", baseSalary: 1, performanceUnitPrice: 0, effectiveDate: "2026-01-01", status: "active" }
    ]));
    const record = (id, amount, status) => ({ rewardId: id, personId: worker.personId, personName: worker.name, amount, status, createdAt: `${month}-10T03:00:00.000Z` });
    localStorage.setItem("rewardRecords", JSON.stringify([
      record("TEST-PENDING-REWARD", 10, "pending_acknowledgement"),
      record("TEST-ISSUED-REWARD", 15, "issued"),
      record("TEST-ACK-REWARD", 20, "acknowledged"),
      record("TEST-REJECTED-REWARD", 100, "rejected"),
      record("TEST-CANCELLED-REWARD", 50, "cancelled")
    ]));
    localStorage.setItem("penaltyRecords", JSON.stringify([
      { penaltyId: "TEST-PENDING-PENALTY", personId: worker.personId, personName: worker.name, amount: 5, status: "pending_acknowledgement", createdAt: `${month}-10T03:00:00.000Z` },
      { penaltyId: "TEST-ISSUED-PENALTY", personId: worker.personId, personName: worker.name, amount: 7, status: "issued", createdAt: `${month}-10T03:00:00.000Z` },
      { penaltyId: "TEST-ACK-PENALTY", personId: worker.personId, personName: worker.name, amount: 20, status: "acknowledged", createdAt: `${month}-10T03:00:00.000Z` },
      { penaltyId: "TEST-REJECTED-PENALTY", personId: worker.personId, personName: worker.name, amount: 100, status: "rejected", createdAt: `${month}-10T03:00:00.000Z` },
      { penaltyId: "TEST-CANCELLED-PENALTY", personId: worker.personId, personName: worker.name, amount: 50, status: "cancelled", createdAt: `${month}-10T03:00:00.000Z` }
    ]));
    localStorage.setItem("overtimeRecords", "[]");
    localStorage.setItem("payrollMonthlyRecords", "[]");
    localStorage.setItem("payrollMonthlyLocks", "[]");
    localStorage.setItem("payrollAuditLogs", "[]");
    localStorage.setItem("tripRecords", "[]");
    localStorage.setItem("driverTripRecords", "[]");
    localStorage.setItem("performanceRankingRecords", "[]");
    localStorage.setItem("TEST-POLICY-SETUP", "done");
  });
  await page.route("**/*", async route => {
    const req = route.request(); const url = new URL(req.url());
    if (!["GET", "HEAD"].includes(req.method()) || url.origin !== ORIGIN) { blocked.push(`${req.method()} ${req.url()}`); return route.abort(); }
    const file = path.resolve(ROOT, decodeURIComponent(url.pathname).slice(1) || "index.html");
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try { return route.fulfill({ status: 200, contentType: path.extname(file) === ".html" ? "text/html; charset=utf-8" : "text/javascript; charset=utf-8", body: await fs.readFile(file) }); }
    catch { return route.fulfill({ status: 404, body: "missing test asset" }); }
  });
  await page.goto(`${ORIGIN}/report-center.html`, { waitUntil: "domcontentloaded" });
  await page.screenshot({ path: evidencePath("证据_工资奖罚待确认状态口径", "payroll-adjustment-ack-policy-probe"), fullPage: true });
  let rows = await page.evaluate(() => JSON.parse(localStorage.getItem("payrollMonthlyRecords") || "[]"));
  let workerPayroll = rows.find(row => row.personId === "TEST-POLICY-WORKER-001");
  const beforeAck = { reward: workerPayroll?.reward, penalty: workerPayroll?.otherDeduction };
  expect(workerPayroll).toBeTruthy();
  await page.evaluate(() => {
    localStorage.setItem("currentPersonId", "TEST-POLICY-WORKER-001");
    localStorage.setItem("selectedPosition", "维修员");
  });
  await page.goto(`${ORIGIN}/reward-penalty-overtime.html`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-filter="reward"]').click();
  await page.locator('#recordList .ack[data-type="reward"][data-index="0"]').click();
  await page.locator('[data-filter="penalty"]').click();
  await page.locator('#recordList .ack[data-type="penalty"][data-index="0"]').click();
  const acknowledged = await page.evaluate(() => ({
    reward: JSON.parse(localStorage.getItem("rewardRecords") || "[]").find(row => row.rewardId === "TEST-PENDING-REWARD")?.status,
    penalty: JSON.parse(localStorage.getItem("penaltyRecords") || "[]").find(row => row.penaltyId === "TEST-PENDING-PENALTY")?.status
  }));
  await page.evaluate(() => {
    localStorage.setItem("currentPersonId", "TEST-POLICY-ADMIN-001");
    localStorage.setItem("selectedPosition", "管理员");
    sessionStorage.setItem("managementSession", JSON.stringify({ verified: true, personId: "TEST-POLICY-ADMIN-001", position: "管理员", expiresAt: Date.now() + 600000 }));
  });
  await page.goto(`${ORIGIN}/report-center.html`, { waitUntil: "domcontentloaded" });
  await page.locator("#regeneratePayrollButton").click();
  rows = await page.evaluate(() => JSON.parse(localStorage.getItem("payrollMonthlyRecords") || "[]"));
  workerPayroll = rows.find(row => row.personId === "TEST-POLICY-WORKER-001");
  const afterAck = { reward: workerPayroll?.reward, penalty: workerPayroll?.otherDeduction };
  console.log("TEST reward/penalty payroll policy observation:", JSON.stringify({ beforeAck, acknowledged, afterAck, source: { pendingReward: 10, issuedReward: 15, acknowledgedReward: 20, rejectedReward: 100, cancelledReward: 50, pendingPenalty: 5, issuedPenalty: 7, acknowledgedPenalty: 20, rejectedPenalty: 100, cancelledPenalty: 50 } }));
  expect(acknowledged).toEqual({ reward: "acknowledged", penalty: "acknowledged" });
  expect(beforeAck).toEqual({ reward: 45, penalty: 32 });
  expect(afterAck).toEqual(beforeAck);
  expect(workerPayroll).toBeTruthy();
  await page.screenshot({ path: evidencePath("证据_工资奖罚待确认状态口径", "payroll-adjustment-ack-policy-probe-2"), fullPage: true });
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});


