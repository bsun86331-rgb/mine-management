"use strict";
const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");
async function openIsolated(page, task) {
  const blocked = [];
  const errors = [];
  const dialogs = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("dialog", async d => { dialogs.push(d.message()); await d.accept(); });
  await page.addInitScript(({ task }) => {
    const id = "TEST-D12-DRIVER-001";
    localStorage.setItem("personnelRecords", JSON.stringify([{ personId:id, employeeId:id, employeeNo:id, name:"TEST-D12汽车司机", position:"汽车司机", team:"生产A组", status:"approved", approvalStatus:"approved", personnelStatus:"在职可用", testFixture:true }]));
    localStorage.setItem("currentPersonId", id);
    localStorage.setItem("selectedPosition", "汽车司机");
    if (task) localStorage.setItem("dispatchPublishedTasks", JSON.stringify([task]));
    else localStorage.removeItem("dispatchPublishedTasks");
    localStorage.removeItem("driverCurrentTask");
  }, { task });
  await page.route("**/*", async route => {
    const req = route.request(); const url = new URL(req.url());
    if (!["GET","HEAD"].includes(req.method()) || url.origin !== ORIGIN) { blocked.push(`${req.method()} ${req.url()}`); return route.abort(); }
    const relative = decodeURIComponent(url.pathname.slice(1)) || "index.html";
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({status:403,body:"blocked"});
    try { const body=await fs.readFile(file); const ext=path.extname(file).toLowerCase(); const type=ext===".html"?"text/html; charset=utf-8":ext===".js"?"text/javascript; charset=utf-8":ext===".css"?"text/css; charset=utf-8":"application/octet-stream"; return route.fulfill({status:200,contentType:type,body}); }
    catch { return route.fulfill({status:404,body:"missing isolated asset"}); }
  });
  await page.goto(`${ORIGIN}/driver-work.html`, {waitUntil:"domcontentloaded"});
  return {blocked,errors,dialogs};
}
test("D12-1 无任务时司机看不到检查入口，程序调用也会拦截", async ({page}) => {
  const result=await openIsolated(page,null);
  await expect(page.locator("#noTaskMessage")).toBeVisible();
  await expect(page.locator("#taskContent")).toBeHidden();
  await expect(page.locator("#equipmentCheckButton")).toBeHidden();
  await page.locator("#equipmentCheckButton").evaluate(el=>el.click());
  await expect.poll(()=>result.dialogs.length).toBe(1);
  expect(result.dialogs[0]).toContain("当前没有生产任务");
  await expect.poll(()=>new URL(page.url()).pathname).toBe("/driver-work.html");
  expect(result.errors).toEqual([]); expect(result.blocked).toEqual([]);
});
test("D12-1 有已发布任务时显示检查入口并自动带入班次、车辆和任务", async ({page}) => {
  const task={taskId:"TEST-D12-TASK-001",status:"active",currentShiftId:"TEST-D12-SHIFT-001",shift:"白班",shiftDate:"2026-10-14",team:"生产A组",driverAssignments:[{driverId:"TEST-D12-DRIVER-001",driverName:"TEST-D12汽车司机",vehicleNumber:"TEST-D12-TRUCK-001",excavatorNumber:"TEST-D12-EX-001",shiftId:"TEST-D12-SHIFT-001",shift:"白班",shiftDate:"2026-10-14"}]};
  const result=await openIsolated(page,task);
  await expect(page.locator("#equipmentCheckButton")).toBeVisible();
  await page.locator("#equipmentCheckButton").click();
  await expect.poll(()=>new URL(page.url()).pathname).toBe("/equipment-check.html");
  const url=new URL(page.url());
  expect(url.searchParams.get("mode")).toBe("shift");
  expect(url.searchParams.get("shiftId")).toBe("TEST-D12-SHIFT-001");
  expect(url.searchParams.get("taskId")).toBe("TEST-D12-TASK-001");
  expect(url.searchParams.get("vehicle")).toBe("TEST-D12-TRUCK-001");
  expect(result.errors).toEqual([]); expect(result.blocked).toEqual([]);
});




