"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

async function attachSnapshotRoutes(page, blocked) {
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!["GET", "HEAD"].includes(request.method()) || url.origin !== ORIGIN) {
      blocked.push(request.method() + " " + request.url());
      return route.abort();
    }
    const relative = decodeURIComponent(url.pathname).split("/").filter(Boolean).join("/") || "index.html";
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const ext = path.extname(file);
      const type = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType: type, body: await fs.readFile(file) });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });
}

test("TEST调度作业页面仅允许已审核的车队长身份进入", async ({ page }) => {
  const blocked = [];
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await attachSnapshotRoutes(page, blocked);
  await page.addInitScript(() => {
    if (localStorage.getItem("personnelRecords")) return;
    const driver = { personId: "TEST-DISPATCH-DRIVER-001", name: "TEST司机", position: "汽车司机", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用" };
    const dispatcher = { personId: "TEST-DISPATCH-LEAD-001", name: "TEST车队长", position: "车队长", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用" };
    localStorage.setItem("personnelRecords", JSON.stringify([driver, dispatcher]));
    localStorage.setItem("dispatchPublishedTasks", "[]");
    localStorage.setItem("driverTripRecords", "[]");
    localStorage.setItem("leaveRequests", "[]");
    localStorage.setItem("penaltyRecords", "[]");
    localStorage.setItem("currentPersonId", driver.personId);
    localStorage.setItem("selectedPosition", driver.position);
  });

  await page.goto(ORIGIN + "/dispatch.html", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(url => url.pathname.endsWith("/index.html"));

  await page.evaluate(() => {
    localStorage.setItem("currentPersonId", "TEST-DISPATCH-LEAD-001");
    localStorage.setItem("selectedPosition", "车队长");
  });
  await page.goto(ORIGIN + "/dispatch.html", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(url => url.pathname.endsWith("/dispatch.html"));
  await expect(page.locator("body")).toContainText("生产调度中心");
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
