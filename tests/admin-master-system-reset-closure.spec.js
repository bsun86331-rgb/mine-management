"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST管理员系统归零：取消和错误口令不改数据，确认后备份快照并清空", async ({ page }) => {
  const errors = [];
  const blocked = [];

  page.on("pageerror", error => errors.push(error.message));

  page.on("request", request => {
    const url = new URL(request.url());

    if (
      url.protocol !== "blob:" &&
      (
        !["GET", "HEAD"].includes(request.method()) ||
        url.origin !== ORIGIN
      )
    ) {
      blocked.push(`${request.method()} ${request.url()}`);
    }
  });

  await page.addInitScript(() => {
    if (!location.pathname.endsWith("/admin-master.html")) {
      return;
    }

    localStorage.clear();
    sessionStorage.clear();

    localStorage.setItem("personnelRecords", JSON.stringify([
      {
        personId: "TEST-ADMIN-001",
        name: "TEST管理员",
        phone: "13800000001",
        position: "管理员",
        status: "active",
        approvalStatus: "approved",
        personnelStatus: "在职可用"
      }
    ]));
    localStorage.setItem("productionTaskRecords", JSON.stringify([
      { taskId: "TEST-TASK-001", name: "TEST任务" }
    ]));
    localStorage.setItem("adminPersonId", "TEST-ADMIN-001");
    localStorage.setItem("testSentinel", "must be included in backup");
    localStorage.setItem("brokenTestJson", "{broken");

    sessionStorage.setItem("managementSession", JSON.stringify({
      verified: true,
      position: "管理员",
      personId: "TEST-ADMIN-001",
      expiresAt: Date.now() + 60_000
    }));
    sessionStorage.setItem("testSessionSentinel", "must be included in backup");

    // Capture the generated backup Blob without relying on the runner's
    // operating-system download integration.
    window.__systemResetBackupText = "";
    window.__systemResetDownloadIntent = null;

    const createObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = blob => {
      blob.text().then(text => {
        window.__systemResetBackupText = text;
      });
      return createObjectURL(blob);
    };

    const anchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) {
        window.__systemResetDownloadIntent = {
          filename: this.download,
          href: this.href
        };
      }

      return anchorClick.call(this);
    };
  });

  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.protocol === "blob:") {
      return route.continue();
    }

    if (
      !["GET", "HEAD"].includes(request.method()) ||
      url.origin !== ORIGIN
    ) {
      blocked.push(`${request.method()} ${request.url()}`);
      return route.abort();
    }

    const relative = decodeURIComponent(url.pathname).slice(1) || "index.html";
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
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  await page.goto(`${ORIGIN}/admin-master.html`);
  await expect(page).toHaveTitle(/管理员基础资料中心/);
  await expect(page.locator("#adminSystemResetButton")).toBeVisible();

  const readStorage = () => page.evaluate(() => ({
    local: Object.fromEntries(
      Array.from({ length: localStorage.length }, (_, index) => {
        const key = localStorage.key(index);
        return [key, localStorage.getItem(key)];
      })
    ),
    session: Object.fromEntries(
      Array.from({ length: sessionStorage.length }, (_, index) => {
        const key = sessionStorage.key(index);
        return [key, sessionStorage.getItem(key)];
      })
    )
  }));

  await page.locator("#adminSystemResetButton").click();
  await expect(page.locator("#systemResetModal")).toHaveAttribute("aria-hidden", "false");
  const before = await readStorage();

  await page.locator(".system-reset-cancel").click();
  expect(await readStorage()).toEqual(before);

  await page.locator("#adminSystemResetButton").click();
  await page.locator("#systemResetNextButton").click();
  await page.locator("#systemResetConfirmInput").fill("NOT-RESET");
  await page.locator("#systemResetExecuteButton").click();
  await expect(page.locator("#systemResetStatus")).toContainText("没有执行任何删除");
  expect(await readStorage()).toEqual(before);

  await page.locator("#systemResetConfirmInput").fill("RESET");
  const downloadPromise = page.waitForEvent("download", { timeout: 10_000 });
  await page.locator("#systemResetExecuteButton").click();
  const download = await downloadPromise;

  await page.waitForFunction(
    () => Boolean(
      window.__systemResetBackupText &&
      window.__systemResetDownloadIntent
    ),
    null,
    { timeout: 3_000 }
  );

  const captured = await page.evaluate(() => ({
    text: window.__systemResetBackupText,
    intent: window.__systemResetDownloadIntent
  }));
  const backup = JSON.parse(captured.text);
  expect(download.suggestedFilename()).toMatch(/^mine-management-full-backup-.*\.json$/);
  const downloadedPath = await download.path();
  expect(downloadedPath).toBeTruthy();
  const downloadedBackup = JSON.parse(await fs.readFile(downloadedPath, "utf8"));
  expect(downloadedBackup).toEqual(backup);

  expect(backup.localStorage).toEqual(before.local);
  expect(backup.sessionStorage).toEqual(before.session);
  expect(backup.meta.localStorageKeyCount).toBe(Object.keys(before.local).length);
  expect(backup.meta.sessionStorageKeyCount).toBe(Object.keys(before.session).length);
  expect(captured.intent.filename).toMatch(/^mine-management-full-backup-.*\.json$/);
  expect(captured.intent.href).toMatch(/^blob:/);

  await page.waitForURL("**/index.html?reset=1");
  await expect.poll(async () => readStorage()).toEqual({ local: {}, session: {} });

  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
