"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("工作聊天仅出现在个人工作端并支持不同身份实时互发、回看和未读提醒", async ({ page, context }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  await context.route("**/*", async route => {
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
    const people = [
      { personId: "TEST-CHAT-DRIVER-001", employeeId: "TEST-CHAT-DRIVER-001", employeeNo: "TEST-CHAT-DRIVER-001", name: "TEST聊天司机甲", position: "汽车司机", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true },
      { personId: "TEST-CHAT-DRIVER-002", employeeId: "TEST-CHAT-DRIVER-002", employeeNo: "TEST-CHAT-DRIVER-002", name: "TEST聊天司机乙", position: "汽车司机", team: "生产B组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true }
    ];
    localStorage.setItem("personnelRecords", JSON.stringify(people));
    localStorage.setItem("currentPersonId", "TEST-CHAT-DRIVER-001");
    localStorage.setItem("selectedPosition", "汽车司机");
  });
  await page.goto(`${ORIGIN}/driver-work.html`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#mineChatLauncher")).toBeVisible();

  const peer = await context.newPage();
  peer.on("pageerror", error => errors.push(error.message));
  await page.evaluate(() => {
    localStorage.setItem("currentPersonId", "TEST-CHAT-DRIVER-002");
    localStorage.setItem("selectedPosition", "汽车司机");
  });
  await peer.goto(`${ORIGIN}/driver-work.html`, { waitUntil: "domcontentloaded" });
  await expect(peer.locator("#mineChatLauncher")).toBeVisible();

  await page.locator("#mineChatLauncher").click();
  await page.locator("#mineChatInput").fill("TEST: 司机甲发给全员群的消息");
  await page.locator("#mineChatSend").click();
  await expect(peer.locator("#mineChatMessages")).toContainText("TEST: 司机甲发给全员群的消息");
  await expect(peer.locator("#mineChatLauncher")).toHaveAttribute("aria-label", /1 条未读消息/);

  await peer.locator("#mineChatLauncher").click();
  await expect(peer.locator("#mineChatLauncher")).toHaveAttribute("aria-label", "打开工作聊天");
  await page.locator("#mineChatClose").click();
  await peer.locator("#mineChatInput").fill("TEST: 司机乙回复全员群");
  await peer.locator("#mineChatSend").click();
  await expect(page.locator("#mineChatMessages")).toContainText("TEST: 司机乙回复全员群");
  await expect(page.locator("#mineChatLauncher")).toHaveAttribute("aria-label", /1 条未读消息/);

  await page.locator("#mineChatLauncher").click();
  await expect(page.locator("#mineChatLauncher")).toHaveAttribute("aria-label", "打开工作聊天");
  await expect(page.locator("#mineChatMessages")).toContainText("TEST: 司机甲发给全员群的消息");
  await expect(page.locator("#mineChatMessages")).toContainText("TEST: 司机乙回复全员群");
  const messages = await page.evaluate(() => JSON.parse(localStorage.getItem("mineWorkChatMessagesV1") || "[]"));
  expect(messages).toHaveLength(2);
  expect(messages.map(({ senderPersonId, senderName, text }) => ({ senderPersonId, senderName, text }))).toEqual([
    { senderPersonId: "TEST-CHAT-DRIVER-001", senderName: "TEST聊天司机甲", text: "TEST: 司机甲发给全员群的消息" },
    { senderPersonId: "TEST-CHAT-DRIVER-002", senderName: "TEST聊天司机乙", text: "TEST: 司机乙回复全员群" }
  ]);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

