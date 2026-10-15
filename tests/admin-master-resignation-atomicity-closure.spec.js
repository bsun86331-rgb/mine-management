"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST离职结算失败可重试且阻止重复办理", async ({ page }) => {
  const blocked = [];
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("personnelRecords", JSON.stringify([
      { personId: "TEST-ADMIN-001", name: "TEST管理员", phone: "13800000001", position: "管理员", status: "active", approvalStatus: "approved", personnelStatus: "在职可用" },
      { personId: "TEST-RESIGN-001", name: "TEST待离职人员", phone: "13800000002", position: "汽车司机", team: "A", status: "active", approvalStatus: "approved", personnelStatus: "在职可用" }
    ]));
    localStorage.setItem("adminPersonId", "TEST-ADMIN-001");
    sessionStorage.setItem("managementSession", JSON.stringify({
      verified: true,
      position: "管理员",
      personId: "TEST-ADMIN-001",
      expiresAt: Date.now() + 60000
    }));
  });

  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!["GET", "HEAD"].includes(request.method()) || url.origin !== ORIGIN) {
      blocked.push(`${request.method()} ${request.url()}`);
      return route.abort();
    }

    const relative = decodeURIComponent(url.pathname.slice(1)) || "index.html";
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) {
      return route.fulfill({ status: 403, body: "blocked" });
    }

    try {
      const extension = path.extname(file).toLowerCase();
      const contentType = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8"
      }[extension] || "application/octet-stream";
      return route.fulfill({
        status: 200,
        contentType,
        body: await fs.readFile(file)
      });
    } catch {
      return route.fulfill({ status: 404, body: "missing TEST asset" });
    }
  });

  await page.goto(`${ORIGIN}/admin-master.html`);
  await expect(page).toHaveTitle("管理员基础资料中心 V2.11.4");

  await page.evaluate(() => {
    document.getElementById("resignationPersonId").value = "TEST-RESIGN-001";
    document.getElementById("resignationDate").value = "2026-10-15";
    document.getElementById("resignationReason").value = "TEST流程验证";
    document.getElementById("resignationRemark").value = "";
    document.getElementById("salaryDeductionStatus").value = "pending";

    const nativeSetItem = Storage.prototype.setItem;
    window.__failPersonnelSave = true;
    Storage.prototype.setItem = function (key, value) {
      if (key === "personnelRecords" && window.__failPersonnelSave) {
        window.__failPersonnelSave = false;
        throw new DOMException("TEST storage fault", "QuotaExceededError");
      }
      return nativeSetItem.call(this, key, value);
    };

    confirmResignation();
  });

  let state = await page.evaluate(() => ({
    people: JSON.parse(localStorage.getItem("personnelRecords") || "[]"),
    settlements: JSON.parse(localStorage.getItem("resignationSettlementRecords") || "[]"),
    toast: document.getElementById("toast")?.textContent || ""
  }));
  expect(state.people.find(person => person.personId === "TEST-RESIGN-001").status).toBe("active");
  expect(state.settlements).toHaveLength(0);
  expect(state.toast).toContain("离职结算保存失败，人员状态未变更，请重试");

  await page.evaluate(() => confirmResignation());
  state = await page.evaluate(() => ({
    people: JSON.parse(localStorage.getItem("personnelRecords") || "[]"),
    settlements: JSON.parse(localStorage.getItem("resignationSettlementRecords") || "[]")
  }));
  expect(state.people.find(person => person.personId === "TEST-RESIGN-001").status).toBe("resigned");
  expect(state.settlements).toHaveLength(1);
  expect(state.settlements[0].personId).toBe("TEST-RESIGN-001");

  await page.evaluate(() => confirmResignation());
  state = await page.evaluate(() => ({
    people: JSON.parse(localStorage.getItem("personnelRecords") || "[]"),
    settlements: JSON.parse(localStorage.getItem("resignationSettlementRecords") || "[]"),
    toast: document.getElementById("toast")?.textContent || ""
  }));
  expect(state.people.find(person => person.personId === "TEST-RESIGN-001").status).toBe("resigned");
  expect(state.settlements).toHaveLength(1);
  expect(state.toast).toContain("该员工已经离职");
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
