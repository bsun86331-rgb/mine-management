"use strict";
const { evidencePath } = require("./evidence-path.cjs");
const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const { installAGroupRobotContext } = require("./a-group-multi-robot-fixture");
const { TruckDriverBot } = require("./bots/truck-driver-bot");
const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST机器人完成一趟运输后工资绩效只计一次", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (!["GET", "HEAD"].includes(req.method()) || url.origin !== ORIGIN) { blocked.push(`${req.method()} ${req.url()}`); return route.abort(); }
    const file = path.resolve(ROOT, decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html");
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try { return route.fulfill({ status: 200, contentType: path.extname(file) === ".html" ? "text/html; charset=utf-8" : "text/javascript; charset=utf-8", body: await fs.readFile(file) }); }
    catch { return route.fulfill({ status: 404, body: "missing test asset" }); }
  });
  const nativeGoto = page.goto.bind(page);
  page.goto = (url, options) => nativeGoto(new URL(url, ORIGIN + "/").href, options);
  await page.goto(`${ORIGIN}/index.html`, { waitUntil: "domcontentloaded" });
  await installAGroupRobotContext(page, "TEST-A-D-001");
  const bot = new TruckDriverBot(page);
  await bot.installTestGpsBeforeOpen();
  await bot.open();
  await bot.testNormalTransportClosedLoop();

  const setupPayroll = () => {
    const month = new Date().toISOString().slice(0, 7);
    const admin = { personId: "TEST-TRIPALIAS-ADMIN", employeeNo: "TEST-TRIPALIAS-ADMIN", name: "TEST报表管理员", position: "管理员", status: "approved", approvalStatus: "approved" };
    const driver = JSON.parse(localStorage.getItem("personnelRecords") || "[]").find(person => person.personId === "TEST-A-D-001");
    const people = JSON.parse(localStorage.getItem("personnelRecords") || "[]").filter(person => person.personId !== admin.personId);
    localStorage.setItem("personnelRecords", JSON.stringify([...people, admin]));
    localStorage.setItem("currentPersonId", admin.personId);
    localStorage.setItem("selectedPosition", "管理员");
    sessionStorage.setItem("managementSession", JSON.stringify({ verified: true, personId: admin.personId, position: "管理员", expiresAt: Date.now() + 600000 }));
    localStorage.setItem("adminAttendanceMonthlyLocks", JSON.stringify([{ lockId: `ADMIN_ATT_LOCK_${month.replaceAll("-", "")}`, month, status: "locked", rows: [admin, driver].map(person => ({ personId: person.personId, employeeNo: person.employeeNo, personName: person.name, finalAttendance: 20, deduction: 0 })) }]));
    localStorage.setItem("payrollStandards", JSON.stringify([
      { standardId: "TEST-TRIPALIAS-ADMIN-STANDARD", scope: "person", standardType: "fixed_person", personId: admin.personId, salaryStage: "regular", regularSalary: 1000, baseSalary: 1000, effectiveDate: "2026-01-01", status: "active" },
      { standardId: "TEST-TRIPALIAS-DRIVER-STANDARD", scope: "position", standardType: "frontline_performance", position: "汽车司机", salaryMode: "performance", baseSalary: 1000, performanceUnitPrice: 100, effectiveDate: "2026-01-01", status: "active" }
    ]));
    for (const key of ["payrollMonthlyRecords", "payrollMonthlyLocks", "payrollAuditLogs", "performanceRankingRecords", "rewardRecords", "penaltyRecords", "overtimeRecords"]) localStorage.setItem(key, "[]");
  };
  await page.evaluate(setupPayroll);
  await page.addInitScript(setupPayroll);
  await page.goto(`${ORIGIN}/report-center.html`, { waitUntil: "domcontentloaded" });
  const pageState = await page.evaluate(() => ({ href: location.href, text: document.body.innerText.slice(0, 350), hasPayrollMonth: !!document.getElementById("payrollMonth"), quantityFunction: typeof window.getPayrollProductionQuantity, person: localStorage.getItem("currentPersonId"), attendanceLocks: localStorage.getItem("adminAttendanceMonthlyLocks") }));
  console.log("REPORT PAGE STATE", JSON.stringify(pageState));
  await page.locator("#payrollMonth").fill(new Date().toISOString().slice(0, 7));
  await page.locator("#regeneratePayrollButton").click();
  await page.locator("#payrollMonth").fill(new Date().toISOString().slice(0, 7));
  await page.locator("#regeneratePayrollButton").click();
  const result = await page.evaluate(() => {
    const payroll = JSON.parse(localStorage.getItem("payrollMonthlyRecords") || "[]").find(row => row.personId === "TEST-A-D-001"); const monthInput = document.getElementById("payrollMonth")?.value; const tableText = document.getElementById("payrollTableBody")?.innerText;
    const ids = ["tripRecords", "driverTripRecords", "transportRecords"].flatMap(key => JSON.parse(localStorage.getItem(key) || "[]")).map(row => row.tripId).filter(Boolean);

    const driver = JSON.parse(localStorage.getItem("personnelRecords") || "[]").find(person => person.personId === "TEST-A-D-001"); const rankingTripCount = getDriverTripCountForRanking(driver, monthInput);
    return { monthInput, performanceQuantity: payroll?.performanceQuantity, performanceSalary: payroll?.performanceSalary, rankingTripCount, tripRows: ids.length, uniqueTripIds: [...new Set(ids)].length };
  console.log("TEST robot trip payroll result:", JSON.stringify({ monthInput: result.monthInput, performanceQuantity: result.performanceQuantity, performanceSalary: result.performanceSalary, uniqueTripIds: result.uniqueTripIds, tripRows: result.tripRows }));
  });
  console.log("TEST robot trip payroll result:", JSON.stringify({ monthInput: result.monthInput, performanceQuantity: result.performanceQuantity, performanceSalary: result.performanceSalary, rankingTripCount: result.rankingTripCount, uniqueTripIds: result.uniqueTripIds, tripRows: result.tripRows }));
  await page.screenshot({ path: evidencePath("证据_机器人运输趟次工资重复计数", "payroll-trip-alias-e2e"), fullPage: true });
  expect(result.tripRows).toBeGreaterThan(0);
  expect(result.uniqueTripIds).toBe(1);
  expect(result.performanceQuantity).toBe(1);
  expect(result.rankingTripCount).toBe(1);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
