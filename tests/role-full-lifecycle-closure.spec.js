"use strict";
const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=", "base64");
test("TEST 排土管理登记到审核再进入工作端完整链路", async ({ page }) => {
  const errors = [], blocked = [], dialogs = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("dialog", async d => { dialogs.push(d.message()); await d.accept(); });
  await page.addInitScript(() => {
  });
  await page.route("**/*", async route => {
    const req=route.request(), url=new URL(req.url());
    if (!["GET","HEAD"].includes(req.method()) || url.origin!==ORIGIN) { blocked.push(`${req.method()} ${req.url()}`); return route.abort(); }
    const rel=decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html", file=path.resolve(ROOT,rel);
    if (!file.startsWith(ROOT+path.sep)) return route.fulfill({status:403,body:"blocked"});
    try { const body=await fs.readFile(file), ext=path.extname(file); return route.fulfill({status:200,contentType:ext===".html"?"text/html; charset=utf-8":ext===".js"?"text/javascript; charset=utf-8":ext===".css"?"text/css; charset=utf-8":"application/octet-stream",body}); }
    catch { return route.fulfill({status:404,body:"missing test asset"}); }
  });
  await page.goto(`${ORIGIN}/person-register.html?position=${encodeURIComponent("排土管理")}`);
  await page.locator("#name").fill("TEST排土流程人员"); await page.locator("#phone").fill("13800000000");
  await page.locator("#passportNumber").fill("TEST-PASSPORT-FLOW-001");
  await page.locator("#selfiePhoto").setInputFiles({name:"test.png",mimeType:"image/png",buffer:PNG});
  await page.locator("#emergencyContact").fill("TEST联系人"); await page.locator("#emergencyPhone").fill("13900000000");
  await page.locator("#team").selectOption("生产A组"); await page.locator("#submitButton").click();
  await expect.poll(()=>new URL(page.url()).pathname).toBe("/person-waiting.html");
  const pending=await page.evaluate(()=>JSON.parse(localStorage.getItem("personnelRecords")||"[]").find(x=>x.name==="TEST排土流程人员"));
  const applicantId=pending?.personId;
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("personnelRecords")||"[]").filter(x=>x.name==="TEST排土流程人员").length)).toBe(1);
  expect(pending).toBeTruthy(); expect(pending.team).toBe("生产A组"); expect(pending.approvalStatus||pending.status).toMatch(/pending|待审核/i);
  await page.evaluate(()=>{const people=JSON.parse(localStorage.getItem("personnelRecords")||"[]");people.push({personId:"TEST-ADMIN-FLOW-001",employeeNo:"TEST-ADMIN-FLOW-001",name:"TEST流程管理员",position:"管理员",team:"后勤办公组",status:"approved",approvalStatus:"approved",personnelStatus:"在职可用",testFixture:true});localStorage.setItem("personnelRecords",JSON.stringify(people));localStorage.setItem("adminPersonId","TEST-ADMIN-FLOW-001");localStorage.setItem("selectedPosition","管理员");sessionStorage.setItem("managementSession",JSON.stringify({verified:true,personId:"TEST-ADMIN-FLOW-001",position:"管理员",expiresAt:Date.now()+3600000,testFixture:true}));});
  await page.goto(`${ORIGIN}/admin-review.html`);
  const row=page.locator("#personnelTableBody tr").filter({hasText:"TEST排土流程人员"}); await expect(row).toBeVisible(); await row.click();
  await expect(page.locator("#detailPosition")).toHaveText("排土管理"); await page.locator("#approveButton").click();
  await expect.poll(()=>page.evaluate(id=>JSON.parse(localStorage.getItem("personnelRecords")||"[]").find(x=>x.personId===id)?.approvalStatus,applicantId)).toBe("approved");
  await page.goto(`${ORIGIN}/index.html`); await page.getByRole("button",{name:/排土管理/}).click();
  await expect.poll(()=>new URL(page.url()).pathname).toBe("/dump-management.html"); await expect(page.locator("h1")).toContainText("排土管理工作端");
  expect(errors).toEqual([]); expect(blocked).toEqual([]);
});

