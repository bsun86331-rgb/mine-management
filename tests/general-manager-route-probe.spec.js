"use strict";
const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");
async function installIsolation(page, withSession) {
  const blocked=[]; const errors=[];
  page.on("pageerror", e=>errors.push(e.message));
  await page.addInitScript(({withSession})=>{
    localStorage.setItem("personnelRecords",JSON.stringify([{personId:"TEST-GM-001",employeeId:"TEST-GM-001",name:"TEST总经理",position:"总经理",status:"approved",approvalStatus:"approved",testFixture:true}]));
    if(withSession) sessionStorage.setItem("managementSession",JSON.stringify({verified:true,position:"总经理",personId:"TEST-GM-001",expiresAt:Date.now()+3600000}));
  },{withSession});
  await page.route("**/*",async route=>{
    const request=route.request(); const url=new URL(request.url());
    if(!["GET","HEAD"].includes(request.method())||url.origin!==ORIGIN){blocked.push(`${request.method()} ${request.url()}`);return route.abort();}
    const relative=decodeURIComponent(url.pathname.slice(1))||"index.html"; const file=path.resolve(ROOT,relative);
    if(!file.startsWith(ROOT+path.sep)) return route.fulfill({status:403,body:"blocked"});
    try{const ext=path.extname(file);const type=ext===".html"?"text/html; charset=utf-8":ext===".js"?"text/javascript; charset=utf-8":"text/css; charset=utf-8";return route.fulfill({status:200,contentType:type,body:await fs.readFile(file)});}catch{return route.fulfill({status:404,body:"missing isolated asset"});}
  });
  return {blocked,errors};
}
test("总经理工作页存在且无有效总经理会话时退回验证入口",async({page})=>{
  const safe=await installIsolation(page,false);
  const response=await page.goto(`${ORIGIN}/general-manager.html`,{waitUntil:"domcontentloaded"});
  expect(response?.status()).toBe(200);
  await expect.poll(()=>new URL(page.url()).pathname).toBe("/management-login.html");
  expect(new URL(page.url()).searchParams.get("position")).toBe("总经理");
  expect(safe.errors).toEqual([]); expect(safe.blocked).toEqual([]);
});
test("有效TEST总经理会话可进入独立总经理工作页并看到请假审批模块",async({page})=>{
  const safe=await installIsolation(page,true);
  const response=await page.goto(`${ORIGIN}/general-manager.html`,{waitUntil:"domcontentloaded"});
  expect(response?.status()).toBe(200);
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator("body")).toContainText("管理人员请假审批");
  const session=await page.evaluate(()=>JSON.parse(sessionStorage.getItem("managementSession")||"null"));
  expect(session).toMatchObject({verified:true,position:"总经理",personId:"TEST-GM-001"});
  expect(safe.errors).toEqual([]); expect(safe.blocked).toEqual([]);
});

