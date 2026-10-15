"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

async function installIsolatedSite(page) {
  const blocked = [];
  const errors = [];
  const dialogs = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => {
    dialogs.push(dialog.message());
    await dialog.accept();
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
    if (!file.startsWith(ROOT + path.sep)) {
      return route.fulfill({ status: 403, body: "blocked" });
    }
    try {
      const ext = path.extname(file).toLowerCase();
      const contentType = ({
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8"
      })[ext] || "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body: await fs.readFile(file) });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });
  return { blocked, errors, dialogs };
}

async function seedIdentity(page, identity) {
  await page.addInitScript(value => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("personnelRecords", JSON.stringify([{
      personId: value.personId,
      employeeNo: value.personId,
      name: value.name,
      position: value.recordPosition,
      status: value.status,
      approvalStatus: value.approvalStatus,
      personnelStatus: value.personnelStatus || ""
    }]));
    localStorage.setItem("currentPersonId", value.personId);
    localStorage.setItem("selectedPosition", value.selectedPosition);
  }, identity);
}

test("TEST司机不能直接进入调度操作页", async ({ page }) => {
  const state = await installIsolatedSite(page);
  await seedIdentity(page, {
    personId: "TEST-DISPATCH-ACCESS-DRIVER",
    name: "TEST汽车司机",
    recordPosition: "汽车司机",
    selectedPosition: "汽车司机",
    status: "approved",
    approvalStatus: "approved"
  });

  await page.goto(ORIGIN + "/dispatch.html", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/index\.html$/);
  expect(state.dialogs).toContain("调度操作页仅对已审核的车队长 / 调度员开放，请从首页进入你的岗位页面。");
  await expect(page.getByRole("heading", { name: /生产调度中心/ })).toHaveCount(0);
  expect(state.errors).toEqual([]);
  expect(state.blocked).toEqual([]);
});

test("TEST司机不能伪造车队长所选岗位进入调度操作页", async ({ page }) => {
  const state = await installIsolatedSite(page);
  await seedIdentity(page, {
    personId: "TEST-DISPATCH-ACCESS-SPOOF",
    name: "TEST岗位错配司机",
    recordPosition: "汽车司机",
    selectedPosition: "车队长",
    status: "approved",
    approvalStatus: "approved"
  });

  await page.goto(ORIGIN + "/dispatch.html", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/index\.html$/);
  expect(state.dialogs).toContain("调度操作页仅对已审核的车队长 / 调度员开放，请从首页进入你的岗位页面。");
  await expect(page.getByRole("heading", { name: /生产调度中心/ })).toHaveCount(0);
  expect(state.errors).toEqual([]);
  expect(state.blocked).toEqual([]);
});

test("TEST待审核车队长不能进入调度操作页", async ({ page }) => {
  const state = await installIsolatedSite(page);
  await seedIdentity(page, {
    personId: "TEST-DISPATCH-ACCESS-PENDING",
    name: "TEST待审核车队长",
    recordPosition: "车队长",
    selectedPosition: "车队长",
    status: "pending",
    approvalStatus: "pending"
  });

  await page.goto(ORIGIN + "/dispatch.html", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/index\.html$/);
  expect(state.dialogs).toContain("调度操作页仅对已审核的车队长 / 调度员开放，请从首页进入你的岗位页面。");
  await expect(page.getByRole("heading", { name: /生产调度中心/ })).toHaveCount(0);
  expect(state.errors).toEqual([]);
  expect(state.blocked).toEqual([]);
});

test("TEST已审核车队长可以进入调度操作页", async ({ page }) => {
  const state = await installIsolatedSite(page);
  await seedIdentity(page, {
    personId: "TEST-DISPATCH-ACCESS-APPROVED",
    name: "TEST已审核车队长",
    recordPosition: "车队长",
    selectedPosition: "车队长",
    status: "approved",
    approvalStatus: "approved"
  });

  await page.goto(ORIGIN + "/dispatch.html", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/dispatch\.html$/);
  await expect(page.getByRole("heading", { name: /生产调度中心/ })).toBeVisible();
  expect(state.errors).toEqual([]);
  expect(state.blocked).toEqual([]);
});


test("TEST已审核调度员可以进入调度操作页", async ({ page }) => {
  const state = await installIsolatedSite(page);
  await seedIdentity(page, {
    personId: "TEST-DISPATCH-ACCESS-OPERATOR",
    name: "TEST已审核调度员",
    recordPosition: "调度员",
    selectedPosition: "调度员",
    status: "approved",
    approvalStatus: "approved"
  });

  await page.goto(ORIGIN + "/dispatch.html", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/dispatch\\.html$/);
  await expect(page.getByRole("heading", { name: /生产调度中心/ })).toBeVisible();
  expect(state.errors).toEqual([]);
  expect(state.blocked).toEqual([]);
});
