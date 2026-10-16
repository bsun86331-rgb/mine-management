"use strict";
const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const ORIGIN = "https://mine.test";
const ROOT = path.resolve(process.env.MINE_MANAGEMENT_TEST_ROOT || path.resolve(__dirname, ".."));
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=", "base64");
async function isolate(page, setup) {
  const errors = [], blocked = [], dialogs = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
  await page.addInitScript(setup);
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (!["GET", "HEAD"].includes(request.method()) || url.origin !== ORIGIN) { blocked.push(`${request.method()} ${request.url()}`); return route.abort(); }
    const relative = decodeURIComponent(url.pathname.slice(1)) || "index.html";
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status:403, body:"blocked" });
    try { const body = await fs.readFile(file); const ext = path.extname(file); return route.fulfill({ status:200, contentType:ext===".html"?"text/html; charset=utf-8":ext===".js"?"text/javascript; charset=utf-8":ext===".css"?"text/css; charset=utf-8":"application/octet-stream", body }); }
    catch { return route.fulfill({ status:404, body:"missing test asset" }); }
  });
  return { errors, blocked, dialogs };
}
for (const pageName of ["admin-review.html", "driver-register.html"]) {
 test(`OPS-64 candidate blocks duplicate passport approval in ${pageName}`, async ({ page }) => {
   const result = await isolate(page, () => {
     if (localStorage.getItem("TEST-OPS64-PASSPORT-SETUP") === "done") return;
     localStorage.clear(); sessionStorage.clear();
     localStorage.setItem("TEST-OPS64-PASSPORT-SETUP", "done");
     localStorage.setItem("personnelRecords", JSON.stringify([
       { personId:"TEST-OPS64-OWNER", name:"TEST护照旧档", phone:"TEST-OPS64-OWNER-PHONE", position:"汽车司机", team:"生产A组", department:"生产组", passportNumber:"   ", passport:"TEST-OPS64-LEGACY-PASSPORT-002", status:"approved", approvalStatus:"approved", personnelStatus:"在职可用", testFixture:true },
       { personId:"TEST-OPS64-CANDIDATE", name:"TEST待审护照", phone:"TEST-OPS64-CANDIDATE-PHONE", position:"汽车司机", team:"生产A组", department:"生产组", passportNumber:"TEST-OPS64-LEGACY-PASSPORT-002", status:"pending", approvalStatus:"pending", personnelStatus:"待审核", testFixture:true },
       { personId:"TEST-OPS64-ADMIN", name:"TEST管理员", phone:"TEST-OPS64-ADMIN-PHONE", position:"管理员", status:"approved", approvalStatus:"approved", personnelStatus:"在职可用", testFixture:true }
     ]));
     localStorage.setItem("adminPersonId", "TEST-OPS64-ADMIN");
     localStorage.setItem("selectedPosition", "管理员");
     sessionStorage.setItem("managementSession", JSON.stringify({verified:true,personId:"TEST-OPS64-ADMIN",position:"管理员",expiresAt:Date.now()+3600000,testFixture:true}));
     localStorage.setItem("TEST-OPS64-PASSPORT-SETUP", "done");
   });
   await page.goto(`${ORIGIN}/${pageName}`);
   const row=page.locator("#personnelTableBody tr").filter({hasText:"TEST待审护照"});
   await expect(row).toBeVisible(); await row.click(); await page.locator("#approveButton").click();
   const state=await page.evaluate(()=>JSON.parse(localStorage.getItem("personnelRecords")||"[]").find(x=>x.personId==="TEST-OPS64-CANDIDATE"));
   console.log("approval probe", pageName, state, result.dialogs, await page.url(), result.errors, result.blocked); expect(state.approvalStatus).toBe("pending"); expect(result.dialogs.some(message => message.includes("证件号已存在"))).toBe(true);
   expect(result.errors).toEqual([]); expect(result.blocked).toEqual([]);
 });
}
test("OPS-64 candidate blocks duplicate passport registration in person-register.html", async ({ page }) => {
 const result=await isolate(page,()=>{
   if (localStorage.getItem("TEST-OPS64-PASSPORT-SETUP") === "done") return;
     localStorage.clear(); sessionStorage.clear();
     localStorage.setItem("TEST-OPS64-PASSPORT-SETUP", "done");
   localStorage.setItem("personnelRecords",JSON.stringify([{personId:"TEST-OPS64-OWNER",name:"TEST护照旧档",phone:"TEST-OPS64-OWNER-PHONE",position:"汽车司机",passportNumber:"   ",passport:"TEST-OPS64-LEGACY-PASSPORT-003",status:"active",approvalStatus:"approved",personnelStatus:"在职可用",testFixture:true}]));
 });
 await page.goto(`${ORIGIN}/person-register.html?position=${encodeURIComponent("汽车司机")}`);
 await page.locator("#name").fill("TEST重复护照申请");
 await page.locator("#phone").fill("13800000003");
 await page.locator("#team").selectOption("生产A组");
 await page.locator("#selfiePhoto").setInputFiles({name:"test.png",mimeType:"image/png",buffer:PNG});
 await page.locator("#emergencyContact").fill("TEST联系人");
 await page.locator("#emergencyPhone").fill("13900000003");
 await page.locator("#passportNumber").fill("TEST-OPS64-LEGACY-PASSPORT-003");
 await page.locator("#passportPhoto").setInputFiles({name:"passport.png",mimeType:"image/png",buffer:PNG});
 await page.locator("#submitButton").click();
 await expect(page).toHaveURL(/person-register\.html/);
 const state=await page.evaluate(()=>({queue:JSON.parse(localStorage.getItem("mineDataPendingQueue")||"[]"),rows:JSON.parse(localStorage.getItem("personnelRecords")||"[]")}));
 console.log("registration probe", await page.url(), result.dialogs, await page.evaluate(()=>({keys:Object.keys(localStorage),queue:JSON.parse(localStorage.getItem("mineDataPendingQueue")||"[]"),rows:JSON.parse(localStorage.getItem("personnelRecords")||"[]")})), result.errors, result.blocked); expect(state.queue.some(x=>x.payload?.name==="TEST重复护照申请")||state.rows.some(x=>x.name==="TEST重复护照申请")).toBe(false); expect(result.dialogs.some(message => message.includes("护照号已存在"))).toBe(true);
 expect(result.errors).toEqual([]); expect(result.blocked).toEqual([]);
});






