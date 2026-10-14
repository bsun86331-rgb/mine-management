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
    });
    await page.goto(TEST_ORIGIN + "/driver-work.html", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#todayTripCount")).toHaveText("1");
    await expect(page.locator("#tripRankValue")).toContainText("第");
    expect(pageErrors).toEqual([]);
    expect(blockedRequests).toEqual([]);
});





