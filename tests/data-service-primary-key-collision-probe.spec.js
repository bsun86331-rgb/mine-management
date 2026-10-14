"use strict";
const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("OPS-15 regression: actual leave page preserves same-person history through DataService", async ({ page }) => {
  const blocked = [];
  page.on("dialog", dialog => dialog.accept());
  await page.addInitScript(() => {
    const id = "TEST-OPS15-LEAVE-PERSON";
    localStorage.setItem("personnelRecords", JSON.stringify([
      { personId:id, employeeId:id, name:"TEST OPS15 请假人员", position:"汽车司机", team:"生产A组", status:"approved", approvalStatus:"approved", personnelStatus:"在职可用", testFixture:true }
    ]));
    localStorage.setItem("currentPersonId", id);
    localStorage.setItem("selectedPosition", "汽车司机");
  });
  await page.route("**/*", async route => {
    const req=route.request(), url=new URL(req.url());
    if (!["GET","HEAD"].includes(req.method()) || url.origin!==ORIGIN) { blocked.push(`${req.method()} ${req.url()}`); return route.abort(); }
    const rel=decodeURIComponent(url.pathname).replace(/^\/+/g,"")||"index.html";
    const file=path.resolve(ROOT,rel);
    if(!file.startsWith(ROOT+path.sep)) return route.fulfill({status:403,body:"blocked"});
    try { const ext=path.extname(file).toLowerCase(); return route.fulfill({status:200,contentType:ext===".html"?"text/html; charset=utf-8":ext===".js"?"text/javascript; charset=utf-8":"application/octet-stream",body:await fs.readFile(file)}); }
    catch { return route.fulfill({status:404,body:"missing fixture asset"}); }
  });
  await page.goto(`${ORIGIN}/leave-request.html`,{waitUntil:"domcontentloaded"});
  const setDate=async days=>{
    const d=await page.evaluate(n=>{const x=new Date(Date.now()+n*86400000);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`;},days);
    await page.locator("#leaveStartDate").fill(d); await page.locator("#leaveEndDate").fill(d);
  };
  const submit=async (days,reason)=>{await setDate(days); await page.locator("#leaveReason").fill(reason); await page.getByRole("button",{name:"提交审批"}).click(); await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem("leaveRequests")||"[]").length)).toBeGreaterThan(0);};
  await submit(14,"TEST 第一笔申请");
  const first=await page.evaluate(()=>JSON.parse(localStorage.getItem("leaveRequests")||"[]")[0]);
  await submit(16,"TEST 第二笔申请");
  const finalRows=await page.evaluate(()=>JSON.parse(localStorage.getItem("leaveRequests")||"[]"));
  expect(finalRows).toHaveLength(2);
  expect(new Set(finalRows.map(row=>row.leaveId)).size).toBe(2);
  expect(finalRows.some(row=>row.leaveId===first.leaveId)).toBe(true);
  expect(finalRows.every(row=>Boolean(row.leaveId))).toBe(true);
  expect(blocked).toEqual([]);
});

test("OPS-15 regression: actual attendance page preserves the previous day", async ({ page, context }) => {
  const blocked = [];
  const dialogs = [];
  page.on("dialog", async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
  await page.clock.install({ time: new Date("2026-10-15T08:00:00Z") });
  await page.addInitScript(() => {
    const id = "TEST-OPS15-ATT-PERSON";
    localStorage.setItem("personnelRecords", JSON.stringify([
      { personId:id, employeeNo:id, name:"TEST OPS15 考勤人员", position:"汽车司机", status:"approved", approvalStatus:"approved", department:"生产A组", personnelStatus:"在职可用", testFixture:true }
    ]));
    localStorage.setItem("currentPersonId", id);
    localStorage.setItem("selectedPosition", "汽车司机");
    localStorage.setItem("attendanceGeofenceConfig", JSON.stringify({ latitude:47.9, longitude:106.9, radiusMeters:1000, maxAccuracyMeters:50, enabled:true, name:"TEST考勤点" }));
    localStorage.setItem("attendanceRecords", JSON.stringify([
      { attendanceId:"TEST-OPS15-ATT-OLD", personId:id, personName:"TEST OPS15 考勤人员", position:"汽车司机", date:"2026-10-14", checkInAt:"2026-10-14T00:30:00.000Z", checkOutAt:"2026-10-14T12:30:00.000Z", attendanceStatus:"present" }
    ]));
    localStorage.setItem("attendanceGeofenceAttempts", "[]");
    localStorage.setItem("leaveRequests", "[]");
    localStorage.setItem("dispatchShiftExecutions", "[]");
    localStorage.setItem("dispatchPublishedTasks", "[]");
  });
  await page.route("**/*", async route => {
    const req=route.request(), url=new URL(req.url());
    if (!["GET","HEAD"].includes(req.method()) || url.origin!==ORIGIN) { blocked.push(`${req.method()} ${req.url()}`); return route.abort(); }
    const rel=decodeURIComponent(url.pathname).replace(/^\/+/,"")||"index.html";
    const file=path.resolve(ROOT,rel);
    if(!file.startsWith(ROOT+path.sep)) return route.fulfill({status:403,body:"blocked"});
    try { const ext=path.extname(file).toLowerCase(); return route.fulfill({status:200,contentType:ext===".html"?"text/html; charset=utf-8":ext===".js"?"text/javascript; charset=utf-8":"application/octet-stream",body:await fs.readFile(file)}); }
    catch { return route.fulfill({status:404,body:"missing fixture asset"}); }
  });
  await context.grantPermissions(["geolocation"], { origin: ORIGIN });
  await context.setGeolocation({ latitude:47.9, longitude:106.9, accuracy:10 });
  await page.goto(`${ORIGIN}/attendance.html`,{waitUntil:"domcontentloaded"});
  await page.getByRole("button",{name:"上班打卡"}).click();
  await expect.poll(()=>dialogs.at(-1)).toContain("上班打卡成功");
  const rows=await page.evaluate(()=>JSON.parse(localStorage.getItem("attendanceRecords")||"[]"));
  expect(rows).toHaveLength(2);
  expect(new Set(rows.map(row=>row.attendanceId)).size).toBe(2);
  expect(rows.some(row=>row.attendanceId==="TEST-OPS15-ATT-OLD"&&row.date==="2026-10-14")).toBe(true);
  expect(rows.some(row=>row.attendanceId!=="TEST-OPS15-ATT-OLD"&&row.date==="2026-10-15")).toBe(true);
  expect(blocked).toEqual([]);
});

test("OPS-15 regression: actual equipment checks preserve earlier same-person checks", async ({ page }) => {
  const blocked = [];
  page.on("dialog", async dialog => dialog.accept());
  await page.addInitScript(() => {
    const id = "TEST-OPS15-EQUIPMENT-PERSON";
    localStorage.setItem("personnelRecords", JSON.stringify([
      { personId:id, employeeNo:id, name:"TEST OPS15 设备检查员", position:"汽车司机", status:"approved", approvalStatus:"approved", personnelStatus:"在职可用", team:"生产A组", testFixture:true }
    ]));
    localStorage.setItem("currentPersonId", id);
    localStorage.setItem("selectedPosition", "汽车司机");
    localStorage.setItem("equipmentUsageChecks", "[]");
    localStorage.setItem("equipmentMeterReadings", "[]");
    localStorage.setItem("equipmentUsageRecords", "[]");
  });
  await page.route("**/*", async route => {
    const req=route.request(), url=new URL(req.url());
    if (!["GET","HEAD"].includes(req.method()) || url.origin!==ORIGIN) { blocked.push(`${req.method()} ${req.url()}`); return route.abort(); }
    const rel=decodeURIComponent(url.pathname).replace(/^\/+/,"")||"index.html";
    const file=path.resolve(ROOT,rel);
    if(!file.startsWith(ROOT+path.sep)) return route.fulfill({status:403,body:"blocked"});
    try { const ext=path.extname(file).toLowerCase(); return route.fulfill({status:200,contentType:ext===".html"?"text/html; charset=utf-8":ext===".js"?"text/javascript; charset=utf-8":"application/octet-stream",body:await fs.readFile(file)}); }
    catch { return route.fulfill({status:404,body:"missing fixture asset"}); }
  });
  await page.goto(`${ORIGIN}/equipment-check.html`,{waitUntil:"domcontentloaded"});
  await page.locator("#usageModeBox").click();
  await page.getByRole("button",{name:/当前人员与设备/}).click();
  await page.getByRole("button",{name:/设备读数/}).click();
  const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/WQAAAABJRU5ErkJggg==","base64");
  const submitFor=async (vehicle, reading)=>{
    await page.locator("#manualVehicleType").selectOption({label:"皮卡"});
    await page.locator("#manualVehicleNumber").fill(vehicle);
    await page.locator("#usagePurpose").fill("TEST 日常巡检");
    await page.locator("#meterReading").fill(String(reading));
    await page.locator("#meterPhotoInput").setInputFiles({name:`${vehicle}.png`,mimeType:"image/png",buffer:png});
    await page.locator("#okBox").click();
    await page.getByRole("button",{name:/提交并锁定/}).click();
    await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem("equipmentUsageChecks")||"[]").length)).toBeGreaterThan(0);
  };
  await submitFor("TEST-OPS15-TRUCK-1",100);
  const oldId=await page.evaluate(()=>JSON.parse(localStorage.getItem("equipmentUsageChecks")||"[]")[0]?.checkId);
  await submitFor("TEST-OPS15-TRUCK-2",200);
  const state=await page.evaluate(()=>({checks:JSON.parse(localStorage.getItem("equipmentUsageChecks")||"[]"),meters:JSON.parse(localStorage.getItem("equipmentMeterReadings")||"[]")}));
  expect(state.checks).toHaveLength(2);
  expect(state.checks.some(row=>row.checkId===oldId)).toBe(true);
  expect(new Set(state.checks.map(row=>row.checkId)).size).toBe(2);
  expect(new Set(state.checks.map(row=>row.equipmentNumber))).toEqual(new Set(["TEST-OPS15-TRUCK-1","TEST-OPS15-TRUCK-2"]));
  expect(state.meters).toHaveLength(2);
  expect(new Set(state.meters.map(row=>row.meterRecordId)).size).toBe(2);
  expect(blocked).toEqual([]);
});

