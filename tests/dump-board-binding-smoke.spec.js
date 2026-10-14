"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const { installAGroupRobotContext } = require("./a-group-multi-robot-fixture");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST 调度在看板编辑中绑定独立排土管理人员", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (!['GET', 'HEAD'].includes(req.method()) || url.origin !== ORIGIN) {
      blocked.push(`${req.method()} ${req.url()}`);
      return route.abort();
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const body = await fs.readFile(file);
      const ext = path.extname(file);
      const contentType = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });
  await installAGroupRobotContext(page, "TEST-A-DISPATCH-001");
  await page.addInitScript(() => {
    // This case tests rebinding the saved board. Legacy fixture tasks are a
    // separate occupancy source and would make its already-bound excavators stale.
    localStorage.setItem("dispatchPublishedTasks", "[]");
    localStorage.setItem("dispatchShiftExecutions", "[]");
    localStorage.setItem("equipmentRecords", JSON.stringify([
      ...Array.from({ length: 2 }, (_, i) => ({ equipmentId: `TEST-A-EX-00${i + 1}`, equipmentNumber: `TEST-A-EX-00${i + 1}`, equipmentType: "挖掘机", status: "available", testFixture: true })),
      ...Array.from({ length: 6 }, (_, i) => ({ equipmentId: `TEST-A-T-00${i + 1}`, equipmentNumber: `TEST-A-T-00${i + 1}`, equipmentType: "矿卡", status: "available", testFixture: true }))
    ]));
    localStorage.setItem("transportZones", JSON.stringify([
      { zoneId: "TEST-LOAD-001", name: "TEST装载区", zoneType: "loading", enabled: true, testFixture: true },
      { zoneId: "TEST-UNLOAD-WASTE", name: "TEST排土场", zoneType: "unloading", materialType: "渣", enabled: true, testFixture: true }
    ]));
  });
  await page.addInitScript(() => {
    const equipment = JSON.parse(localStorage.getItem("equipmentRecords") || "[]");
    equipment.push({ equipmentId: "TEST-A-T-007", equipmentNumber: "TEST-A-T-007", equipmentType: "矿卡", status: "available", currentStatus: "可用", testFixture: true });
    localStorage.setItem("equipmentRecords", JSON.stringify(equipment));
    const people = JSON.parse(localStorage.getItem("personnelRecords") || "[]");
    people.push({ personId: "TEST-A-D-007", employeeId: "TEST-A-D-007", employeeNo: "TEST-A-D-007", name: "TEST-A组汽车司机07", position: "汽车司机", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true });
    localStorage.setItem("personnelRecords", JSON.stringify(people));
  });
  await page.goto(`${ORIGIN}/dispatch.html`, { waitUntil: "domcontentloaded" });
  const board = page.locator("#production-board");
  await expect(board.locator(".pb-tag")).toContainText("调度");
  await expect(board.locator(".pb-tag")).toContainText("看板 V2.0.13");
  await board.locator('[data-action="toggle"]').click();
  await expect(board.locator(".pb-trip-summary")).toBeVisible();
  await board.locator('[data-action="edit"]').first().click();
  const dialog = page.locator("dialog.pb-dialog");
  await expect(dialog.locator("h3")).toHaveText("选择本班生产班组");
  await dialog.locator('select[name="team"]').selectOption("A");
  await dialog.getByRole("button", { name: "确认" }).click();
  await expect(board.locator(".pb-trip-summary")).toBeHidden();

  const group = board.locator(".pb-group").first();
  const truckLabels = await group.locator(".pb-pair > strong.pb-muted").allTextContents();
  expect(truckLabels).toEqual(Array.from({ length: truckLabels.length }, (_, index) => `汽车${index + 1}`));
  await expect(group).toContainText("TEST-A组排土管理01");
  await group.locator('[data-action="remove-dump-person"]').click();
  await group.locator('[data-action="add-dump-person"]').click();
  await expect(dialog.locator("h3")).toHaveText("选择排土管理人员");
  const options = await dialog.locator('select[name="person"] option').allTextContents();
  expect(options.filter(text => text.trim())).toHaveLength(2);
  await dialog.locator('select[name="person"]').selectOption("TEST-A-DUMP-MGR-001");
  await dialog.getByRole("button", { name: "确认" }).click();
  await expect(group).toContainText("TEST-A组排土管理01");

  await group.locator("[data-action=add-truck]").click();
  let labels = await group.locator(".pb-pair > strong.pb-muted").allTextContents();
  expect(labels).toEqual(Array.from({ length: truckLabels.length + 1 }, (_, index) => `汽车${index + 1}`));
  await group.locator(".pb-pair").last().locator("[data-action=choose-equipment]").click();
  const equipmentChoices = await dialog.locator("select[name=value] option").evaluateAll(rows => rows.map(row => row.value).filter(Boolean));
  expect(equipmentChoices).toEqual(["TEST-A-T-007"]);
  await dialog.locator("select[name=value]").selectOption({ index: 1 });
  await dialog.getByRole("button", { name: "确认" }).click();
  await group.locator(".pb-pair").last().locator("[data-action=choose-person]").click();
  const personChoices = await dialog.locator("select[name=value] option").evaluateAll(rows => rows.map(row => row.value).filter(Boolean));
  expect(personChoices).toEqual(["TEST-A-D-007"]);
  await dialog.locator("select[name=value]").selectOption({ index: 1 });
  await dialog.getByRole("button", { name: "确认" }).click();
  labels = await group.locator(".pb-pair > strong.pb-muted").allTextContents();
  expect(labels).toEqual(Array.from({ length: truckLabels.length + 1 }, (_, index) => `汽车${index + 1}`));
  await group.locator("[data-action=remove-pair]").last().click();
  labels = await group.locator(".pb-pair > strong.pb-muted").allTextContents();
  expect(labels).toEqual(truckLabels);
  await board.locator('[data-action="publish"]').click();
  console.log("TEST dump board publish result:", JSON.stringify(await page.evaluate(() => ({ text: document.querySelector('#production-board')?.innerText, state: JSON.parse(localStorage.getItem('mineProductionBoardV2') || 'null') }))));
  await expect(board.locator(".pb-trip-summary")).toBeVisible();
  await expect(board).toContainText("未分配一线人员（司机和排土管理）");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("mineProductionBoardV2")));
  const active = Object.values(saved.boards).find(item => item.published);
  expect(saved.revision).toBe(2);
  expect(active.groups[0].dumpManagementPeople).toEqual(["TEST-A-DUMP-MGR-001"]);
  expect(saved.audit.at(-1).action).toBe("绑定并发布");
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});


