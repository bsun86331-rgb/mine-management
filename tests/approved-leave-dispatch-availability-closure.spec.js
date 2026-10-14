"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");
const DATE = "2026-10-20";

test("TEST已批准请假按班次时间阻止绑定，离开时段后仍可调配", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(date => {
    localStorage.clear();
    sessionStorage.clear();
    const people = [
      { personId: "TEST-LEAVE-DISPATCH-LEAD", employeeNo: "TEST-LEAVE-DISPATCH-LEAD", name: "TEST调度", position: "车队长", team: "管理组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true },
      { personId: "TEST-LEAVE-DISPATCH-EXD", employeeNo: "TEST-LEAVE-DISPATCH-EXD", name: "TEST挖机司机", position: "挖机司机", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true },
      { personId: "TEST-LEAVE-DISPATCH-DAY", employeeNo: "TEST-LEAVE-DISPATCH-DAY", name: "TEST白班请假司机", position: "汽车司机", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true },
      { personId: "TEST-LEAVE-DISPATCH-BACKUP", employeeNo: "TEST-LEAVE-DISPATCH-BACKUP", name: "TEST可调配司机", position: "汽车司机", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true }
    ];
    localStorage.setItem("personnelRecords", JSON.stringify(people));
    localStorage.setItem("currentPersonId", "TEST-LEAVE-DISPATCH-LEAD");
    localStorage.setItem("selectedPosition", "车队长");
    localStorage.setItem("rolePersonIds", JSON.stringify({ "车队长": "TEST-LEAVE-DISPATCH-LEAD" }));
    localStorage.setItem("dispatchUserProfile", JSON.stringify({ personId: "TEST-LEAVE-DISPATCH-LEAD", employeeId: "TEST-LEAVE-DISPATCH-LEAD" }));
    localStorage.setItem("equipmentRecords", JSON.stringify([
      { equipmentId: "TEST-LEAVE-DISPATCH-EX", equipmentNumber: "TEST-LEAVE-DISPATCH-EX", equipmentType: "挖掘机", status: "available", testFixture: true },
      { equipmentId: "TEST-LEAVE-DISPATCH-TRUCK", equipmentNumber: "TEST-LEAVE-DISPATCH-TRUCK", equipmentType: "矿卡", status: "available", testFixture: true }
    ]));
    const attendance = people
      .filter(person => ["TEST-LEAVE-DISPATCH-EXD", "TEST-LEAVE-DISPATCH-DAY", "TEST-LEAVE-DISPATCH-BACKUP"].includes(person.personId))
      .flatMap(person => ["白班", "夜班"].map(shift => ({
        attendanceId: `TEST-ATT-${person.personId}-${shift}`,
        personId: person.personId,
        date,
        shift,
        status: "present",
        checkInAt: `${date}T08:00:00`,
        testFixture: true
      })));
    localStorage.setItem("attendanceRecords", JSON.stringify(attendance));
    localStorage.setItem("leaveRequests", JSON.stringify([{
      leaveId: "TEST-APPROVED-LEAVE-DAY",
      applicantId: "TEST-LEAVE-DISPATCH-DAY",
      personId: "TEST-LEAVE-DISPATCH-DAY",
      applicantName: "TEST白班请假司机",
      position: "汽车司机",
      team: "生产A组",
      leaveType: "事假",
      startTime: `${date}T08:00:00`,
      endTime: `${date}T20:00:00`,
      status: "approved",
      approverRole: "dispatch",
      testFixture: true
    }]));
  }, DATE);
  await page.route("**/*", async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (!["GET", "HEAD"].includes(req.method()) || url.origin !== ORIGIN) {
      blocked.push(`${req.method()} ${req.url()}`);
      return route.abort();
    }
    const file = path.resolve(ROOT, decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html");
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const body = await fs.readFile(file);
      const ext = path.extname(file);
      return route.fulfill({ status: 200, contentType: ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream", body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  async function getTruckDriverChoices(shift) {
    const board = page.locator("#production-board");
    if (await board.locator('[data-action="toggle"]').isVisible()) await board.locator('[data-action="toggle"]').click();
    await board.locator('input[data-action="date"]').fill(DATE);
    await board.locator(`[data-action="shift"][data-shift="${shift}"]`).click();
    await board.locator('[data-action="edit"]').first().click();
    const dialog = page.locator("dialog.pb-dialog");
    await dialog.locator('select[name="team"]').selectOption("A");
    await dialog.getByRole("button", { name: "确认" }).click();
    await board.locator('[data-action="add-group"]').click();
    const group = board.locator(".pb-group").first();
    await group.locator('[data-action="add-truck"]').click();
    await group.locator('[data-kind="truck"][data-action="choose-person"]').last().click();
    const picker = page.locator("dialog.pb-dialog");
    const values = await picker.locator('select[name="value"] option').evaluateAll(options => options.map(option => option.value).filter(Boolean));
    await picker.locator("[data-close]").click();
    return values;
  }

  await page.goto(`${ORIGIN}/dispatch.html`, { waitUntil: "domcontentloaded" });
  const dayChoices = await getTruckDriverChoices("白班");
  expect(dayChoices).toEqual(["TEST-LEAVE-DISPATCH-BACKUP"]);

  await page.reload({ waitUntil: "domcontentloaded" });
  const nightChoices = await getTruckDriverChoices("夜班");
  expect(nightChoices).toEqual(["TEST-LEAVE-DISPATCH-DAY", "TEST-LEAVE-DISPATCH-BACKUP"]);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

