"use strict";
const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

test("首页保留排土管理入口，但不显示生产任务看板或工作聊天入口", async () => {
  const html = await fs.readFile(path.resolve(__dirname, "..", "index.html"), "utf8");
  expect(html).toContain("排土管理");
  expect(html).toContain("进入排土管理工作页面");
  expect(html).not.toContain("生产任务看板");
  expect(html).not.toContain("工作聊天");
});
