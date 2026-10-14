"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST物资申请、库存不足拦截、入库与出库全链路闭环", async ({ page }) => {
  const errors = [];
  const blocked = [];
  const dialogs = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => {
    dialogs.push(dialog.message());
    if (dialog.type() === "prompt") await dialog.accept("3");
    else await dialog.accept();
  });
  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, rawValue) {
      if (["materialRequests", "materialLedger"].includes(key)) {
        try {
          const records = JSON.parse(rawValue);
          if (Array.isArray(records)) {
            if (key === "materialLedger") {
              (window.__ledgerWrites ||= []).push({ at: new Date().toISOString(), records: records.map(row => ({ ledgerId: row.ledgerId, type: row.type, client_record_id: row.client_record_id })), stack: new Error().stack });
            }
            for (const record of records) {
              for (const idKey of ["requestId", "ledgerId"]) {
                if (record[idKey] && !String(record[idKey]).startsWith("TEST-")) record[idKey] = `TEST-${record[idKey]}`;
              }
            }
            rawValue = JSON.stringify(records);
          }
        } catch {}
      }
      return originalSetItem.call(this, key, rawValue);
    };
    if (!localStorage.getItem("personnelRecords")) {
      const people = [
        { personId: "TEST-WH-001", employeeNo: "TEST-WH-001", name: "TEST库管员", position: "库房管理", status: "approved", approvalStatus: "approved" },
        { personId: "TEST-DR-001", employeeNo: "TEST-DR-001", name: "TEST汽车司机", position: "汽车司机", status: "approved", approvalStatus: "approved" }
      ];
      localStorage.setItem("personnelRecords", JSON.stringify(people));
      localStorage.setItem("currentPersonId", "TEST-WH-001");
      localStorage.setItem("selectedPosition", "库房管理");
      localStorage.setItem("warehouseMaterials", JSON.stringify([
        { materialId: "TEST-MAT-001", code: "TEST-MAT-001", name: "TEST安全手套", category: "劳保用品", unit: "双", type: "consumable", referencePrice: 5, minimumStock: 2, availableQty: 2, issuedQty: 0, status: "active" }
      ]));
      localStorage.setItem("materialRequests", "[]");
      localStorage.setItem("materialLedger", "[]");
    }
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
      let body = await fs.readFile(file);
      if (["warehouse.html", "material-request.html"].includes(path.basename(file))) body = Buffer.from(body.toString("utf8").replace('return prefix + "_"', 'return "TEST-" + prefix + "_"'));
      return route.fulfill({ status: 200, contentType: path.extname(file) === ".html" ? "text/html; charset=utf-8" : "text/javascript; charset=utf-8", body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  await page.goto(`${ORIGIN}/warehouse.html`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#page-inventory")).toBeVisible();
  await page.locator('[data-page="inbound"]').click();
  await page.getByRole("button", { name: "确认入库" }).click();
  await expect.poll(() => dialogs.at(-1)).toContain("请选择物资");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("warehouseMaterials"))[0].availableQty)).toBe(2);

  await page.evaluate(() => {
    localStorage.setItem("currentPersonId", "TEST-DR-001");
    localStorage.setItem("selectedPosition", "汽车司机");
  });
  await page.goto(`${ORIGIN}/material-request.html`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#personName")).toHaveText("TEST汽车司机");
  await page.locator("#materialSelect").selectOption("TEST-MAT-001");
  await page.locator("#requestQuantity").fill("3");
  await page.locator("#purpose").fill("TEST安全防护用品申请");
  await page.getByRole("button", { name: "提交物料领用单" }).click();
  let requests = await page.evaluate(() => JSON.parse(localStorage.getItem("materialRequests") || "[]"));
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ requestId: expect.stringContaining("TEST-"), personId: "TEST-DR-001", materialId: "TEST-MAT-001", requestQuantity: 3, status: "pending" });

  await page.evaluate(() => {
    localStorage.setItem("currentPersonId", "TEST-WH-001");
    localStorage.setItem("selectedPosition", "库房管理");
  });
  await page.goto(`${ORIGIN}/warehouse.html`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-page="requests"]').click();
  await expect(page.locator("#requestList")).toContainText("TEST安全手套");
  await page.locator("#requestList").getByRole("button", { name: "确认出库" }).click();
  await expect.poll(() => dialogs.at(-1)).toContain("库存不足");
  requests = await page.evaluate(() => JSON.parse(localStorage.getItem("materialRequests") || "[]"));
  expect(requests[0].status).toBe("pending");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("warehouseMaterials"))[0].availableQty)).toBe(2);

  await page.locator('[data-page="inbound"]').click();
  await page.locator("#inboundMaterial").selectOption("TEST-MAT-001");
  await page.locator("#inboundQuantity").fill("5");
  await page.locator("#inboundSupplier").fill("TEST虚拟供应商");
  await page.getByRole("button", { name: "确认入库" }).click();
  let material = await page.evaluate(() => JSON.parse(localStorage.getItem("warehouseMaterials"))[0]);
  expect(material.availableQty).toBe(7);
  console.log("TEST ledger after inbound:", await page.evaluate(() => JSON.parse(localStorage.getItem("materialLedger") || "[]")));

  await page.locator('[data-page="requests"]').click();
  await page.locator("#requestList").getByRole("button", { name: "确认出库" }).click();
  requests = await page.evaluate(() => JSON.parse(localStorage.getItem("materialRequests") || "[]"));
  material = await page.evaluate(() => JSON.parse(localStorage.getItem("warehouseMaterials"))[0]);
  const ledger = await page.evaluate(() => JSON.parse(localStorage.getItem("materialLedger") || "[]"));
  console.log("TEST material ledger:", JSON.stringify(ledger));
  console.log("TEST ledger storage writes:", JSON.stringify(await page.evaluate(() => window.__ledgerWrites || [])));
  await page.locator('[data-page="ledger"]').click();
  console.log("TEST visible ledger rows:", await page.locator("#ledgerTableBody tr").count(), await page.locator("#ledgerTableBody").innerText());
  await page.locator('[data-page="reports"]').click();
  await page.getByRole("button", { name: "查看日报预览" }).click();
  console.log("TEST inventory daily preview:", dialogs.at(-1));
  expect(requests[0]).toMatchObject({ status: "issued", actualQuantity: 3, personId: "TEST-DR-001" });
  expect(material).toMatchObject({ availableQty: 4, issuedQty: 3 });
  expect(ledger.filter(item => item.materialId === "TEST-MAT-001").map(item => item.type)).toEqual(["入库", "出库"]);
  expect(ledger.every(item => item.ledgerId.startsWith("TEST-"))).toBe(true);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
