"use strict";
const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

async function install(page, decision) {
  const errors = [], blocked = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("dialog", async d => {
    if (d.type() === "prompt") await d.accept("TEST排班调整");
    else if (d.type() === "confirm") await d.accept();
    else await d.accept();
  });
  await page.addInitScript(() => {
    const person = {personId:"TEST-TRANSFER-EX-001",employeeId:"TEST-TRANSFER-EX-001",employeeNo:"TEST-TRANSFER-EX-001",name:"TEST挖机换组员",position:"挖机司机",team:"生产A组",department:"生产A组",status:"approved",approvalStatus:"approved",personnelStatus:"在职可用",testFixture:true};
    if (!JSON.parse(localStorage.getItem("personnelRecords")||"[]").some(r=>r.personId===person.personId)) {
      localStorage.setItem("personnelRecords",JSON.stringify([person]));
      localStorage.setItem("currentPersonId",person.personId);
      localStorage.setItem("selectedPosition",person.position);
      localStorage.setItem("teamTransferRequests",JSON.stringify([]));
    }
  });
  await page.route("**/*", async route => {
    const req=route.request(), url=new URL(req.url());
    if (!["GET","HEAD"].includes(req.method()) || url.origin!==ORIGIN) { blocked.push(`${req.method()} ${req.url()}`); return route.abort(); }
    const rel=decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html", file=path.resolve(ROOT,rel);
    if (!file.startsWith(ROOT+path.sep)) return route.fulfill({status:403,body:"blocked"});
    try { const body=await fs.readFile(file), ext=path.extname(file); return route.fulfill({status:200,contentType:ext===".html"?"text/html; charset=utf-8":ext===".js"?"text/javascript; charset=utf-8":ext===".css"?"text/css; charset=utf-8":"application/octet-stream",body}); }
    catch { return route.fulfill({status:404,body:"missing isolated asset"}); }
  });
  await page.goto(`${ORIGIN}/excavator.html`);
  await expect(page.locator("#excavatorTeamTransferButton")).toBeVisible();
  await page.locator("#excavatorTeamTransferButton").click();
  await page.locator("#excTeamTransferTargetTeam").selectOption("生产B组");
  await page.locator("#excTeamTransferReason").fill("TEST生产组轮换");
  await page.locator("#excTeamTransferSubmitButton").click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("teamTransferRequests")||"[]").length)).toBe(1);
  const request=await page.evaluate(()=>JSON.parse(localStorage.getItem("teamTransferRequests")||"[]")[0]);
  expect(request.personId).toBe("TEST-TRANSFER-EX-001"); expect(request.fromTeam).toBe("生产A组"); expect(request.toTeam).toBe("生产B组"); expect(request.status).toBe("pending");
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("personnelRecords")||"[]")[0].team)).toBe("生产A组");
  await page.evaluate(()=>{
    const admin={personId:"TEST-TRANSFER-ADMIN-001",employeeNo:"TEST-TRANSFER-ADMIN-001",name:"TEST换组管理员",position:"管理员",team:"后勤办公组",status:"approved",approvalStatus:"approved",personnelStatus:"在职可用",testFixture:true};
    const people=JSON.parse(localStorage.getItem("personnelRecords")||"[]"); people.push(admin); localStorage.setItem("personnelRecords",JSON.stringify(people));
    localStorage.setItem("adminPersonId",admin.personId); localStorage.setItem("selectedPosition","管理员");
    sessionStorage.setItem("managementSession",JSON.stringify({verified:true,personId:admin.personId,position:"管理员",expiresAt:Date.now()+3600000,testFixture:true}));
  });
  await page.goto(`${ORIGIN}/admin-review.html`);
  await expect(page.locator("#teamTransferReviewBody tr").filter({hasText:"TEST挖机换组员"})).toBeVisible();
  if (decision === "approve") await page.locator("#teamTransferReviewBody tr").filter({hasText:"TEST挖机换组员"}).getByRole("button",{name:"通过"}).click();
  else await page.locator("#teamTransferReviewBody tr").filter({hasText:"TEST挖机换组员"}).getByRole("button",{name:"驳回"}).click();
  if (decision === "approve") {
    await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("teamTransferRequests")||"[]")[0].status)).toBe("approved");
    const person=await page.evaluate(()=>JSON.parse(localStorage.getItem("personnelRecords")||"[]").find(x=>x.personId==="TEST-TRANSFER-EX-001"));
    expect(person.team).toBe("生产B组"); expect(person.teamTransferHistory).toHaveLength(1); expect(person.teamTransferHistory[0].reviewedBy).toBe("TEST换组管理员");
    await page.evaluate(()=>{localStorage.setItem("currentPersonId","TEST-TRANSFER-EX-001");localStorage.setItem("selectedPosition","挖机司机");});
    await page.goto(`${ORIGIN}/excavator.html`);
    await expect(page.locator("#personDepartment")).toContainText("生产B组");
  } else {
    await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("teamTransferRequests")||"[]")[0].status)).toBe("rejected");
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("personnelRecords")||"[]").find(x=>x.personId==="TEST-TRANSFER-EX-001").team)).toBe("生产A组");
    const req=await page.evaluate(()=>JSON.parse(localStorage.getItem("teamTransferRequests")||"[]")[0]);
    expect(req.reviewRemark).toBe("TEST排班调整");
  }
  expect(errors).toEqual([]); expect(blocked).toEqual([]);
}

