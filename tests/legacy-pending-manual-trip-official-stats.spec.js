"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const TEST_ORIGIN = "https://mine.test";
const REPOSITORY_ROOT = path.resolve(__dirname, "..");

test("待审核的旧手动趟次暂不进入正式统计，批准后才进入", async ({ page }) => {
    const pageErrors = [];
    const blockedRequests = [];
    page.on("pageerror", error => pageErrors.push(error.message));

    await page.route("**/*", async route => {
        const request = route.request();
        const requestUrl = new URL(request.url());
        if (!['GET', 'HEAD'].includes(request.method()) || requestUrl.origin !== TEST_ORIGIN) {
            blockedRequests.push(`${request.method()} ${request.url()}`);
            return route.abort();
        }

        const relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, "") || "index.html";
        const filePath = path.resolve(REPOSITORY_ROOT, relativePath);
        if (!filePath.startsWith(REPOSITORY_ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
        try {
            const body = await fs.readFile(filePath);
            const contentType = {
                ".html": "text/html; charset=utf-8",
                ".js": "text/javascript; charset=utf-8",
                ".css": "text/css; charset=utf-8"
            }[path.extname(filePath)] || "application/octet-stream";
            return route.fulfill({ status: 200, contentType, body });
        } catch {
            return route.fulfill({ status: 404, body: "missing TEST asset" });
        }
    });

    await page.addInitScript(() => {
        if (localStorage.getItem("TEST-LEGACY-PENDING-SETUP") === "1") return;
        localStorage.clear();
        sessionStorage.clear();
        const now = new Date();
        const shift = now.getHours() >= 8 && now.getHours() < 20 ? "白班" : "夜班";
        const boardDate = now.getHours() < 8 ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1) : now;
        const date = `${boardDate.getFullYear()}-${String(boardDate.getMonth() + 1).padStart(2, "0")}-${String(boardDate.getDate()).padStart(2, "0")}`;
        const manager = { personId: "TEST-LEGACY-ADMIN", employeeNo: "TEST-LEGACY-ADMIN", name: "TEST管理员", position: "管理员", status: "approved", approvalStatus: "approved" };
        localStorage.setItem("personnelRecords", JSON.stringify([
            manager,
            { personId: "TEST-LEGACY-DISPATCH", employeeNo: "TEST-LEGACY-DISPATCH", name: "TEST调度", position: "车队长", status: "approved", approvalStatus: "approved" },
            { personId: "TEST-LEGACY-DRIVER", employeeNo: "TEST-LEGACY-DRIVER", name: "TEST司机", position: "汽车司机", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用" }
        ]));
        localStorage.setItem("currentPersonId", "TEST-LEGACY-DISPATCH");
        localStorage.setItem("selectedPosition", "车队长");
        localStorage.setItem("tripRecords", JSON.stringify([{
            tripId: "TEST-LEGACY-PENDING-001", recordId: "TEST-LEGACY-PENDING-001", taskId: "TEST-LEGACY-TASK-A", shiftId: "TEST-LEGACY-SHIFT-A",
            driverId: "TEST-LEGACY-DRIVER", driverName: "TEST司机", vehicleNumber: "TEST-LEGACY-TRUCK", team: "生产A组", materialType: "渣",
            status: "completed", completedAt: now.toISOString(), manualOverride: true, gpsStatus: "manual_override", gpsReviewStatus: "pending", dispatchConfirmation: "pending", testFixture: true
            // Deliberately omit officialCountEligible to model a legacy pending record.
        }]));
        localStorage.setItem("driverTripRecords", "[]");
        localStorage.setItem("mineProductionBoardV2", JSON.stringify({
            schemaVersion: 2, revision: 1,
            schedule: { dayStart: "08:00", dayEnd: "20:00", nightStart: "20:00", nightEnd: "08:00" },
            boards: { [`${date}|${shift}`]: { id: `TEST-BOARD-${date}-${shift}`, date, shift, groups: [{ id: "TEST-GROUP-A", team: "A", excavatorId: "", excavatorDriverId: "", trucks: [], loadingZoneId: "", unloadingZoneIds: [] }], auxiliary: [], published: true, version: 1 } },
            audit: []
        }));
        localStorage.setItem("TEST-LEGACY-PENDING-SETUP", "1");
    });

    await page.goto(`${TEST_ORIGIN}/transport.html`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#totalTrips")).toHaveText("0");
    await expect(page.locator("#pendingManual")).toHaveText("1");
    const coreBefore = await page.evaluate(() => window.ProductionBoardCore.validTrips(JSON.parse(localStorage.getItem("tripRecords") || "[]")).length);
    expect(coreBefore).toBe(0);

    await page.goto(`${TEST_ORIGIN}/dispatch.html`, { waitUntil: "domcontentloaded" });
    await page.locator('#production-board [data-action="toggle"]').click();
    await expect(page.locator("#production-board")).toContainText(/当日总趟数\s*0/);
    await page.evaluate(() => {
        window.confirm = () => true;
        window.alert = () => {};
        reviewManualTrip("TEST-LEGACY-PENDING-001", "approve");
    });
    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("tripRecords") || "[]")[0]?.officialCountEligible), { timeout: 5000 }).toBe(true);
    await page.locator('#production-board [data-action="toggle"]').click();
    await expect(page.locator("#production-board")).toContainText(/当日总趟数\s*1/);

    await page.goto(`${TEST_ORIGIN}/transport.html`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#totalTrips")).toHaveText("1");
    await expect(page.locator("#pendingManual")).toHaveText("0");

    await page.evaluate(() => {
        localStorage.setItem("currentPersonId", "TEST-LEGACY-ADMIN");
        localStorage.setItem("selectedPosition", "管理员");
        sessionStorage.setItem("managementSession", JSON.stringify({ verified: true, personId: "TEST-LEGACY-ADMIN", position: "管理员", expiresAt: Date.now() + 600000 }));
    });
    await page.goto(`${TEST_ORIGIN}/report-center.html`, { waitUntil: "domcontentloaded" });
    const reportPredicate = await page.evaluate(() => ({
        pending: isValidProductionRecord({ tripId: "TEST-REPORT-PENDING", status: "completed", manualOverride: true, gpsStatus: "manual_override", gpsReviewStatus: "pending", dispatchConfirmation: "pending" }),
        approved: isValidProductionRecord({ tripId: "TEST-REPORT-APPROVED", status: "completed", dispatchConfirmation: "confirmed", gpsReviewStatus: "approved", officialCountEligible: true })
    }));
    expect(reportPredicate).toEqual({ pending: false, approved: true });
    expect(pageErrors).toEqual([]);
    expect(blockedRequests).toEqual([]);
});
