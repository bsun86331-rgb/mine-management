"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const { installAGroupRobotContext } = require("./a-group-multi-robot-fixture");
const { TruckDriverBot } = require("./bots/truck-driver-bot");

const TEST_ORIGIN = "https://mine.test";
const REPOSITORY_ROOT = path.resolve(__dirname, "..");

test("TEST 汽车司机运输一趟渣后，生产看板只计一趟", async ({ page }) => {
    const pageErrors = [];
    const blockedRequests = [];

    page.on("pageerror", error => pageErrors.push(error.message));

    await page.route("**/*", async route => {
        const request = route.request();
        const requestUrl = new URL(request.url());

        if (!["GET", "HEAD"].includes(request.method())) {
            blockedRequests.push({ method: request.method(), url: request.url() });
            return route.abort();
        }

        if (requestUrl.origin !== TEST_ORIGIN) {
            blockedRequests.push({ method: request.method(), url: request.url(), reason: "external" });
            return route.abort();
        }

        let relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, "");
        if (!relativePath) relativePath = "index.html";

        const filePath = path.resolve(REPOSITORY_ROOT, relativePath);
        if (!filePath.startsWith(REPOSITORY_ROOT + path.sep)) {
            return route.fulfill({ status: 403, body: "blocked" });
        }

        try {
            const body = await fs.readFile(filePath);
            const contentType = {
                ".html": "text/html; charset=utf-8",
                ".js": "text/javascript; charset=utf-8",
                ".css": "text/css; charset=utf-8",
                ".json": "application/json; charset=utf-8"
            }[path.extname(filePath)] || "application/octet-stream";

            return route.fulfill({ status: 200, contentType, body });
        } catch {
            return route.fulfill({ status: 404, body: "missing test asset" });
        }
    });

    const nativeGoto = page.goto.bind(page);
    page.goto = (url, options) => nativeGoto(new URL(url, TEST_ORIGIN + "/").href, options);

    await page.goto(TEST_ORIGIN + "/index.html", { waitUntil: "domcontentloaded" });
    await installAGroupRobotContext(page, "TEST-A-D-001");

    const bot = new TruckDriverBot(page);
    await bot.installTestGpsBeforeOpen();
    await bot.open();

    const context = await bot.assertSafeContext();
    expect(context.profile.personId).toBe("TEST-A-D-001");
    expect(context.task.taskId).toMatch(/^TEST-/);

    await bot.testNormalTransportClosedLoop();

    const driverTrips = await bot.readLocalStorage("driverTripRecords");
    await expect.poll(async () => (await bot.readLocalStorage("tripRecords") || []).length, { timeout: 5000 }).toBe(1);

    const canonicalTrips = await bot.readLocalStorage("tripRecords");
    expect(driverTrips).toHaveLength(1);
    expect(canonicalTrips).toHaveLength(1);
    expect(driverTrips[0].tripId).toMatch(/^TEST-/);
    expect(canonicalTrips[0].tripId).toBe(driverTrips[0].tripId);
    expect(canonicalTrips[0].materialType).toBe("渣");
    expect(canonicalTrips[0].unloadingZoneId).toBe("TEST-UNLOAD-WASTE");
    await page.goto(TEST_ORIGIN + "/driver-work.html", { waitUntil: "domcontentloaded" });
    await page.locator('#production-board [data-action="toggle"]').click();

    const board = page.locator("#production-board");
    await expect(board).toContainText(/当日总趟数\s*1/);
    await expect(board).toContainText(/A组总趟数\s*1/);
    await expect(board).toContainText(/A组渣总趟数\s*1/);
    await expect(board).toContainText("排土管理 0 人");
    expect(await board.locator('[data-action="edit"]').count()).toBe(0);

    await page.evaluate(() => {
        const trips = JSON.parse(localStorage.getItem("driverTripRecords") || "[]");
        trips[0].officialCountEligible = false;
        trips[0].dispatchConfirmation = "rejected";
        localStorage.setItem("driverTripRecords", JSON.stringify(trips));
        const canonicalTrips = JSON.parse(localStorage.getItem("tripRecords") || "[]");
        canonicalTrips[0].officialCountEligible = false;
        canonicalTrips[0].dispatchConfirmation = "rejected";
        localStorage.setItem("tripRecords", JSON.stringify(canonicalTrips));
    });
    await page.goto(TEST_ORIGIN + "/driver-work.html", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#todayTripCount")).toHaveText("1");
    await expect(page.locator("#tripRankValue")).toContainText("第");
    await page.locator('#production-board [data-action="toggle"]').click();
    // Rejected trips stay in driver trip/payroll/ranking counts but leave official production totals.
    await expect(page.locator("#production-board")).toContainText(/当日总趟数\s*0/);
    await expect(page.locator("#production-board")).toContainText(/A组总趟数\s*0/);

    const payrollMonth = new Date().toISOString().slice(0, 7);
    const seedPayroll = month => {
        const people = JSON.parse(localStorage.getItem("personnelRecords") || "[]");
        const driver = people.find(person => person.personId === "TEST-A-D-001");
        const admin = { personId: "TEST-TRANSPORT-ADMIN", employeeNo: "TEST-TRANSPORT-ADMIN", name: "TEST报表管理员", position: "管理员", status: "approved", approvalStatus: "approved" };
        localStorage.setItem("personnelRecords", JSON.stringify([...people.filter(person => person.personId !== admin.personId), admin]));
        localStorage.setItem("currentPersonId", admin.personId);
        localStorage.setItem("selectedPosition", "管理员");
        sessionStorage.setItem("managementSession", JSON.stringify({ verified: true, personId: admin.personId, position: "管理员", expiresAt: Date.now() + 600000 }));
        localStorage.setItem("adminAttendanceMonthlyLocks", JSON.stringify([{ lockId: `ADMIN_ATT_LOCK_${month.replaceAll("-", "")}`, month, status: "locked", rows: [admin, driver].map(person => ({ personId: person.personId, employeeNo: person.employeeNo, personName: person.name, finalAttendance: 20, deduction: 0 })) }]));
        localStorage.setItem("payrollStandards", JSON.stringify([
            { standardId: "TEST-TRANSPORT-ADMIN-STANDARD", scope: "person", standardType: "fixed_person", personId: admin.personId, salaryStage: "regular", regularSalary: 1000, baseSalary: 1000, effectiveDate: "2026-01-01", status: "active" },
            { standardId: "TEST-TRANSPORT-DRIVER-STANDARD", scope: "position", standardType: "frontline_performance", position: "汽车司机", salaryMode: "performance", baseSalary: 1000, performanceUnitPrice: 100, effectiveDate: "2026-01-01", status: "active" }
        ]));
        for (const key of ["payrollMonthlyRecords", "payrollMonthlyLocks", "payrollAuditLogs", "performanceRankingRecords", "rewardRecords", "penaltyRecords", "overtimeRecords"]) localStorage.setItem(key, "[]");
    };
    await page.evaluate(seedPayroll, payrollMonth);
    await page.addInitScript(seedPayroll, payrollMonth);
    await page.goto(TEST_ORIGIN + "/report-center.html", { waitUntil: "domcontentloaded" });
    await page.locator("#payrollMonth").fill(payrollMonth);
    await page.locator("#regeneratePayrollButton").click();
    const result = await page.evaluate(month => {
        const records = JSON.parse(localStorage.getItem("payrollMonthlyRecords") || "[]");
        const people = JSON.parse(localStorage.getItem("personnelRecords") || "[]");
        const driver = people.find(person => person.personId === "TEST-A-D-001");
        return {
            payroll: records.find(row => row.personId === "TEST-A-D-001"),
            officialProductionTripCount: getAllProductionTripRecords().length,
            rankingTripCount: getDriverTripCountForRanking(driver, month)
        };
    }, payrollMonth);
    expect(result.officialProductionTripCount).toBe(0);
    expect(result.rankingTripCount).toBe(1);
    expect(result.payroll?.performanceQuantity).toBe(1);
    expect(result.payroll?.performanceSalary).toBe(100);
    expect(pageErrors).toEqual([]);
    expect(blockedRequests).toEqual([]);
});







