"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const EXPECTED_CORE_CACHE_VERSION = "2.0.16";

test("所有生产看板页面使用当前共享核心缓存版本", async () => {
  const pages = (await fs.readdir(ROOT)).filter(name => name.toLowerCase().endsWith(".html"));
  const references = [];
  for (const page of pages) {
    const source = await fs.readFile(path.join(ROOT, page), "utf8");
    const tags = [...source.matchAll(/<script\\b[^>]*\\bsrc\\s*=\\s*["']([^"']*production-board-core\\.js[^"']*)["'][^>]*>/gi)];
    for (const tag of tags) {
      const src = tag[1];
      const version = src.match(/[?&]v=([^&]+)/)?.[1] || "";
      references.push({ page, src, version });
    }
  }
  expect(references.length, "应该发现共享看板核心脚本引用").toBeGreaterThan(0);
  expect(references.filter(item => item.version !== EXPECTED_CORE_CACHE_VERSION),
    "共享核心缓存版本必须与当前代码统一：" + JSON.stringify(references)).toEqual([]);
});
