"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");
const PHOTO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGk0AAAAASUVORK5CYII=";

async function installTestData(page, type) {
  await page.addInitScript(({ previewType, photo }) => {
    const person = {
      personId: "TEST-PRINT-P-001",
      employeeNo: "TEST-PRINT-001",
      name: "TEST打印人员",
      phone: "13800000000",
      position: "汽车司机",
      personnelCategory: "生产一线",
      team: "A",
      entryDate: "2026-01-01",
      idCardNumber: "TEST-ID-001",
      bankCardNumber: "TEST-BANK-001",
      bankName: "TEST银行",
      status: "approved",
      approvalStatus: "approved",
      profilePhoto: photo,
      idCardPhoto: photo
    };
    localStorage.setItem("personnelRecords", JSON.stringify([person]));
    sessionStorage.setItem("minePrintPreviewPayload", JSON.stringify({
      type: previewType,
      personId: person.personId,
      returnUrl: "/admin-review.html"
    }));
  }, { previewType: type, photo: PHOTO });
}

async function installLocalOnlyRoute(page, errors, blocked) {
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (!["GET", "HEAD"].includes(req.method()) || url.origin !== ORIGIN) {
      blocked.push(req.method() + " " + req.url());
      return route.abort();
    }
    const relative = decodeURIComponent(url.pathname).slice(1) || "index.html";
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const body = await fs.readFile(file);
      const ext = path.extname(file);
      const contentType = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" }[ext] || "application/octet-stream";
      return route.fulfill({ status: 200, contentType, body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });
}

test("TEST人员资料打印预览显示手机号与档案字段", async ({ page }) => {
  const errors = [];
  const blocked = [];
  await installTestData(page, "profile");
  await installLocalOnlyRoute(page, errors, blocked);
  await page.goto(ORIGIN + "/print-preview.html", { waitUntil: "domcontentloaded" });

  const sheet = page.locator("#printSheet");
  await expect(sheet).toContainText("TEST打印人员");
  await expect(sheet).toContainText("TEST-PRINT-001");
  await expect(sheet).toContainText("13800000000");
  await expect(sheet).toContainText("TEST-ID-001");
  await expect(sheet).toContainText("已通过");
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

test("TEST证件照片打印预览可单独选择照片且未选择时阻止打印", async ({ page }) => {
  const errors = [];
  const blocked = [];
  await installTestData(page, "photos");
  await installLocalOnlyRoute(page, errors, blocked);
  await page.goto(ORIGIN + "/print-preview.html", { waitUntil: "domcontentloaded" });

  const photos = page.locator("#printSheet .photo");
  await expect(photos).toHaveCount(2);
  await expect(photos.nth(0).locator("img")).toHaveAttribute("src", PHOTO);
  await photos.nth(0).locator(".photo-print-checkbox").uncheck();
  await expect(photos.nth(0)).toHaveClass(/skip-print/);
  await photos.nth(1).locator(".photo-print-checkbox").uncheck();

  const dialogPromise = page.waitForEvent("dialog").then(async dialog => {
    const message = dialog.message();
    await dialog.dismiss();
    return message;
  });
  await Promise.all([
    page.getByRole("button", { name: "打印" }).click(),
    dialogPromise
  ]);
  expect(await dialogPromise).toBe("请至少勾选一张需要打印的照片。");

  await page.getByRole("button", { name: "全选" }).click();
  await expect(photos.nth(0)).not.toHaveClass(/skip-print/);
  await expect(photos.nth(1)).not.toHaveClass(/skip-print/);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