test("TEST 挖机司机班组申请通过后更新归属和历史", async ({page})=>install(page,"approve"));
test("TEST 挖机司机班组申请驳回后保留原班组和原因", async ({page})=>install(page,"reject"));

test("TEST 四类一线工作端的换组入口均可点击且不被工作聊天遮挡", async ({page})=>{
  const errors=[],blocked=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.addInitScript(()=>{
    const configs={
      "/excavator.html":["TEST-TRANSFER-EX-001","挖机司机"],
      "/driver-work.html":["TEST-TRANSFER-DR-001","汽车司机"],
      "/auxiliary.html":["TEST-TRANSFER-AUX-001","洒水车司机"],
      "/fuel.html":["TEST-TRANSFER-FUEL-001","加油车司机"]
    };
    const [personId,position]=configs[location.pathname]||[];
    if(personId){localStorage.setItem("personnelRecords",JSON.stringify([{personId,employeeId:personId,employeeNo:personId,name:`TEST${position}`,position,team:"生产A组",status:"approved",approvalStatus:"approved",personnelStatus:"在职可用",testFixture:true}]));localStorage.setItem("currentPersonId",personId);localStorage.setItem("selectedPosition",position);}
  });
  await page.route("**/*",async route=>{
    const req=route.request(),url=new URL(req.url());
    if(!["GET","HEAD"].includes(req.method())||url.origin!==ORIGIN){blocked.push(`${req.method()} ${req.url()}`);return route.abort();}
    const rel=decodeURIComponent(url.pathname).replace(/^\/+/,"")||"index.html",file=path.resolve(ROOT,rel);
    if(!file.startsWith(ROOT+path.sep))return route.fulfill({status:403,body:"blocked"});
    try{const body=await fs.readFile(file),ext=path.extname(file);return route.fulfill({status:200,contentType:ext===".html"?"text/html; charset=utf-8":ext===".js"?"text/javascript; charset=utf-8":ext===".css"?"text/css; charset=utf-8":"application/octet-stream",body});}
    catch{return route.fulfill({status:404,body:"missing isolated asset"});}
  });
  const pages=[
    ["/excavator.html","#excavatorTeamTransferButton","#excavatorTeamTransferModal"],
    ["/driver-work.html","#teamTransferFloatingButton","#teamTransferModal"],
    ["/auxiliary.html","#auxTeamTransferButton","#auxTeamTransferModal"],
    ["/fuel.html","#fuelTeamTransferButton","#fuelTeamTransferModal"]
  ];
  for(const [path,button,modal] of pages){
    await page.goto(`${ORIGIN}${path}`);
    await expect(page.locator("#mineChatLauncher")).toBeVisible();
    await expect(page.locator(button)).toBeVisible();
    await page.locator(button).click();
    await expect(page.locator(modal)).toHaveClass(/show/);
    await page.locator(modal).locator("button").first().click();
  }
  expect(errors).toEqual([]);expect(blocked).toEqual([]);
});

