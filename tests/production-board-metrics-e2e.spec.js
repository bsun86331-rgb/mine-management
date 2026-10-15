"use strict";
const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const { installAGroupRobotContext } = require("./a-group-multi-robot-fixture");
const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");
test("TEST生产看板显示车辆、设备、人员和岗位汇总", async ({ page }) => {
  const errors = []; const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", async route => {
    const request = route.request(); const url = new URL(request.url());
    if (!["GET", "HEAD"].includes(request.method()) || url.origin !== ORIGIN) { blocked.push(`${request.method()} ${request.url()}`); return route.abort(); }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try { const ext = path.extname(file).toLowerCase(); const type = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream"; return route.fulfill({ status: 200, contentType: type, body: await fs.readFile(file) }); }
    catch { return route.fulfill({ status: 404, body: "missing test asset" }); }
  });
  const { payload } = await installAGroupRobotContext(page, "TEST-A-DISPATCH-001");
  const groups = [
    { id:"TEST-BOARD-GROUP-001", team:"A", excavatorId:"TEST-A-EX-001", excavatorDriverId:"TEST-A-EXD-001", trucks:[{equipmentId:"TEST-A-T-001",driverId:"TEST-A-D-001"},{equipmentId:"TEST-A-T-002",driverId:"TEST-A-D-002"},{equipmentId:"TEST-A-T-003",driverId:"TEST-A-D-003"}], dumpManagementPeople:["TEST-A-DUMP-MGR-001"], loadingZoneId:"TEST-LOAD-001", unloadingZoneIds:["TEST-UNLOAD-WASTE"] },
    { id:"TEST-BOARD-GROUP-002", team:"A", excavatorId:"TEST-A-EX-002", excavatorDriverId:"TEST-A-EXD-002", trucks:[{equipmentId:"TEST-A-T-004",driverId:"TEST-A-D-004"},{equipmentId:"TEST-A-T-005",driverId:"TEST-A-D-005"},{equipmentId:"TEST-A-T-006",driverId:"TEST-A-D-006"}], dumpManagementPeople:[], loadingZoneId:"TEST-LOAD-001", unloadingZoneIds:["TEST-UNLOAD-WASTE"] }
  ];
  await page.addInitScript(({ equipment, groups }) => {
    localStorage.setItem("equipmentRecords", JSON.stringify(equipment));
    const now = new Date(); const pad = n => String(n).padStart(2, "0");
    const keyDate = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    const minutes = now.getHours()*60 + now.getMinutes(); const dayStart=8*60, dayEnd=20*60;
    const date = new Date(now); if (minutes < dayStart) date.setDate(date.getDate()-1);
    const shift = minutes >= dayStart && minutes < dayEnd ? "白班" : "夜班"; const dateKey=keyDate(date);
    const board = { id:`BOARD-${dateKey}-${shift==="白班"?"D":"N"}`, date:dateKey, shift, groups, auxiliary:[], published:true, version:1, publishedAt:now.toISOString(), updatedAt:now.toISOString() };
    const state = { schemaVersion:2, revision:1, schedule:{dayStart:"08:00",dayEnd:"20:00",nightStart:"20:00",nightEnd:"08:00"}, boards:{[`${dateKey}|${shift}`]:board}, audit:[] };
    localStorage.setItem("mineProductionBoardV2", JSON.stringify(state));
    localStorage.setItem("transportZones", JSON.stringify([{zoneId:"TEST-LOAD-001",name:"TEST装载区",zoneType:"loading"},{zoneId:"TEST-UNLOAD-WASTE",name:"TEST排土场",zoneType:"unloading",materialType:"渣"}]));
    const relationId = "TEST-OPS58-SHIFT-B";
    localStorage.setItem("dispatchShiftExecutions", JSON.stringify([{ shift_id: relationId, task_id: "TEST-OPS58-TASK-B", production_team: "生产B组", extra: { material_type: "煤" }, status: "published", testFixture: true }]));
    localStorage.setItem("tripRecords", JSON.stringify([{ tripId: "TEST-OPS58-TRIP-B-COAL", shift_id: relationId, completedAt: now.toISOString(), status: "completed", testFixture: true }]));
  }, { equipment: payload.equipment, groups });
  await page.goto(`${ORIGIN}/dispatch.html`, { waitUntil: "domcontentloaded" });
  const board = page.locator("#production-board"); await board.locator('[data-action="toggle"]').click();
  const values = await board.locator(".pb-metrics").evaluateAll(groups => { const result={}; for(const group of groups) for(const metric of group.querySelectorAll(".pb-metric")){const label=metric.querySelector("span")?.textContent.trim();const value=metric.querySelector("strong")?.textContent.trim();if(label)result[label]=value;} return result; });
  const tripValues = await board.locator(".pb-trip-summary .pb-metric").evaluateAll(metrics => { const result={}; for(const metric of metrics){const label=metric.querySelector("span")?.textContent.trim();const value=metric.querySelector("strong")?.textContent.trim();if(label)result[label]=value;} return result; });
  const currentBoard = await page.evaluate(() => {const state=JSON.parse(localStorage.getItem("mineProductionBoardV2")||"{}");return Object.values(state.boards||{}).find(item=>item.published);});
  expect(currentBoard).toBeTruthy();
  expect(tripValues["当日总趟数"]).toBe("1");
  expect(tripValues["B组总趟数"]).toBe("1");
  expect(tripValues["B组煤总趟数"]).toBe("1");
  expect(tripValues["A组总趟数"]).toBe("0");
  const assignedPeople = new Set(currentBoard.groups.flatMap(group => [group.excavatorDriverId, ...group.trucks.map(truck=>truck.driverId), ...(group.dumpManagementPeople||[])]).filter(Boolean));
  expect(values["汽车总数（辆）"]).toBe("6"); expect(values["出勤作业（辆）"]).toBe("6"); expect(values["全部设备（台）"]).toBe("8");
  expect(values["生产组绑定人员"]).toBe(String(assignedPeople.size)); await expect(board).toContainText("挖机司机 2 人 · 汽车司机 6 人 · 排土管理 1 人");
  expect(values["人员总数"]).toBe(String(payload.personnel.length)); expect(errors).toEqual([]); expect(blocked).toEqual([]);
});


