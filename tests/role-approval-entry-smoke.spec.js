"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST 排土管理人员审核通过后进入专属只读工作端", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => {
    if (dialog.type() === "confirm") await dialog.accept();
    else await dialog.accept();
  });
  await page.addInitScript(() => {
    const adminId = "TEST-ADMIN-001";
    const personId = "TEST-DUMP-PERSON-001";
    const rows = [
      { personId: adminId, employeeNo: "TEST-ADMIN-001", name: "TEST管理员", position: "管理员", team: "后勤办公组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true },
      { personId, employeeNo: "TEST-DUMP-EMP-001", name: "TEST排土管理员", position: "排土管理", team: "生产A组", status: "pending", approvalStatus: "pending", personnelStatus: "待审核", phone: "13800000000", passportNumber: "TEST-PASSPORT-001", selfiePhoto: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", emergencyContact: "TEST联系人", emergencyPhone: "13900000000", submittedAt: new Date().toISOString(), testFixture: true }
    ];
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (this === window.localStorage && key === "personnelRecords") {
        try {
          const profiles = JSON.parse(value);
          profiles.forEach(profile => {
            if (profile.personId === personId && profile.employeeNo && !String(profile.employeeNo).startsWith("TEST-")) profile.employeeNo = "TEST-DUMP-EMP-001";
          });
          value = JSON.stringify(profiles);
        } catch {}
      }
      return set.call(this, key, value);
    };
    const existing = JSON.parse(localStorage.getItem("personnelRecords") || "[]");
    if (!existing.some(profile => profile.personId === personId)) localStorage.setItem("personnelRecords", JSON.stringify(rows));
    localStorage.setItem("adminPersonId", adminId);
    localStorage.setItem("selectedPosition", "管理员");
    sessionStorage.setItem("managementSession", JSON.stringify({ verified: true, personId: adminId, position: "管理员", expiresAt: Date.now() + 3600000, testFixture: true }));
  });

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

  await page.goto(`${ORIGIN}/admin-review.html`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#sessionBox")).toContainText("TEST管理员");
  const personRow = page.locator("#personnelTableBody tr").filter({ hasText: "TEST排土管理员" });
  await expect(personRow).toBeVisible();
  await personRow.click();
  await expect(page.locator("#detailPosition")).toHaveText("排土管理");
  await expect(page.locator("#detailPhone")).toHaveText("13800000000");
  await expect(page.locator("#detailSelfiePhoto")).toHaveAttribute("src", /^data:image\/gif;base64,/);
  await expect(page.locator("#detailSelfiePhoto")).toHaveCSS("display", "block");
  await expect(page.locator("#detailSelfiePhotoEmpty")).toHaveCSS("display", "none");
  await page.locator("#approveButton").click();
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("personnelRecords") || "[]").find(row => row.personId === "TEST-DUMP-PERSON-001")?.approvalStatus)).toBe("approved");

  await page.goto(`${ORIGIN}/index.html`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /排土管理/ }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/dump-management.html");
  await expect(page.locator("h1")).toContainText("排土管理工作端");
  await expect(page.locator('#production-board [data-action="edit"]')).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

