const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");
const authorizedRoles = ["会计", "管理员", "总经理"];

async function routeLocalSite(page) {
    await page.route("**/*", async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (!["GET", "HEAD"].includes(request.method()) || url.origin !== ORIGIN) return route.abort();
        const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
        const file = path.resolve(ROOT, relative);
        if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
        try {
            const ext = path.extname(file).toLowerCase();
            const contentType = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream";
            return route.fulfill({ status: 200, contentType, body: await fs.readFile(file) });
        } catch {
            return route.fulfill({ status: 404, body: "missing test asset" });
        }
    });
}

async function seedIdentity(page, position, options = {}) {
    const personId = `TEST-FIN-${position}`;
    await page.addInitScript(({ position, personId, status, useSession }) => {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem("personnelRecords", JSON.stringify([{
            personId,
            name: `TEST-${position}`,
            position,
            status,
            approvalStatus: status === "approved" ? "approved" : "pending"
        }]));
        if (useSession) {
            sessionStorage.setItem("managementSession", JSON.stringify({
                personId,
                position,
                verified: true,
                expiresAt: Date.now() + 60_000
            }));
        } else {
            localStorage.setItem("currentPersonId", personId);
            localStorage.setItem("selectedPosition", position);
        }
    }, {
        position,
        personId,
        status: options.status || "approved",
        useSession: Boolean(options.useSession)
    });
    await page.goto(`${ORIGIN}/finance-cost.html`, { waitUntil: "domcontentloaded" });
    return personId;
}

test("D11-2 已审核会计、管理员、总经理可以查看财务费用", async ({ page }) => {
    page.on("dialog", dialog => dialog.accept());
    await routeLocalSite(page);
    for (const position of authorizedRoles) {
        await page.context().clearCookies();
        await seedIdentity(page, position, {
            useSession: position !== "会计"
        });
        await expect(page.getByRole("heading", { name: "🧮 财务费用录入中心" })).toBeVisible();
        await expect(page.getByRole("heading", { name: "📋 财务费用记录" })).toBeVisible();
        await expect(page.getByRole("button", { name: "保存费用" })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "删除" })).toHaveCount(0);
        const writeAttempt = await page.evaluate(() => {
            const before = localStorage.getItem("financeCostRecords");
            window.alert = () => {};
            saveFinanceCost();
            deleteFinanceCost("TEST-FIN-COST-001");
            return {
                canWrite: window.__financeCostCanWrite,
                before,
                after: localStorage.getItem("financeCostRecords")
            };
        });
        expect(writeAttempt).toEqual({ canWrite: false, before: null, after: null });
    }
});

test("非授权岗位与未审核会计不能进入财务费用页", async ({ page }) => {
    page.on("dialog", dialog => dialog.accept());
    await routeLocalSite(page);
    await page.addInitScript(() => {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem("personnelRecords", JSON.stringify([{
            personId: "TEST-FIN-DRIVER",
            name: "TEST司机",
            position: "汽车司机",
            status: "approved",
            approvalStatus: "approved"
        }]));
        localStorage.setItem("currentPersonId", "TEST-FIN-DRIVER");
        localStorage.setItem("selectedPosition", "汽车司机");
    });
    await page.goto("finance-cost.html");
    await expect(page).toHaveURL(/index\.html$/);

    await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem("personnelRecords", JSON.stringify([{
            personId: "TEST-FIN-PENDING",
            name: "TEST待审会计",
            position: "会计",
            status: "pending",
            approvalStatus: "pending"
        }]));
        localStorage.setItem("currentPersonId", "TEST-FIN-PENDING");
        localStorage.setItem("selectedPosition", "会计");
    });
    await page.goto("finance-cost.html");
    await expect(page).toHaveURL(/index\.html$/);
});


test("已审核司机不能通过伪造所选岗位冒充管理员", async ({ page }) => {
    page.on("dialog", dialog => dialog.accept());
    await routeLocalSite(page);
    await page.addInitScript(() => {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem("personnelRecords", JSON.stringify([{
            personId: "TEST-FIN-SPOOF-DRIVER",
            name: "TEST岗位错配司机",
            position: "汽车司机",
            status: "approved",
            approvalStatus: "approved"
        }]));
        localStorage.setItem("currentPersonId", "TEST-FIN-SPOOF-DRIVER");
        localStorage.setItem("selectedPosition", "管理员");
    });
    await page.goto(`${ORIGIN}/finance-cost.html`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/index\\.html$/);
    await expect(page.getByRole("heading", { name: "🧮 财务费用录入中心" })).toHaveCount(0);
});
