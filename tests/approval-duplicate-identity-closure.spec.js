"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");
const scenarios = [
  {
    page: "admin-review.html",
    label: "管理员审核拦截带零宽字符的重复身份证",
    owner: { idCardNumber: "TEST-ID-APPROVAL-001" },
    candidate: { idCardNumber: "TEST-ID-APPROVAL-\u200b001" },
    approved: false
  },
  {
    page: "driver-register.html",
    label: "司机审核拦截带格式字符的重复护照号",
    owner: { passportNumber: "TEST-PASSPORT-APPROVAL-001" },
    candidate: { passportNumber: "TEST-PASSPORT-APPROVAL-\u2060001" },
    approved: false
  },
  {
    page: "admin-review.html",
    label: "管理员审核允许不同身份证",
    owner: { idCardNumber: "TEST-ID-APPROVAL-001" },
    candidate: { idCardNumber: "TEST-ID-DISTINCT-002" },
    approved: true
  },
  {
    page: "driver-register.html",
    label: "司机审核允许不同护照号",
    owner: { passportNumber: "TEST-PASSPORT-APPROVAL-001" },
    candidate: { passportNumber: "TEST-PASSPORT-DISTINCT-002" },
    approved: true
  }
];

for (const scenario of scenarios) {
  test(`TEST${scenario.label}`, async ({ page }) => {
    const dialogs = [];
    const errors = [];
    const blocked = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("dialog", async dialog => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });
    await page.addInitScript(({ owner, candidate }) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem("personnelRecords", JSON.stringify([
        { personId: "TEST-OPS62-OWNER", name: "TEST原证件人员", position: "汽车司机", team: "生产A组", ...owner, status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true },
        { personId: "TEST-OPS62-CANDIDATE", name: "TEST待审人员", position: "汽车司机", team: "生产A组", ...candidate, status: "pending", approvalStatus: "pending", personnelStatus: "待审核", testFixture: true },
        { personId: "TEST-OPS62-ADMIN", name: "TEST管理员", position: "管理员", team: "后勤办公组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true }
      ]));
      localStorage.setItem("adminPersonId", "TEST-OPS62-ADMIN");
      localStorage.setItem("selectedPosition", "管理员");
      sessionStorage.setItem("managementSession", JSON.stringify({ verified: true, personId: "TEST-OPS62-ADMIN", position: "管理员", expiresAt: Date.now() + 3600000, testFixture: true }));
    }, { owner: scenario.owner, candidate: scenario.candidate });
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
        const contentType = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" }[ext] || "application/octet-stream";
        return route.fulfill({ status: 200, contentType, body: await fs.readFile(file) });
      } catch {
        return route.fulfill({ status: 404, body: "missing test asset" });
      }
    });

    await page.goto(`${ORIGIN}/${scenario.page}`);
    const row = page.locator("#personnelTableBody tr").filter({ hasText: "TEST待审人员" });
    await expect(row).toBeVisible();
    await row.click();
    await page.locator("#approveButton").click();

    const state = await page.evaluate(() => {
      const candidate = JSON.parse(localStorage.getItem("personnelRecords") || "[]")
        .find(person => person.personId === "TEST-OPS62-CANDIDATE");
      return { approvalStatus: candidate?.approvalStatus, status: candidate?.status, personnelStatus: candidate?.personnelStatus };
    });
    const isApproved = state.approvalStatus === "approved" || state.status === "approved" || state.personnelStatus === "在职可用";
    expect(isApproved).toBe(scenario.approved);
    if (!scenario.approved) expect(dialogs).toContain("证件号已存在人员档案，不能重复批准。");
    expect(errors).toEqual([]);
    expect(blocked).toEqual([]);
  });
}
