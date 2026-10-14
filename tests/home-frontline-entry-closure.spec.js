"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

async function attachSnapshotRoutes(page, blocked) {
  await page.route("**/*", async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (!["GET", "HEAD"].includes(req.method()) || url.origin !== ORIGIN) {
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
}

test("TEST 首页一线岗位入口点击后进入对应登记页并带入正确岗位", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  await attachSnapshotRoutes(page, blocked);
  await page.goto(`${ORIGIN}/index.html`, { waitUntil: "domcontentloaded" });

  const directRoles = [
    { portal: "挖机司机", position: "挖机司机" },
    { portal: "汽车司机", position: "汽车司机" },
    { portal: "排土管理", position: "排土管理" }
  ];
  for (const item of directRoles) {
    await page.goto(`${ORIGIN}/index.html`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: new RegExp(item.portal) }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/person-register.html");
    await expect(page.locator("#position")).toHaveValue(item.position);
  }

  const auxiliaryRoles = ["铲车司机", "加油车司机", "大巴司机", "平路机司机", "洒水车司机", "推土机司机"];
      "维修管理", "维修员"
  for (const position of auxiliaryRoles) {
    await page.goto(`${ORIGIN}/index.html`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /辅助车辆/ }).click();
    await page.getByRole("button", { name: position, exact: true }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/person-register.html");
    await expect(page.locator("#position")).toHaveValue(position);
  }

  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});


test("TEST 首页已审核岗位按入口进入各自工作端", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    const positions = [
      "挖机司机", "汽车司机", "排土管理", "车队长",
      "铲车司机", "加油车司机", "大巴司机", "平路机司机", "洒水车司机", "推土机司机",
      "维修管理", "维修员"
    ];
    localStorage.setItem("personnelRecords", JSON.stringify(positions.map((position, index) => ({
      personId: `TEST-HOME-APPROVED-${index + 1}`,
      employeeNo: `TEST-HOME-APPROVED-${index + 1}`,
      name: `TEST${position}`,
      position,
      team: "生产A组",
      department: "生产A组",
      status: "approved",
      approvalStatus: "approved",
      personnelStatus: "在职可用",
      testFixture: true
    }))));
  });
  await attachSnapshotRoutes(page, blocked);

  const direct = [
    { entry: "挖机司机", expected: "/excavator.html" },
    { entry: "汽车司机", expected: "/driver-work.html" },
    { entry: "排土管理", expected: "/dump-management.html" },
    { entry: "车队长 / 调度", expected: "/dispatch.html" },
  ];
  for (const item of direct) {
    await page.goto(`${ORIGIN}/index.html`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: new RegExp(item.entry) }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(item.expected);
  }

  for (const position of ["铲车司机", "加油车司机", "大巴司机", "平路机司机", "洒水车司机", "推土机司机"]) {
      "维修管理", "维修员"
    await page.goto(`${ORIGIN}/index.html`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /辅助车辆/ }).click();
    await page.getByRole("button", { name: position, exact: true }).click();
    const expected = position === "加油车司机" ? "/fuel.html" : "/auxiliary.html";
    await expect.poll(() => new URL(page.url()).pathname).toBe(expected);
  }

  for (const [position, expected] of [["维修管理", "/maintenance.html"], ["维修员", "/maintenance-worker.html"]]) {
    await page.goto(`${ORIGIN}/index.html`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /维修端/ }).click();
    await page.getByRole("button", { name: position, exact: true }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(expected);
  }

  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
