"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const EXPECTED_CORE_CACHE_VERSION = "2.0.16";
const EXPECTED_BOARD_CACHE_VERSION = "2.0.13";

test("所有生产看板页面使用当前共享核心缓存版本", async () => {
  const pages = (await fs.readdir(ROOT)).filter(name => name.toLowerCase().endsWith(".html"));
  const references = [];
  const boardReferences = [];
  for (const page of pages) {
    const source = await fs.readFile(path.join(ROOT, page), "utf8");
    const tags = [...source.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']*production-board-core\.js[^"']*)["'][^>]*>/gi)];
    for (const tag of tags) {
      const src = tag[1];
      const version = src.match(/[?&]v=([^&]+)/)?.[1] || "";
      references.push({ page, src, version });
    }
    const boardTags = [...source.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']*production-board\.js[^"']*)["'][^>]*>/gi)];
    for (const tag of boardTags) {
      const src = tag[1];
      const version = src.match(/[?&]v=([^&]+)/)?.[1] || "";
      boardReferences.push({ page, src, version });
    }
  }
  expect(references.length, "应该发现共享看板核心脚本引用").toBeGreaterThan(0);
  expect(boardReferences.length, "应该发现共享看板界面脚本引用").toBeGreaterThan(0);
  const indexSource = await fs.readFile(path.join(ROOT, "index.html"), "utf8");
  const boardSource = await fs.readFile(path.join(ROOT, "js", "production-board.js"), "utf8");
  expect(indexSource).toContain("系统版本 V2.14.17");
  expect(boardSource).toContain("看板 V2.0.13");
  expect(references.filter(item => item.version !== EXPECTED_CORE_CACHE_VERSION),
    "共享核心缓存版本必须与当前代码统一：" + JSON.stringify(references)).toEqual([]);
  expect(boardReferences.filter(item => item.version !== EXPECTED_BOARD_CACHE_VERSION),
    "共享看板界面缓存版本必须与当前代码统一：" + JSON.stringify(boardReferences)).toEqual([]);
});
