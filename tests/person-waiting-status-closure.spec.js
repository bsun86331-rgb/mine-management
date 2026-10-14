"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST待审核页面覆盖等待、驳回修改重提和审核通过进入工作端", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    if (localStorage.getItem("TEST-WAITING-STATUS-SETUP") === "1") return;
    const applicant = {
      personId: "TEST-WAITING-APPLICANT-001",
      employeeNo: "TEST-WAITING-APPLICANT-001",
      name: "TEST等待状态司机",
      phone: "13800000001",
      position: "汽车司机",
      team: "生产A组",
      idCardNumber: "",
      passportNumber: "TEST-WAITING-PASSPORT-001",
      rejectReason: "TEST证件照片不清晰，请重新上传",
      status: "pending",
      approvalStatus: "pending",
      personnelStatus: "待审核",
      testFixture: true
    };
    const admin = {
      personId: "TEST-WAITING-ADMIN-001",
      employeeNo: "TEST-WAITING-ADMIN-001",
      name: "TEST等待状态管理员",
      position: "管理员",
      status: "approved",
      approvalStatus: "approved",
      personnelStatus: "在职可用",
      testFixture: true
    };
    localStorage.setItem("personnelRecords", JSON.stringify([applicant, admin]));
    localStorage.setItem("waitingApplicantPersonId", applicant.personId);
    localStorage.setItem("waitingApplicantPosition", applicant.position);
    localStorage.setItem("currentPersonId", admin.personId);
    localStorage.setItem("selectedPosition", admin.position);
    localStorage.setItem("TEST-WAITING-STATUS-SETUP", "1");
  });
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
      const body = await fs.readFile(file);
      const ext = path.extname(file).toLowerCase();
      const contentType = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" }[ext] || "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  await page.goto(`${ORIGIN}/person-waiting.html`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#personName")).toHaveText("TEST等待状态司机");
  await expect(page.locator("#statusBadge")).toHaveText("待审核");
  await expect(page.locator("#enterWorkButton")).toBeHidden();
  await expect(page.locator("#editButton")).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem("currentPersonId"))).toBe("TEST-WAITING-APPLICANT-001");

  await page.evaluate(() => {
    const people = JSON.parse(localStorage.getItem("personnelRecords") || "[]");
    const applicant = people.find(person => person.personId === "TEST-WAITING-APPLICANT-001");
    applicant.status = "rejected";
    applicant.approvalStatus = "rejected";
    applicant.personnelStatus = "待修改";
    localStorage.setItem("personnelRecords", JSON.stringify(people));
  });
  await page.getByRole("button", { name: /手动刷新审核状态/ }).click();
  await expect(page.locator("#statusBadge")).toHaveText("已驳回");
  await expect(page.locator("#rejectReason")).toContainText("TEST证件照片不清晰，请重新上传");
  await expect(page.locator("#editButton")).toBeVisible();
  await expect(page.locator("#enterWorkButton")).toBeHidden();
  await page.locator("#editButton").click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/person-register.html");
  await expect(page.locator("#name")).toHaveValue("TEST等待状态司机");
  await expect(page.locator("#phone")).toHaveValue("13800000001");
  await expect(page.locator("#position")).toHaveValue("汽车司机");
  await expect(page.locator("#rejectNotice")).toBeVisible();

  await page.evaluate(() => {
    const people = JSON.parse(localStorage.getItem("personnelRecords") || "[]");
    const applicant = people.find(person => person.personId === "TEST-WAITING-APPLICANT-001");
    applicant.status = "approved";
    applicant.approvalStatus = "approved";
    applicant.personnelStatus = "在职可用";
    localStorage.setItem("personnelRecords", JSON.stringify(people));
  });
  await page.goto(`${ORIGIN}/person-waiting.html?personId=TEST-WAITING-APPLICANT-001`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#statusBadge")).toHaveText("已审核");
  await expect(page.locator("#enterWorkButton")).toBeVisible();
  await page.locator("#enterWorkButton").click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/driver-work.html");
  await expect(page.locator("#noTaskMessage")).toBeVisible();
  await expect(page.locator("#equipmentCheckButton")).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem("waitingApplicantPersonId"))).toBeNull();
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

