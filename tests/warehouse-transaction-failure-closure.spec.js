"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST回收、报废、丢失多记录事务写入失败时完整回滚并可重试", async ({ page }) => {
  const errors = [];
  const blocked = [];
  const dialogs = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => {
    dialogs.push(dialog.message());
    await dialog.accept();
  });

  await page.addInitScript(() => {
    localStorage.setItem("personnelRecords", JSON.stringify([
      { personId: "TEST-WH-TXN-001", name: "TEST库管员", position: "库房管理", status: "approved", approvalStatus: "approved" }
    ]));
    localStorage.setItem("currentPersonId", "TEST-WH-TXN-001");
    localStorage.setItem("selectedPosition", "库房管理");
    localStorage.setItem("warehouseMaterials", JSON.stringify([
      { materialId: "TEST-WH-TXN-MAT-001", code: "TEST-WH-TXN-MAT-001", name: "TEST安全帽", category: "劳保用品", unit: "顶", type: "recyclable", availableQty: 0, issuedQty: 2, pendingInspectQty: 0, pendingScrapQty: 0, pendingLostQty: 0, scrappedQty: 0, status: "active" }
    ]));
    localStorage.setItem("materialHolders", JSON.stringify([
      { holderId: "TEST-WH-TXN-HOLD-001", personId: "TEST-DR-TXN-001", personName: "TEST司机", position: "汽车司机", materialId: "TEST-WH-TXN-MAT-001", materialName: "TEST安全帽", quantity: 2, status: "holding" }
    ]));
    localStorage.setItem("materialRecycleRecords", "[]");
    localStorage.setItem("materialScrapRecords", "[]");
    localStorage.setItem("materialLostRecords", "[]");
    localStorage.setItem("materialLedger", "[]");
    window.__failKey = "";
    window.__failedKeys = [];
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === window.__failKey) {
        window.__failedKeys.push(key);
        throw new DOMException("TEST quota exceeded", "QuotaExceededError");
      }
      return original.call(this, key, value);
    };
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
      if (path.basename(file) === "warehouse.html") {
        body = Buffer.from(body.toString("utf8").replace('return prefix + "_"', 'return "TEST-" + prefix + "_"'));
      }
      return route.fulfill({ status: 200, contentType: path.extname(file) === ".html" ? "text/html; charset=utf-8" : "text/javascript; charset=utf-8", body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  const read = () => page.evaluate(() => ({
    material: JSON.parse(localStorage.getItem("warehouseMaterials") || "[]")[0],
    holders: JSON.parse(localStorage.getItem("materialHolders") || "[]"),
    recycles: JSON.parse(localStorage.getItem("materialRecycleRecords") || "[]"),
    scraps: JSON.parse(localStorage.getItem("materialScrapRecords") || "[]"),
    losts: JSON.parse(localStorage.getItem("materialLostRecords") || "[]"),
    ledger: JSON.parse(localStorage.getItem("materialLedger") || "[]")
  }));
  const failOn = key => page.evaluate(value => { window.__failKey = value; }, key);

  await page.goto(`${ORIGIN}/warehouse.html`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-page="recycle"]').click();
  await page.locator("#recyclePersonName").fill("TEST司机");
  await page.locator("#recycleMaterial").selectOption("TEST-WH-TXN-MAT-001");
  await page.locator("#recycleQuantity").fill("1");
  await page.locator("#recycleRemark").fill("TEST回收事务故障");
  await failOn("warehouseMaterials");
  await page.getByRole("button", { name: "登记回收" }).click();
  await expect.poll(() => page.evaluate(() => window.__failedKeys.length)).toBeGreaterThan(0);
  let state = await read();
  expect(state.recycles).toHaveLength(0);
  expect(state.material).toMatchObject({ issuedQty: 2, pendingInspectQty: 0 });
  await failOn("");
  await page.locator("#recyclePersonName").fill("TEST司机");
  await page.locator("#recycleMaterial").selectOption("TEST-WH-TXN-MAT-001");
  await page.locator("#recycleQuantity").fill("1");
  await page.locator("#recycleRemark").fill("TEST回收事务故障");
  await page.getByRole("button", { name: "登记回收" }).click();
  state = await read();
  expect(state.recycles).toHaveLength(1);
  expect(state.material.pendingInspectQty).toBe(1);

  await failOn("materialLedger");
  await page.locator("#recycleList").getByRole("button", { name: "可继续使用" }).click();
  state = await read();
  expect(state.recycles[0].status).toBe("pending_inspection");
  expect(state.holders[0].quantity).toBe(2);
  expect(state.material).toMatchObject({ availableQty: 0, issuedQty: 2, pendingInspectQty: 1 });
  await failOn("");
  await page.locator("#recycleList").getByRole("button", { name: "可继续使用" }).click();
  state = await read();
  expect(state.recycles[0].status).toBe("returned_to_stock");
  expect(state.holders[0].quantity).toBe(1);
  expect(state.material).toMatchObject({ availableQty: 1, issuedQty: 1, pendingInspectQty: 0 });

  await page.locator('[data-page="scrap"]').click();
  await page.locator("#scrapMaterial").selectOption("TEST-WH-TXN-MAT-001");
  await page.locator("#scrapQuantity").fill("1");
  await page.locator("#scrapPersonName").fill("TEST司机");
  await page.locator("#scrapReason").fill("TEST报废事务故障");
  await failOn("warehouseMaterials");
  await page.getByRole("button", { name: "提交报废申请" }).click();
  state = await read();
  expect(state.scraps).toHaveLength(0);
  expect(state.material.pendingScrapQty).toBe(0);
  await failOn("");
  await page.locator("#scrapMaterial").selectOption("TEST-WH-TXN-MAT-001");
  await page.locator("#scrapQuantity").fill("1");
  await page.locator("#scrapPersonName").fill("TEST司机");
  await page.locator("#scrapReason").fill("TEST报废事务故障");
  await page.getByRole("button", { name: "提交报废申请" }).click();
  state = await read();
  expect(state.scraps[0].status).toBe("pending_approval");
  expect(state.material.pendingScrapQty).toBe(1);

  await failOn("materialLedger");
  await page.locator("#scrapList").getByRole("button", { name: "批准报废并核销" }).click();
  state = await read();
  expect(state.scraps[0].status).toBe("pending_approval");
  expect(state.holders[0].quantity).toBe(1);
  expect(state.material).toMatchObject({ issuedQty: 1, pendingScrapQty: 1, scrappedQty: 0 });
  await failOn("");
  await page.locator("#scrapList").getByRole("button", { name: "批准报废并核销" }).click();
  state = await read();
  expect(state.scraps[0].status).toBe("scrapped");
  expect(state.holders[0]).toMatchObject({ quantity: 0, status: "closed" });
  expect(state.material).toMatchObject({ issuedQty: 0, pendingScrapQty: 0, scrappedQty: 1 });

  await page.evaluate(() => {
    const holders = JSON.parse(localStorage.getItem("materialHolders"));
    holders.push({ holderId: "TEST-WH-TXN-HOLD-002", personName: "TEST司机乙", materialId: "TEST-WH-TXN-MAT-001", quantity: 1, status: "holding" });
    localStorage.setItem("materialHolders", JSON.stringify(holders));
    const materials = JSON.parse(localStorage.getItem("warehouseMaterials"));
    materials[0].issuedQty = 1;
    localStorage.setItem("warehouseMaterials", JSON.stringify(materials));
  });
  await page.locator('[data-page="lost"]').click();
  await page.locator("#lostPersonName").fill("TEST司机乙");
  await page.locator("#lostMaterial").selectOption("TEST-WH-TXN-MAT-001");
  await page.locator("#lostQuantity").fill("1");
  await page.locator("#lostAmount").fill("20");
  await page.getByRole("button", { name: "登记丢失" }).click();
  await expect(page.locator("#lostList")).toContainText("TEST司机乙");
  await failOn("materialLedger");
  await page.locator("#lostList").getByRole("button", { name: "确认扣款并核销" }).click();
  state = await read();
  const lostRecord = state.losts.find(item => item.personName === "TEST司机乙");
  const lostHolder = state.holders.find(item => item.holderId === "TEST-WH-TXN-HOLD-002");
  expect(lostRecord.status).toBe("pending_compensation");
  expect(lostHolder).toMatchObject({ quantity: 1, status: "holding" });
  expect(state.material).toMatchObject({ issuedQty: 1, pendingLostQty: 1 });
  await failOn("");
  await page.locator("#lostList").getByRole("button", { name: "确认扣款并核销" }).click();
  state = await read();
  expect(state.losts.find(item => item.personName === "TEST司机乙").status).toBe("written_off");
  expect(state.holders.find(item => item.holderId === "TEST-WH-TXN-HOLD-002")).toMatchObject({ quantity: 0, status: "closed" });
  expect(state.material).toMatchObject({ issuedQty: 0, pendingLostQty: 0 });
  expect(state.ledger.filter(item => ["回收入库", "报废核销", "丢失核销"].includes(item.type))).toHaveLength(3);

  await page.evaluate(() => {
    const holders = JSON.parse(localStorage.getItem("materialHolders"));
    holders.push({ holderId: "TEST-WH-TXN-HOLD-003", personName: "TEST司机丙", materialId: "TEST-WH-TXN-MAT-001", quantity: 1, status: "holding" });
    localStorage.setItem("materialHolders", JSON.stringify(holders));
    const materials = JSON.parse(localStorage.getItem("warehouseMaterials"));
    materials[0].issuedQty = 1;
    materials[0].pendingLostQty = 2;
    localStorage.setItem("warehouseMaterials", JSON.stringify(materials));
    const losses = JSON.parse(localStorage.getItem("materialLostRecords"));
    losses.push({ lostId: "TEST-WH-TXN-LOST-OVER-001", personName: "TEST司机丙", materialId: "TEST-WH-TXN-MAT-001", materialName: "TEST安全帽", quantity: 2, compensationAmount: 40, status: "pending_compensation" });
    localStorage.setItem("materialLostRecords", JSON.stringify(losses));
    window.renderAll();
  });
  const beforeInsufficientHolding = await read();
  await page.locator("#lostList").getByRole("button", { name: "确认扣款并核销" }).first().click();
  const afterInsufficientHolding = await read();
  expect(dialogs.at(-1)).toContain("持有记录不足");
  expect(afterInsufficientHolding.material).toEqual(beforeInsufficientHolding.material);
  expect(afterInsufficientHolding.holders).toEqual(beforeInsufficientHolding.holders);
  expect(afterInsufficientHolding.losts).toEqual(beforeInsufficientHolding.losts);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

