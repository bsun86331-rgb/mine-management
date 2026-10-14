"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=", "base64");

test("TEST人员审核驳回、本人修改重提、管理员复审通过闭环", async ({ page }) => {
  const errors = [];
  const blocked = [];
  const dialogs = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => {
    dialogs.push(dialog.message());
    await dialog.accept();
  });
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
      const ext = path.extname(file).toLowerCase();
      const contentType = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" }[ext] || "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  await page.goto(`${ORIGIN}/person-register.html?position=${encodeURIComponent("汽车司机")}`);
  await page.locator("#name").fill("TEST驳回重提人员");
  await page.locator("#phone").fill("13800000000");
  await page.locator("#team").selectOption("生产A组");
  await page.locator("#passportNumber").fill("TEST-PASSPORT-REVIEW-001");
  await page.locator("#selfiePhoto").setInputFiles({ name: "test.png", mimeType: "image/png", buffer: PNG });
  await page.locator("#emergencyContact").fill("TEST联系人");
  await page.locator("#emergencyPhone").fill("13900000000");
  await page.locator("#submitButton").click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/person-waiting.html");
  const applicant = await page.evaluate(() => JSON.parse(localStorage.getItem("personnelRecords") || "[]").find(person => person.name === "TEST驳回重提人员"));
  expect(applicant).toBeTruthy();

  await page.evaluate(() => {
    const people = JSON.parse(localStorage.getItem("personnelRecords") || "[]");
    people.push({ personId: "TEST-ADMIN-REJECT-001", employeeNo: "TEST-ADMIN-REJECT-001", name: "TEST审核管理员", position: "管理员", team: "后勤办公组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true });
    localStorage.setItem("personnelRecords", JSON.stringify(people));
    localStorage.setItem("adminPersonId", "TEST-ADMIN-REJECT-001");
    localStorage.setItem("selectedPosition", "管理员");
    sessionStorage.setItem("managementSession", JSON.stringify({ verified: true, personId: "TEST-ADMIN-REJECT-001", position: "管理员", expiresAt: Date.now() + 3600000, testFixture: true }));
  });
  await page.goto(`${ORIGIN}/admin-review.html`);
  const applicantRow = page.locator("#personnelTableBody tr").filter({ hasText: "TEST驳回重提人员" });
  await expect(applicantRow).toBeVisible();
  await applicantRow.click();
  await page.locator("#rejectButton").click();
  await page.locator("#rejectReasonInput").fill("TEST请补充紧急联系人电话");
  await page.locator("#rejectArea button").click();
  await expect.poll(() => page.evaluate(id => JSON.parse(localStorage.getItem("personnelRecords") || "[]").find(person => person.personId === id)?.approvalStatus, applicant.personId)).toBe("rejected");
  expect(dialogs.some(message => message.includes("驳回"))).toBeTruthy();

  await page.evaluate(id => {
    localStorage.setItem("waitingApplicantPersonId", id);
    localStorage.setItem("waitingApplicantPosition", "汽车司机");
    localStorage.setItem("currentPersonId", id);
    localStorage.setItem("selectedPosition", "汽车司机");
  }, applicant.personId);
  await page.goto(`${ORIGIN}/person-waiting.html`);
  await expect(page.locator("#statusBadge")).toHaveText("已驳回");
  await expect(page.locator("#rejectReason")).toContainText("TEST请补充紧急联系人电话");
  await page.locator("#editButton").click();
  await expect(page).toHaveURL(/person-register\.html\?.*rejected=1/);
  await expect(page.locator("#name")).toHaveValue("TEST驳回重提人员");
  await expect(page.locator("#emergencyPhone")).toHaveValue("13900000000");
  await page.locator("#emergencyPhone").fill("13900000099");
  await page.locator("#submitButton").click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/person-waiting.html");
  const resubmitted = await page.evaluate(id => JSON.parse(localStorage.getItem("personnelRecords") || "[]").find(person => person.personId === id), applicant.personId);
  expect(resubmitted).toMatchObject({ personId: applicant.personId, approvalStatus: "pending", status: "pending", resubmitCount: 1, emergencyPhone: "13900000099" });
  expect(resubmitted.rejectReason).toBeUndefined();
  expect(resubmitted.rejectionReason).toBeUndefined();

  await page.evaluate(() => {
    localStorage.setItem("adminPersonId", "TEST-ADMIN-REJECT-001");
    localStorage.setItem("selectedPosition", "管理员");
    sessionStorage.setItem("managementSession", JSON.stringify({ verified: true, personId: "TEST-ADMIN-REJECT-001", position: "管理员", expiresAt: Date.now() + 3600000, testFixture: true }));
  });
  await page.goto(`${ORIGIN}/admin-review.html`);
  const resubmittedRow = page.locator("#personnelTableBody tr").filter({ hasText: "TEST驳回重提人员" });
  await expect(resubmittedRow).toBeVisible();
  await resubmittedRow.click();
  await page.locator("#approveButton").click();
  await expect.poll(() => page.evaluate(id => JSON.parse(localStorage.getItem("personnelRecords") || "[]").find(person => person.personId === id)?.approvalStatus, applicant.personId)).toBe("approved");
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
