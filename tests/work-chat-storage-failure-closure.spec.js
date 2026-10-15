"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST聊天消息本地存储失败时保留草稿且重试只发一条", async ({ page }) => {
  const errors = [];
  const blocked = [];
  const alerts = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", async dialog => {
    alerts.push(dialog.message());
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
      const ext = path.extname(file);
      const contentType = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  await page.addInitScript(() => {
    const person = {
      personId: "TEST-CHAT-STORAGE-001",
      employeeId: "TEST-CHAT-STORAGE-001",
      employeeNo: "TEST-CHAT-STORAGE-001",
      name: "TEST存储故障司机",
      position: "汽车司机",
      team: "生产A组",
      status: "approved",
      approvalStatus: "approved",
      personnelStatus: "在职可用",
      testFixture: true
    };
    localStorage.setItem("personnelRecords", JSON.stringify([person]));
    localStorage.setItem("currentPersonId", person.personId);
    localStorage.setItem("selectedPosition", person.position);
    localStorage.setItem("mineWorkChatMessagesV1", "[]");
  });

  await page.goto(`${ORIGIN}/driver-work.html`, { waitUntil: "domcontentloaded" });
  await page.locator("#mineChatLauncher").click();
  const messageText = "TEST: 存储失败后必须保留并允许重试";
  await page.locator("#mineChatInput").fill(messageText);

  await page.evaluate(() => {
    window.__chatOriginalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "mineWorkChatMessagesV1") {
        throw new DOMException("TEST quota exceeded", "QuotaExceededError");
      }
      return window.__chatOriginalSetItem.call(this, key, value);
    };
  });
  await page.locator("#mineChatSend").click();
  await expect.poll(() => alerts.length).toBe(1);
  expect(alerts[0]).toContain("本地存储空间不足");
  await expect(page.locator("#mineChatInput")).toHaveValue(messageText);
  await expect(page.locator("#mineChatMessages")).not.toContainText(messageText);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("mineWorkChatMessagesV1") || "[]"))).toHaveLength(0);

  await page.evaluate(() => { Storage.prototype.setItem = window.__chatOriginalSetItem; });
  await page.locator("#mineChatSend").click();
  await expect(page.locator("#mineChatMessages")).toContainText(messageText);
  await expect(page.locator("#mineChatInput")).toHaveValue("");
  const messages = await page.evaluate(() => JSON.parse(localStorage.getItem("mineWorkChatMessagesV1") || "[]"));
  expect(messages).toHaveLength(1);
  expect(messages[0]).toMatchObject({ senderPersonId: "TEST-CHAT-STORAGE-001", text: messageText });
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

