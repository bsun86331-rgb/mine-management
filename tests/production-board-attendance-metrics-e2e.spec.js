"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const { installAGroupRobotContext } = require("./a-group-multi-robot-fixture");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST生产看板分别统计已出勤、请假和待审核人员", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!["GET", "HEAD"].includes(request.method()) || url.origin !== ORIGIN) {
      blocked.push(`${request.method()} ${request.url()}`);
      return route.abort();
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const ext = path.extname(file).toLowerCase();
      const contentType = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body: await fs.readFile(file) });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  const { payload } = await installAGroupRobotContext(page, "TEST-A-DISPATCH-001");
  await page.addInitScript(() => {
    const state = JSON.parse(localStorage.getItem("mineProductionBoardV2"));
    const board = Object.values(state.boards).find(item => item.published);
    const startKey = board.shift === "白班" ? "dayStart" : "dayEnd";
    const [hour, minute] = state.schedule[startKey].split(":").map(Number);
    const start = new Date(`${board.date}T00:00:00`);
    start.setHours(hour + 1, minute, 0, 0);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const firstId = "TEST-A-D-001";
    const leaveId = "TEST-A-D-002";
    const attendance = JSON.parse(localStorage.getItem("attendanceRecords") || "[]").filter(row => ![firstId, leaveId].includes(row.personId));
    attendance.push(
      { attendanceId: "TEST-ATTEND-PRESENT", personId: firstId, date: board.date, shift: board.shift, status: "confirmed", checkInAt: start.toISOString(), testFixture: true },
      { attendanceId: "TEST-ATTEND-LEAVE", personId: leaveId, date: board.date, shift: board.shift, status: "confirmed", checkInAt: start.toISOString(), testFixture: true }
    );
    localStorage.setItem("attendanceRecords", JSON.stringify(attendance));
    const leaves = JSON.parse(localStorage.getItem("leaveRequests") || "[]").filter(row => row.personId !== leaveId);
    leaves.push({ leaveId: "TEST-LEAVE-APPROVED", personId: leaveId, status: "approved", startTime: start.toISOString(), endTime: end.toISOString(), testFixture: true });
    localStorage.setItem("leaveRequests", JSON.stringify(leaves));
    const people = JSON.parse(localStorage.getItem("personnelRecords") || "[]");
    people.push({ personId: "TEST-PENDING-DRIVER", name: "TEST待审核司机", position: "汽车司机", team: "生产A组", status: "pending", approvalStatus: "pending", personnelStatus: "待审核", testFixture: true });
    localStorage.setItem("personnelRecords", JSON.stringify(people));
  });

  await page.goto(`${ORIGIN}/dispatch.html`, { waitUntil: "domcontentloaded" });
  const board = page.locator("#production-board");
  await board.locator('[data-action="toggle"]').click();
  const values = await board.locator(".pb-metrics").evaluateAll(groups => {
    const result = {};
    for (const group of groups) for (const metric of group.querySelectorAll(".pb-metric")) {
      const label = metric.querySelector("span")?.textContent.trim();
      if (label) result[label] = metric.querySelector("strong")?.textContent.trim();
    }
    return result;
  });
  const approvedPeople = payload.personnel.filter(person => person.approvalStatus === "approved").length;
  expect(values["人员总数"]).toBe(String(approvedPeople));
  expect(values["考勤出勤"]).toBe("1");
  expect(values["请假"]).toBe("1");
  expect(values["人员出勤率"]).toBe(`${(100 / approvedPeople).toFixed(1)}%`);
  expect(values["生产组绑定人员"]).toBe("9");
  expect(await board.locator(".pb-unassigned").allTextContents()).not.toContain("TEST待审核司机");
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
