"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

async function openFixture(page, blocked, dialogs) {
  page.on("pageerror", error => blocked.push("pageerror " + error.message));
  page.on("dialog", async dialog => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    await dialog.accept();
  });

  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("transportZones", JSON.stringify([
      { zoneId: "TEST-BASE-ZONE", name: "TEST原始区域" }
    ]));
    localStorage.setItem("dispatchPublishedTasks", JSON.stringify([
      { taskId: "TEST-BASE-TASK", name: "TEST原始任务" }
    ]));
    localStorage.setItem("dispatchShiftExecutions", JSON.stringify([
      { shiftId: "TEST-BASE-SHIFT", taskId: "TEST-BASE-TASK" }
    ]));
    localStorage.setItem("tripRecords", "{TEST-preserve-malformed-value");
    localStorage.setItem("personnelRecords", JSON.stringify([
      { personId: "TEST-BASE-PERSON", name: "TEST原始人员" }
    ]));
    localStorage.setItem("equipmentRecords", JSON.stringify([
      { equipmentId: "TEST-BASE-EQUIPMENT", equipmentNumber: "TEST-BASE-EQUIPMENT" }
    ]));
    localStorage.setItem("TEST-fixture-unrelated-sentinel", "preserve-exactly");
  });

  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!["GET", "HEAD"].includes(request.method()) || url.origin !== ORIGIN) {
      blocked.push(request.method() + " " + request.url());
      return route.abort();
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const ext = path.extname(file).toLowerCase();
      return route.fulfill({
        status: 200,
        contentType: ext === ".html" ? "text/html; charset=utf-8" : "application/octet-stream",
        body: await fs.readFile(file)
      });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  await page.goto(ORIGIN + "/transport-test-fixture.html", { waitUntil: "domcontentloaded" });
}

async function snapshot(page) {
  return page.evaluate(() =>
    JSON.stringify(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]))
  );
}

test("TEST运输异常场景工具生成标准夹具后能逐字恢复原浏览器数据", async ({ page }) => {
  const blocked = [];
  const dialogs = [];
  await openFixture(page, blocked, dialogs);
  const before = await snapshot(page);

  await page.getByRole("button", { name: /备份并生成标准测试数据/ }).click();
  await expect(page.locator("#logBox")).toContainText("标准测试数据已生成");
  const generated = await page.evaluate(() => ({
    backup: localStorage.getItem("__transportP0TestBackupV1"),
    zones: JSON.parse(localStorage.getItem("transportZones") || "[]"),
    tasks: JSON.parse(localStorage.getItem("dispatchPublishedTasks") || "[]"),
    shifts: JSON.parse(localStorage.getItem("dispatchShiftExecutions") || "[]"),
    people: JSON.parse(localStorage.getItem("personnelRecords") || "[]"),
    equipment: JSON.parse(localStorage.getItem("equipmentRecords") || "[]")
  }));
  expect(generated.backup).toBeTruthy();
  expect(generated.zones.some(row => row.zoneId === "TEST-LOAD-001")).toBe(true);
  expect(generated.tasks.some(row => row.taskId === "TEST-TASK-001")).toBe(true);
  expect(generated.shifts.some(row => row.shiftId === "TEST-SHIFT-001")).toBe(true);
  expect(generated.people.some(row => row.personId === "TEST-D-001" && row.testFixture)).toBe(true);
  expect(generated.equipment.some(row => row.equipmentNumber === "TEST-T-001" && row.testFixture)).toBe(true);

  await page.getByRole("button", { name: "恢复生成前原数据" }).click();
  await expect.poll(() => snapshot(page)).toBe(before);
  expect(dialogs.some(item => item.type === "confirm")).toBe(true);
  expect(await page.locator("#logBox").textContent()).toContain("已恢复测试前原数据");
  expect(blocked).toEqual([]);
});

test("TEST运输异常场景工具重复生成夹具不会覆盖首次原数据备份", async ({ page }) => {
  const blocked = [];
  const dialogs = [];
  await openFixture(page, blocked, dialogs);
  const before = await snapshot(page);

  await page.getByRole("button", { name: /备份并生成标准测试数据/ }).click();
  const firstBackup = await page.evaluate(() => localStorage.getItem("__transportP0TestBackupV1"));
  await page.evaluate(() => {
    const people = JSON.parse(localStorage.getItem("personnelRecords") || "[]");
    people.push({ personId: "TEST-INTERVENING-PERSON", name: "TEST中途资料" });
    localStorage.setItem("personnelRecords", JSON.stringify(people));
  });

  await page.getByRole("button", { name: /备份并生成标准测试数据/ }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("__transportP0TestBackupV1"))).toBe(firstBackup);
  await page.getByRole("button", { name: "恢复生成前原数据" }).click();
  await expect.poll(() => snapshot(page)).toBe(before);
  expect(blocked).toEqual([]);
});
