"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST旧物回收验收后以旧换新出库并防止重复消费回收记录", async ({ page }) => {
  const errors = [];
  const blocked = [];
  const dialogs = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => {
    dialogs.push(dialog.message());
    if (dialog.type() === "prompt") await dialog.accept("1");
    else await dialog.accept();
  });
  await page.addInitScript(() => {
    if (localStorage.getItem("TEST-EXCHANGE-SEED") === "done") return;
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, rawValue) {
      const idsByKey = {
        materialRequests: ["requestId"],
        materialLedger: ["ledgerId"],
        materialHolders: ["holderId"],
        materialRecycleRecords: ["recycleId"]
      };
      if (idsByKey[key]) {
        try {
          const rows = JSON.parse(rawValue);
          for (const row of rows || []) {
            for (const field of idsByKey[key]) {
              if (row[field] && !String(row[field]).startsWith("TEST-")) row[field] = `TEST-${row[field]}`;
            }
          }
          rawValue = JSON.stringify(rows);
        } catch {}
      }
      return originalSetItem.call(this, key, rawValue);
    };
    const driver = { personId: "TEST-EXCHANGE-DRIVER", employeeNo: "TEST-EXCHANGE-DRIVER", name: "TEST以旧换新司机", position: "汽车司机", status: "approved", approvalStatus: "approved" };
    const storekeeper = { personId: "TEST-EXCHANGE-STOREKEEPER", employeeNo: "TEST-EXCHANGE-STOREKEEPER", name: "TEST库管员", position: "库房管理", status: "approved", approvalStatus: "approved" };
    localStorage.setItem("personnelRecords", JSON.stringify([driver, storekeeper]));
    localStorage.setItem("currentPersonId", driver.personId);
    localStorage.setItem("selectedPosition", driver.position);
    localStorage.setItem("warehouseMaterials", JSON.stringify([{ materialId: "TEST-EXCHANGE-MATERIAL", code: "TEST-EXCHANGE-MATERIAL", name: "TEST安全帽", category: "劳保用品", unit: "顶", type: "recyclable", availableQty: 2, issuedQty: 1, referencePrice: 30, status: "active" }]));
    localStorage.setItem("materialHolders", JSON.stringify([{ holderId: "TEST-EXCHANGE-OLD-HOLDER", personId: driver.personId, personName: driver.name, position: driver.position, materialId: "TEST-EXCHANGE-MATERIAL", materialName: "TEST安全帽", quantity: 1, status: "holding", issuedAt: "2026-10-15T00:00:00.000Z" }]));
    localStorage.setItem("materialRequests", "[]");
    localStorage.setItem("materialRecycleRecords", "[]");
    localStorage.setItem("materialLedger", "[]");
    localStorage.setItem("TEST-EXCHANGE-SEED", "done");
  });
  await page.route("**/*", async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (!["GET", "HEAD"].includes(req.method()) || url.origin !== ORIGIN) {
      blocked.push(`${req.method()} ${req.url()}`);
      return route.abort();
    }
    const file = path.resolve(ROOT, decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html");
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      let body = await fs.readFile(file);
      if (["warehouse.html", "material-request.html"].includes(path.basename(file))) body = Buffer.from(body.toString("utf8").replace('return prefix + "_"', 'return "TEST-" + prefix + "_"'));
      const ext = path.extname(file).toLowerCase();
      const contentType = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" }[ext] || "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  await page.goto(`${ORIGIN}/material-request.html`, { waitUntil: "domcontentloaded" });
  await page.locator("#materialSelect").selectOption("TEST-EXCHANGE-MATERIAL");
  await page.locator("#requestType").selectOption("exchange");
  await page.locator("#purpose").fill("TEST先还旧安全帽再换新");
  await page.getByRole("button", { name: "提交物料领用单" }).click();
  let requests = await page.evaluate(() => JSON.parse(localStorage.getItem("materialRequests") || "[]"));
  expect(requests).toHaveLength(1);
  const firstRequestId = requests[0].requestId;

  await page.evaluate(() => {
    localStorage.setItem("currentPersonId", "TEST-EXCHANGE-STOREKEEPER");
    localStorage.setItem("selectedPosition", "库房管理");
  });
  await page.goto(`${ORIGIN}/warehouse.html`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-page="requests"]').click();
  await page.locator("#requestList").getByRole("button", { name: "确认出库" }).click();
  expect(dialogs.some(message => message.includes("需先归还同一员工的旧物"))).toBeTruthy();
  let material = await page.evaluate(() => JSON.parse(localStorage.getItem("warehouseMaterials") || "[]")[0]);
  expect(material).toMatchObject({ availableQty: 2, issuedQty: 1 });
  expect((await page.evaluate(() => JSON.parse(localStorage.getItem("materialLedger") || "[]")))).toHaveLength(0);
  requests = await page.evaluate(() => JSON.parse(localStorage.getItem("materialRequests") || "[]"));
  expect(requests[0].status).toBe("pending");

  await page.locator('[data-page="recycle"]').click();
  await page.locator("#recyclePersonName").fill("TEST以旧换新司机");
  await page.locator("#recycleMaterial").selectOption("TEST-EXCHANGE-MATERIAL");
  await page.locator("#recycleQuantity").fill("1");
  await page.locator("#recycleType").selectOption("exchange");
  await page.locator("#recycleRemark").fill("TEST旧安全帽回收");
  await page.getByRole("button", { name: "登记回收" }).click();
  let recycles = await page.evaluate(() => JSON.parse(localStorage.getItem("materialRecycleRecords") || "[]"));
  expect(recycles).toHaveLength(1);
  expect(recycles[0]).toMatchObject({ personName: "TEST以旧换新司机", quantity: 1, status: "pending_inspection", type: "exchange" });
  await page.locator("#recycleList").getByRole("button", { name: "可继续使用" }).click();
  recycles = await page.evaluate(() => JSON.parse(localStorage.getItem("materialRecycleRecords") || "[]"));
  material = await page.evaluate(() => JSON.parse(localStorage.getItem("warehouseMaterials") || "[]")[0]);
  expect(recycles[0]).toMatchObject({ status: "returned_to_stock", inspectionResult: "可继续使用" });
  expect(material).toMatchObject({ availableQty: 3, issuedQty: 0 });

  await page.locator('[data-page="requests"]').click();
  await page.locator("#requestList").getByRole("button", { name: "确认出库" }).click();
  requests = await page.evaluate(() => JSON.parse(localStorage.getItem("materialRequests") || "[]"));
  recycles = await page.evaluate(() => JSON.parse(localStorage.getItem("materialRecycleRecords") || "[]"));
  material = await page.evaluate(() => JSON.parse(localStorage.getItem("warehouseMaterials") || "[]")[0]);
  let holders = await page.evaluate(() => JSON.parse(localStorage.getItem("materialHolders") || "[]"));
  let ledger = await page.evaluate(() => JSON.parse(localStorage.getItem("materialLedger") || "[]"));
  expect(requests[0]).toMatchObject({ requestId: firstRequestId, status: "issued", exchangeReturnQuantity: 1, exchangeReturnRecordIds: [recycles[0].recycleId] });
  expect(recycles[0]).toMatchObject({ exchangeIssuedQuantity: 1, exchangeRequestIds: [firstRequestId] });
  expect(material).toMatchObject({ availableQty: 2, issuedQty: 1 });
  expect(holders.filter(row => row.personId === "TEST-EXCHANGE-DRIVER" && row.status === "holding").reduce((sum, row) => sum + row.quantity, 0)).toBe(1);
  expect(ledger.map(row => row.type)).toEqual(["以旧换新回收待检", "回收入库", "出库"]);
  expect(ledger[2]).toMatchObject({ type: "出库", quantity: 1, materialId: "TEST-EXCHANGE-MATERIAL" });
  expect(ledger[2].remark).toContain("以旧换新");

  await page.evaluate(() => {
    localStorage.setItem("currentPersonId", "TEST-EXCHANGE-DRIVER");
    localStorage.setItem("selectedPosition", "汽车司机");
  });
  await page.goto(`${ORIGIN}/material-request.html`, { waitUntil: "domcontentloaded" });
  await page.locator("#materialSelect").selectOption("TEST-EXCHANGE-MATERIAL");
  await page.locator("#requestType").selectOption("exchange");
  await page.locator("#purpose").fill("TEST验证旧回收记录不能重复消费");
  await page.getByRole("button", { name: "提交物料领用单" }).click();
  requests = await page.evaluate(() => JSON.parse(localStorage.getItem("materialRequests") || "[]"));
  expect(requests).toHaveLength(2);
  await page.evaluate(() => {
    localStorage.setItem("currentPersonId", "TEST-EXCHANGE-STOREKEEPER");
    localStorage.setItem("selectedPosition", "库房管理");
  });
  await page.goto(`${ORIGIN}/warehouse.html`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-page="requests"]').click();
  await page.locator("#requestList").getByRole("button", { name: "确认出库" }).last().click();
  expect(dialogs.at(-1)).toContain("需先归还同一员工的旧物");
  requests = await page.evaluate(() => JSON.parse(localStorage.getItem("materialRequests") || "[]"));
  material = await page.evaluate(() => JSON.parse(localStorage.getItem("warehouseMaterials") || "[]")[0]);
  ledger = await page.evaluate(() => JSON.parse(localStorage.getItem("materialLedger") || "[]"));
  expect(requests[1].status).toBe("pending");
  expect(material).toMatchObject({ availableQty: 2, issuedQty: 1 });
  expect(ledger).toHaveLength(3);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

