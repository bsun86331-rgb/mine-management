"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST人员审核确认框返回后发现档案变化时不覆盖其他窗口数据", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    if (localStorage.getItem("TEST-STALE-PERSON-SEED") !== "1") {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem("personnelRecords", JSON.stringify([
        { personId: "TEST-PERSON-STALE-CANDIDATE", name: "TEST待审人员", phone: "TEST-OLD-PHONE", position: "汽车司机", team: "生产A组", status: "pending", approvalStatus: "pending", personnelStatus: "待审核", updatedAt: "2026-10-17T00:00:00.000Z", testFixture: true },
        { personId: "TEST-PERSON-STALE-ADMIN", name: "TEST管理员", position: "管理员", team: "后勤办公组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true }
      ]));
      localStorage.setItem("adminPersonId", "TEST-PERSON-STALE-ADMIN");
      localStorage.setItem("selectedPosition", "管理员");
      sessionStorage.setItem("managementSession", JSON.stringify({ verified: true, personId: "TEST-PERSON-STALE-ADMIN", position: "管理员", expiresAt: Date.now() + 3600000, testFixture: true }));
      localStorage.setItem("TEST-STALE-PERSON-SEED", "1");
    }
    window.__testAlerts = [];
    window.alert = message => window.__testAlerts.push(String(message));
  });
  await page.route("**/*", async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (!["GET", "HEAD"].includes(req.method()) || url.origin !== ORIGIN) {
      blocked.push(req.method() + " " + req.url());
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

  await page.goto(ORIGIN + "/admin-review.html", { waitUntil: "domcontentloaded" });
  let row = page.locator("#personnelTableBody tr").filter({ hasText: "TEST待审人员" });
  await expect(row).toBeVisible();
  await row.click();
  await page.evaluate(() => {
    window.confirm = () => {
      const records = JSON.parse(localStorage.getItem("personnelRecords"));
      const candidate = records.find(person => person.personId === "TEST-PERSON-STALE-CANDIDATE");
      candidate.name = "TEST另一窗口更新姓名";
      candidate.phone = "TEST-NEW-PHONE";
      candidate.status = "rejected";
      candidate.approvalStatus = "rejected";
      candidate.personnelStatus = "待审核";
      candidate.updatedAt = "2026-10-17T00:01:00.000Z";
      localStorage.setItem("personnelRecords", JSON.stringify(records));
      return true;
    };
  });
  await page.locator("#approveButton").click();
  let candidate = await page.evaluate(() => JSON.parse(localStorage.getItem("personnelRecords")).find(person => person.personId === "TEST-PERSON-STALE-CANDIDATE"));
  expect(candidate).toMatchObject({ name: "TEST另一窗口更新姓名", phone: "TEST-NEW-PHONE", status: "rejected", approvalStatus: "rejected" });
  expect(candidate.approvedAt).toBeUndefined();

  await page.evaluate(() => {
    const records = JSON.parse(localStorage.getItem("personnelRecords"));
    const current = records.find(person => person.personId === "TEST-PERSON-STALE-CANDIDATE");
    current.name = "TEST再次待审";
    current.status = "pending";
    current.approvalStatus = "pending";
    current.personnelStatus = "待审核";
    current.updatedAt = "2026-10-17T00:02:00.000Z";
    localStorage.setItem("personnelRecords", JSON.stringify(records));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  row = page.locator("#personnelTableBody tr").filter({ hasText: "TEST再次待审" });
  await expect(row).toBeVisible();
  await row.click();
  await page.locator("#rejectButton").click();
  await page.locator("#rejectReasonInput").fill("TEST旧窗口审核原因");
  await page.evaluate(() => {
    window.confirm = () => {
      const records = JSON.parse(localStorage.getItem("personnelRecords"));
      const current = records.find(person => person.personId === "TEST-PERSON-STALE-CANDIDATE");
      current.name = "TEST第三窗口更新";
      current.phone = "TEST-THIRD-PHONE";
      current.status = "approved";
      current.approvalStatus = "approved";
      current.personnelStatus = "在职可用";
      current.updatedAt = "2026-10-17T00:03:00.000Z";
      localStorage.setItem("personnelRecords", JSON.stringify(records));
      return true;
    };
  });
  await page.locator("#rejectArea").getByRole("button", { name: "确认驳回" }).click();
  candidate = await page.evaluate(() => JSON.parse(localStorage.getItem("personnelRecords")).find(person => person.personId === "TEST-PERSON-STALE-CANDIDATE"));
  expect(candidate).toMatchObject({ name: "TEST第三窗口更新", phone: "TEST-THIRD-PHONE", status: "approved", approvalStatus: "approved" });
  expect(candidate.rejectReason).toBeUndefined();
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
