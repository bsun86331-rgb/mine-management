"use strict";
const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");
test("TEST 驳回加油单保留库存扣减，核对后更正并重报", async ({ page }) => {
  const errors = [], blocked = [], dialogs = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => {
    dialogs.push(dialog.message());
    if (dialog.type() === "prompt" && dialog.message().includes("驳回原因")) return dialog.accept("TEST数量有异议");
    if (dialog.type() === "prompt" && dialog.message().includes("实际加油量")) return dialog.accept("100");
    if (dialog.type() === "prompt" && dialog.message().includes("核对说明")) return dialog.accept("TEST复核泵表为100升");
    return dialog.accept();
  });
  await page.addInitScript(() => {
    const now = new Date().toISOString();
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem("personnelRecords", JSON.stringify([{ personId:"TEST-D07-OP", employeeNo:"TEST-D07-OP", name:"TEST加油员", position:"加油车司机", status:"approved", approvalStatus:"approved", personnelStatus:"在职可用" }]));
    localStorage.setItem("currentPersonId", "TEST-D07-OP");
    localStorage.setItem("selectedPosition", "加油车司机");
    localStorage.setItem("fuelIntakeRecords", JSON.stringify([{ intakeId:"TEST-D07-INTAKE-1",source:"TEST油罐",oilType:"柴油",amount:1000,createdAt:now }]));
    localStorage.setItem("fuelRequests", "[]");
    localStorage.setItem("fuelRecords", JSON.stringify([{ fuelId:"TEST-D07-FUEL-1",requestId:"TEST-D07-REQ-1",vehicleNumber:"TEST-D07-TRUCK-1",driverName:"TEST司机",amount:120,confirmationStatus:"pending",startedAt:now,completedAt:now,createdAt:now,photoData:"data:image/jpeg;base64,TEST",photoName:"TEST凭证" }]));
    localStorage.setItem("fuelStockAdjustments", "[]");
  });
  await page.route("**/*", async route => {
    const req=route.request(), url=new URL(req.url());
    if (!["GET","HEAD"].includes(req.method()) || url.origin!==ORIGIN) { blocked.push(req.method()+" "+req.url()); return route.abort(); }
    const file = path.resolve(ROOT, decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html");
    if (!file.startsWith(ROOT+path.sep)) return route.fulfill({status:403,body:"blocked"});
    try { const body=await fs.readFile(file), ext=path.extname(file); return route.fulfill({status:200,contentType:{".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8"}[ext]||"application/octet-stream",body}); }
    catch { return route.fulfill({status:404,body:"missing TEST asset"}); }
  });
  await page.goto(ORIGIN+"/fuel.html",{waitUntil:"domcontentloaded"});
  expect(await page.evaluate(()=>calculateCurrentStock())).toBe(880);
  await page.waitForTimeout(500);
  await page.locator("#mineBottomQuickActions").getByRole("button",{name:/作业历史/}).click();
  await expect(page.locator("#page-history")).toHaveClass(/active/);
  await expect(page.locator("#fuelHistoryList")).toContainText("TEST-D07-TRUCK-1");
  await page.locator("#fuelHistoryList").getByRole("button",{name:"模拟司机驳回"}).click();
  expect(await page.evaluate(()=>calculateCurrentStock())).toBe(880);
  await page.locator("#fuelHistoryList").getByRole("button",{name:"核对并更正重报"}).click();
  const state=await page.evaluate(()=>({stock:calculateCurrentStock(),record:JSON.parse(localStorage.getItem("fuelRecords")||"[]")[0]}));
  expect(state.stock).toBe(900);
  expect(state.record).toMatchObject({amount:100,confirmationStatus:"pending",correctionNote:"TEST复核泵表为100升",rejectReason:""});
  expect(state.record.correctionHistory).toHaveLength(1);
  expect(state.record.correctionHistory[0]).toMatchObject({amount:120,rejectReason:"TEST数量有异议",correctedAmount:100});
  await expect(page.locator("#fuelHistoryList")).toContainText("更正前报量：120.0 L");
  expect(dialogs).toContain("请输入驳回原因：");
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});


