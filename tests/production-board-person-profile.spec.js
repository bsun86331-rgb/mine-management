"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const { installAGroupRobotContext } = require("./a-group-multi-robot-fixture");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST生产任务看板人员信息显示登记的电话号码和头像", async ({ page }) => {
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

  await installAGroupRobotContext(page, "TEST-A-DISPATCH-001");
  await page.addInitScript(() => {
    const people = JSON.parse(localStorage.getItem("personnelRecords") || "[]");
    const person = people.find(item => item.personId === "TEST-A-D-001");
    if (!person) throw new Error("TEST司机档案不存在");
    person.phone = "TEST-13800000001";
    person.avatarPhoto = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
    localStorage.setItem("personnelRecords", JSON.stringify(people));
  });
  await page.goto(`${ORIGIN}/dispatch.html`, { waitUntil: "domcontentloaded" });
  const board = page.locator("#production-board");
  await board.locator('[data-action="toggle"]').click();
  await board.locator('[data-action="person-info"][data-id="TEST-A-D-001"]').click();

  const dialog = page.locator("dialog").last();
  await expect(dialog).toContainText("TEST-13800000001");
  await expect(dialog.locator("img")).toHaveAttribute("src", /^data:image\/gif;base64,/);
  await expect(dialog.locator("img")).toHaveAttribute("alt", "TEST-A组汽车司机01头像");
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

