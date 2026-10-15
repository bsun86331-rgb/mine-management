"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createServiceHarness() {
  const storage = new Map();
  const calls = [];
  const rowsByTable = new Map();
  const localStorage = {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
    removeItem(key) {
      storage.delete(key);
    }
  };

  const fetch = async (url, options = {}) => {
    calls.push({ url, options });
    const table = decodeURIComponent(new URL(url).pathname.split("/").pop());
    const method = options.method || "GET";

    if (method === "POST") {
      const body = JSON.parse(options.body);
      rowsByTable.set(table, body);
      return {
        ok: true,
        status: 201,
        text: async () => JSON.stringify([body])
      };
    }

    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(rowsByTable.has(table) ? [rowsByTable.get(table)] : [])
    };
  };

  const window = {};
  const context = {
    window,
    localStorage,
    fetch,
    console: { log() {}, warn() {}, error() {} },
    URL
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "../js/data-service.js"), "utf8"),
    context,
    { filename: "js/data-service.js" }
  );

  return { service: window.MineDataService, calls, rowsByTable };
}

function parseSchemaTables(sql) {
  const tables = {};
  const tablePattern = /create table if not exists\s+([a-z_]+)\s*\(([\s\S]*?)\n\);/gi;
  for (const match of sql.matchAll(tablePattern)) {
    const columns = [];
    for (const line of match[2].split(/\r?\n/)) {
      const column = line.match(/^\s{2}([a-z_]+)\s+(?!(?:primary|unique|constraint|foreign|check)\b)/i);
      if (column) columns.push(column[1]);
    }
    tables[match[1]] = columns;
  }
  return tables;
}

test("Supabase 序列化契约与 PostgreSQL schema 一致，并完成隔离往返", async () => {
  const { service, calls } = createServiceHarness();
  const schemaSql = fs.readFileSync(
    path.join(__dirname, "../database/database-schema.sql"),
    "utf8"
  );
  expect(JSON.parse(JSON.stringify(service.schemaColumns))).toEqual(parseSchemaTables(schemaSql));

  service.configureSupabase({
    url: "https://supabase.test",
    anonKey: "test-only-key",
    persist: false
  });

  const result = await service.supabase.upsert("personnel", {
    personId: "TEST-PERSON-01",
    employeeNo: "TEST-001",
    name: "虚拟司机",
    position: "汽车司机",
    phone: "00000000000",
    enabled: true,
    avatarUrl: "test-avatar.png",
    extra: { fixture: "TEST-ONLY" }
  });

  const posted = calls[0];
  const requestBody = JSON.parse(posted.options.body);
  expect(posted.options.method).toBe("POST");
  expect(requestBody).toMatchObject({
    person_id: "TEST-PERSON-01",
    employee_no: "TEST-001",
    position: "汽车司机",
    enabled: true,
    extra: {
      fixture: "TEST-ONLY",
      avatarUrl: "test-avatar.png"
    }
  });
  expect(requestBody).not.toHaveProperty("personId");
  expect(result[0]).toMatchObject({
    personId: "TEST-PERSON-01",
    employeeNo: "TEST-001",
    avatarUrl: "test-avatar.png",
    fixture: "TEST-ONLY"
  });

  const listed = await service.supabase.list("personnel");
  expect(listed[0].personId).toBe("TEST-PERSON-01");
  expect(listed[0].phone).toBe("00000000000");
  expect(listed[0].avatarUrl).toBe("test-avatar.png");

  const callsBeforeInvalidWrite = calls.length;
  await expect(
    service.supabase.upsert("system_settings", {
      settingKey: "TEST-ONLY",
      localOnlyFlag: true
    })
  ).rejects.toThrow("Supabase schema 不支持字段: system_settings.localOnlyFlag");
  expect(calls).toHaveLength(callsBeforeInvalidWrite);
});
