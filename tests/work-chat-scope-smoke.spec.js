"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("工作聊天仅出现在个人工作端并写入 TEST 本机记录", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
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
  await page.goto(`${ORIGIN}/index.html`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#mineChatLauncher")).toHaveCount(0);
  await page.evaluate(() => {
    const personId = "TEST-CHAT-DRIVER-001";
    localStorage.setItem("personnelRecords", JSON.stringify([{ personId, employeeId: personId, employeeNo: personId, name: "TEST聊天司机", position: "汽车司机", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true }]));
    localStorage.setItem("currentPersonId", personId);
    localStorage.setItem("selectedPosition", "汽车司机");
  });
  await page.goto(`${ORIGIN}/driver-work.html`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#mineChatLauncher")).toBeVisible();
  await page.locator("#mineChatLauncher").click();
  await page.locator("#mineChatInput").fill("TEST: 工作聊天本机隔离检查");
  await page.locator("#mineChatSend").click();
  await expect(page.locator("#mineChatMessages")).toContainText("TEST: 工作聊天本机隔离检查");
  const messages = await page.evaluate(() => JSON.parse(localStorage.getItem("mineWorkChatMessagesV1") || "[]"));
  expect(messages).toHaveLength(1);
  expect(messages[0]).toMatchObject({ senderPersonId: "TEST-CHAT-DRIVER-001", senderName: "TEST聊天司机", text: "TEST: 工作聊天本机隔离检查" });
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
