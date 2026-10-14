"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST可回收物回收入库及丢失赔偿核销流程", async ({ page }) => {
  const errors = [];
  const blocked = [];
  const dialogs = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => {
    dialogs.push(dialog.message());
    if (dialog.type() === "confirm") await dialog.accept();
    else await dialog.accept();
  });
  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, rawValue) {
      const idKeys = { materialRecycleRecords: ["recycleId"], materialLostRecords: ["lostId"], materialScrapRecords: ["scrapId"], materialLedger: ["ledgerId"] }[key] || [];
      if (idKeys.length) {
        try {
          const records = JSON.parse(rawValue);
          for (const row of records || []) for (const field of idKeys) if (row[field] && !String(row[field]).startsWith("TEST-")) row[field] = `TEST-${row[field]}`;
          rawValue = JSON.stringify(records);
        } catch {}
      }
      return originalSetItem.call(this, key, rawValue);
    };
    if (!localStorage.getItem("personnelRecords")) {
      localStorage.setItem("personnelRecords", JSON.stringify([{ personId: "TEST-WH-001", name: "TEST库管员", position: "库房管理", status: "approved", approvalStatus: "approved" }]));
      localStorage.setItem("currentPersonId", "TEST-WH-001");
      localStorage.setItem("selectedPosition", "库房管理");
      localStorage.setItem("warehouseMaterials", JSON.stringify([{ materialId: "TEST-MAT-R-001", code: "TEST-MAT-R-001", name: "TEST可回收安全帽", category: "劳保用品", unit: "顶", type: "recyclable", availableQty: 0, issuedQty: 3, pendingInspectQty: 0, pendingScrapQty: 0, pendingLostQty: 0, scrappedQty: 0, referencePrice: 30, status: "active" }]));
      localStorage.setItem("materialHolders", JSON.stringify([{ holderId: "TEST-HOLD-001", personId: "TEST-DR-001", personName: "TEST司机", position: "汽车司机", materialId: "TEST-MAT-R-001", materialCode: "TEST-MAT-R-001", materialName: "TEST可回收安全帽", quantity: 3, status: "holding", issuedAt: new Date().toISOString() }]));
      localStorage.setItem("materialRecycleRecords", "[]");
      localStorage.setItem("materialLostRecords", "[]");
      localStorage.setItem("materialScrapRecords", "[]");
      localStorage.setItem("materialLedger", "[]");
    }
  });
  await page.route("**/*", async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (!["GET", "HEAD"].includes(req.method()) || url.origin !== ORIGIN) { blocked.push(`${req.method()} ${req.url()}`); return route.abort(); }
    const file = path.resolve(ROOT, decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html");
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try { let body = await fs.readFile(file); if (path.basename(file) === "warehouse.html") body = Buffer.from(body.toString("utf8").replace('return prefix + "_"', 'return "TEST-" + prefix + "_"')); return route.fulfill({ status: 200, contentType: path.extname(file) === ".html" ? "text/html; charset=utf-8" : "text/javascript; charset=utf-8", body }); }
    catch { return route.fulfill({ status: 404, body: "missing test asset" }); }
  });

  await page.goto(`${ORIGIN}/warehouse.html`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-page="recycle"]').click();
  await page.locator("#recyclePersonName").fill("TEST司机");
  await page.locator("#recycleMaterial").selectOption("TEST-MAT-R-001");
  await page.locator("#recycleQuantity").fill("4");
  await page.getByRole("button", { name: "登记回收" }).click();
  await expect.poll(() => dialogs.at(-1)).toContain("超过该员工当前持有数量");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("materialRecycleRecords") || "[]"))).toHaveLength(0);

  await page.locator("#recycleQuantity").fill("2");
  await page.locator("#recycleRemark").fill("TEST旧安全帽回收");
  await page.getByRole("button", { name: "登记回收" }).click();
  let recycles = await page.evaluate(() => JSON.parse(localStorage.getItem("materialRecycleRecords") || "[]"));
  expect(recycles).toHaveLength(1);
  expect(recycles[0]).toMatchObject({ recycleId: expect.stringContaining("TEST-"), quantity: 2, status: "pending_inspection" });
  await page.locator("#recycleList").getByRole("button", { name: "可继续使用" }).click();
  recycles = await page.evaluate(() => JSON.parse(localStorage.getItem("materialRecycleRecords") || "[]"));
  let material = await page.evaluate(() => JSON.parse(localStorage.getItem("warehouseMaterials"))[0]);
  let holders = await page.evaluate(() => JSON.parse(localStorage.getItem("materialHolders") || "[]"));
  expect(recycles[0].status).toBe("returned_to_stock");
  expect(material).toMatchObject({ availableQty: 2, issuedQty: 1, pendingInspectQty: 0 });
  expect(holders[0]).toMatchObject({ quantity: 1, status: "holding" });

  await page.locator('[data-page="lost"]').click();
  await page.locator("#lostPersonName").fill("TEST司机");
  await page.locator("#lostMaterial").selectOption("TEST-MAT-R-001");
  await page.locator("#lostQuantity").fill("2");
  await page.locator("#lostAmount").fill("30");
  await page.getByRole("button", { name: "登记丢失" }).click();
  await expect.poll(() => dialogs.at(-1)).toContain("超过该员工当前持有数量");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("materialLostRecords") || "[]"))).toHaveLength(0);

  await page.locator("#lostQuantity").fill("1");
  await page.locator("#lostRemark").fill("TEST丢失赔偿");
  await page.getByRole("button", { name: "登记丢失" }).click();
  let losses = await page.evaluate(() => JSON.parse(localStorage.getItem("materialLostRecords") || "[]"));
  expect(losses[0]).toMatchObject({ lostId: expect.stringContaining("TEST-"), status: "pending_compensation", quantity: 1, compensationAmount: 30 });
  await page.locator("#lostList").getByRole("button", { name: "确认扣款并核销" }).click();
  losses = await page.evaluate(() => JSON.parse(localStorage.getItem("materialLostRecords") || "[]"));
  material = await page.evaluate(() => JSON.parse(localStorage.getItem("warehouseMaterials"))[0]);
  holders = await page.evaluate(() => JSON.parse(localStorage.getItem("materialHolders") || "[]"));
  expect(losses[0].status).toBe("written_off");
  expect(material).toMatchObject({ availableQty: 2, issuedQty: 0, pendingLostQty: 0 });
  expect(holders[0]).toMatchObject({ quantity: 0, status: "closed" });

  await page.evaluate(() => {
    const materials = JSON.parse(localStorage.getItem("warehouseMaterials"));
    materials[0].issuedQty = 1;
    localStorage.setItem("warehouseMaterials", JSON.stringify(materials));
    const currentHolders = JSON.parse(localStorage.getItem("materialHolders"));
    currentHolders.push({ holderId: "TEST-HOLD-002", personId: "TEST-DR-002", personName: "TEST司机乙", position: "汽车司机", materialId: "TEST-MAT-R-001", materialName: "TEST可回收安全帽", quantity: 1, status: "holding" });
    localStorage.setItem("materialHolders", JSON.stringify(currentHolders));
  });
  await page.locator('[data-page="recycle"]').click();
  await page.locator("#recyclePersonName").fill("TEST司机乙");
  await page.locator("#recycleMaterial").selectOption("TEST-MAT-R-001");
  await page.locator("#recycleQuantity").fill("1");
  await page.locator("#recycleRemark").fill("TEST损坏安全帽");
  await page.getByRole("button", { name: "登记回收" }).click();
  await page.locator("#recycleList").getByRole("button", { name: "不可使用 / 待报废" }).last().click();
  recycles = await page.evaluate(() => JSON.parse(localStorage.getItem("materialRecycleRecords") || "[]"));
  let scraps = await page.evaluate(() => JSON.parse(localStorage.getItem("materialScrapRecords") || "[]"));
  material = await page.evaluate(() => JSON.parse(localStorage.getItem("warehouseMaterials"))[0]);
  console.log("TEST rejected recycle inspection readback:", JSON.stringify({ recycles, scraps, material }));
  expect(recycles[1]).toMatchObject({ status: "pending_scrap", inspectionResult: "不可继续使用" });
  expect(scraps[0]).toMatchObject({ scrapId: expect.stringContaining("TEST-"), sourceRecycleId: recycles[1].recycleId, status: "pending_approval" });
  expect(material.pendingScrapQty).toBe(1);
  await page.locator('[data-page="scrap"]').click();
  await page.locator("#scrapList").getByRole("button", { name: "批准报废并核销" }).first().click();
  scraps = await page.evaluate(() => JSON.parse(localStorage.getItem("materialScrapRecords") || "[]"));
  recycles = await page.evaluate(() => JSON.parse(localStorage.getItem("materialRecycleRecords") || "[]"));
  material = await page.evaluate(() => JSON.parse(localStorage.getItem("warehouseMaterials"))[0]);
  expect(scraps[0].status).toBe("scrapped");
  expect(recycles[1].status).toBe("scrapped");
  expect(material).toMatchObject({ issuedQty: 0, pendingScrapQty: 0, scrappedQty: 1 });
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
