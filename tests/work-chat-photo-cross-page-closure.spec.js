"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/9ioAAAAASUVORK5CYII=",
  "base64"
);

test("TEST工作聊天图片跨工作端显示、刷新留存并支持放大查看", async ({ page, context }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));

  await context.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!["GET", "HEAD"].includes(request.method()) || url.origin !== ORIGIN) {
      blocked.push(`${request.method()} ${request.url()}`);
      return route.abort();
    }

    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const body = await fs.readFile(file);
      const ext = path.extname(file).toLowerCase();
      const contentType = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing TEST asset" });
    }
  });

  await page.goto(`${ORIGIN}/index.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const people = [
      { personId: "TEST-CHAT-PHOTO-A", employeeNo: "TEST-CHAT-PHOTO-A", name: "TEST图片司机甲", position: "汽车司机", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用" },
      { personId: "TEST-CHAT-PHOTO-B", employeeNo: "TEST-CHAT-PHOTO-B", name: "TEST图片司机乙", position: "汽车司机", team: "生产B组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用" }
    ];
    localStorage.setItem("personnelRecords", JSON.stringify(people));
    localStorage.setItem("currentPersonId", "TEST-CHAT-PHOTO-A");
    localStorage.setItem("selectedPosition", "汽车司机");
    localStorage.setItem("mineWorkChatMessagesV1", "[]");
  });

  await page.goto(`${ORIGIN}/driver-work.html`, { waitUntil: "domcontentloaded" });
  const peer = await context.newPage();
  peer.on("pageerror", error => errors.push(error.message));
  await page.evaluate(() => {
    localStorage.setItem("currentPersonId", "TEST-CHAT-PHOTO-B");
    localStorage.setItem("selectedPosition", "汽车司机");
  });
  await peer.goto(`${ORIGIN}/driver-work.html`, { waitUntil: "domcontentloaded" });
  await page.locator("#mineChatLauncher").click();
  await peer.locator("#mineChatLauncher").click();

  for (const item of [
    { text: "TEST: 图片和文字跨工作端传递", name: "TEST-work-chat-photo-text.png", type: "text_image" },
    { text: "", name: "TEST-work-chat-photo-only.png", type: "image" }
  ]) {
    if (item.text) await page.locator("#mineChatInput").fill(item.text);
    await page.locator("#mineChatPhotoInput").setInputFiles({ name: item.name, mimeType: "image/png", buffer: PNG });
    await expect.poll(() => page.locator("#mineChatImagePreview").getAttribute("src")).toMatch(/^data:image\/jpeg;base64,/);
    await expect(page.locator("#mineChatImageName")).toHaveText(item.name);
    await page.locator("#mineChatSend").click();

    const photo = peer.locator(`.mine-chat-photo[alt="${item.name}"]`);
    await expect(photo).toBeVisible();
    await expect.poll(() => photo.evaluate(image => image.naturalWidth)).toBe(1);
    if (item.text) await expect(peer.locator("#mineChatMessages")).toContainText(item.text);
  }

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("mineWorkChatMessagesV1") || "[]"));
  expect(stored).toHaveLength(2);
  expect(stored.map(message => ({ senderPersonId: message.senderPersonId, imageName: message.imageName, messageType: message.messageType }))).toEqual([
    { senderPersonId: "TEST-CHAT-PHOTO-A", imageName: "TEST-work-chat-photo-text.png", messageType: "text_image" },
    { senderPersonId: "TEST-CHAT-PHOTO-A", imageName: "TEST-work-chat-photo-only.png", messageType: "image" }
  ]);
  expect(stored.every(message => /^data:image\/jpeg;base64,/.test(message.imageData))).toBe(true);

  await peer.locator('.mine-chat-photo[alt="TEST-work-chat-photo-text.png"]').click();
  await expect(peer.locator(".mine-chat-image-lightbox")).toBeVisible();
  await peer.locator(".mine-chat-image-lightbox").click();
  await expect(peer.locator(".mine-chat-image-lightbox")).toHaveCount(0);
  await peer.reload({ waitUntil: "domcontentloaded" });
  await peer.locator("#mineChatLauncher").click();
  await expect(peer.locator(".mine-chat-photo")).toHaveCount(2);
  await expect(peer.locator('.mine-chat-photo[alt="TEST-work-chat-photo-only.png"]')).toBeVisible();
  await expect(peer.locator("#mineChatMessages")).toContainText("TEST: 图片和文字跨工作端传递");

  await page.screenshot({ path: require("./evidence-path.cjs").evidencePath("证据_工作聊天图片当前主线跨页面", "work-chat-photo-cross-page-current-main"), fullPage: true });
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

test("TEST工作聊天图片可以从维修员端送达挖机和辅助车辆端", async ({ page, context }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  await context.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!["GET", "HEAD"].includes(request.method()) || url.origin !== ORIGIN) {
      blocked.push(`${request.method()} ${request.url()}`);
      return route.abort();
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const body = await fs.readFile(file);
      const ext = path.extname(file).toLowerCase();
      const contentType = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing TEST asset" });
    }
  });

  await page.goto(`${ORIGIN}/index.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const people = [
      { personId: "TEST-CHAT-CROSS-MAINT", employeeNo: "TEST-CHAT-CROSS-MAINT", name: "TEST跨岗维修员", position: "维修员", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用" },
      { personId: "TEST-CHAT-CROSS-EXC", employeeNo: "TEST-CHAT-CROSS-EXC", name: "TEST跨岗挖机司机", position: "挖机司机", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用" },
      { personId: "TEST-CHAT-CROSS-AUX", employeeNo: "TEST-CHAT-CROSS-AUX", name: "TEST跨岗辅助司机", position: "辅助车辆司机", team: "生产B组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用" }
    ];
    localStorage.setItem("personnelRecords", JSON.stringify(people));
    localStorage.setItem("currentPersonId", "TEST-CHAT-CROSS-MAINT");
    localStorage.setItem("selectedPosition", "维修员");
    localStorage.setItem("mineWorkChatMessagesV1", "[]");
  });

  await page.goto(`${ORIGIN}/maintenance-worker.html`, { waitUntil: "domcontentloaded" });
  const excavator = await context.newPage();
  excavator.on("pageerror", error => errors.push(error.message));
  await page.evaluate(() => {
    localStorage.setItem("currentPersonId", "TEST-CHAT-CROSS-EXC");
    localStorage.setItem("selectedPosition", "挖机司机");
  });
  await excavator.goto(`${ORIGIN}/excavator.html`, { waitUntil: "domcontentloaded" });

  const auxiliary = await context.newPage();
  auxiliary.on("pageerror", error => errors.push(error.message));
  await page.evaluate(() => {
    localStorage.setItem("currentPersonId", "TEST-CHAT-CROSS-AUX");
    localStorage.setItem("selectedPosition", "辅助车辆司机");
  });
  await auxiliary.goto(`${ORIGIN}/auxiliary.html`, { waitUntil: "domcontentloaded" });
  for (const workPage of [page, excavator, auxiliary]) {
    await expect(workPage.locator("#mineChatLauncher")).toBeVisible();
    await workPage.locator("#mineChatLauncher").click();
  }

  const messageText = "TEST: 维修员跨岗发送现场图片";
  const fileName = "TEST-maintenance-cross-role.png";
  await page.locator("#mineChatInput").fill(messageText);
  await page.locator("#mineChatPhotoInput").setInputFiles({ name: fileName, mimeType: "image/png", buffer: PNG });
  await expect.poll(() => page.locator("#mineChatImagePreview").getAttribute("src")).toMatch(/^data:image\/jpeg;base64,/);
  await page.locator("#mineChatSend").click();

  for (const receiver of [excavator, auxiliary]) {
    const photo = receiver.locator(`.mine-chat-photo[alt="${fileName}"]`);
    await expect(photo).toBeVisible();
    await expect.poll(() => photo.evaluate(image => image.naturalWidth)).toBe(1);
    await expect(receiver.locator("#mineChatMessages")).toContainText(messageText);
  }

  const messages = await page.evaluate(() => JSON.parse(localStorage.getItem("mineWorkChatMessagesV1") || "[]"));
  expect(messages).toHaveLength(1);
  expect(messages[0]).toMatchObject({ senderPersonId: "TEST-CHAT-CROSS-MAINT", senderName: "TEST跨岗维修员", imageName: fileName, messageType: "text_image" });
  expect(messages[0].imageData).toMatch(/^data:image\/jpeg;base64,/);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

