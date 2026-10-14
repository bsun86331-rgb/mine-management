"use strict";

const { test, expect } = require("@playwright/test");
const {
  assertTestId,
  assertTestIds,
  assertTestRecord,
  assertSafeWrite,
  assertSafeCommand
} = require("./test-safety-guard");

test("TEST安全守卫接受合法TEST标识并规范空格", () => {
  expect(assertTestId(" TEST-TRIP-001 ", "趟次")).toBe("TEST-TRIP-001");
  expect(assertTestIds(["TEST-DRIVER-001", "TEST-TRUCK-001"], "资源")).toEqual([
    "TEST-DRIVER-001",
    "TEST-TRUCK-001"
  ]);
});

test("TEST安全守卫拒绝空白和非TEST标识", () => {
  expect(() => assertTestId("", "趟次")).toThrow(/ID为空/);
  expect(() => assertTestId("REAL-TRIP-001", "趟次")).toThrow(/禁止操作非 TEST 数据/);
  expect(() => assertTestIds(["TEST-DRIVER-001", "REAL-TRUCK-001"], "资源")).toThrow(/禁止操作非 TEST 数据/);
});

test("TEST安全守卫检查记录中所有可识别的业务ID", () => {
  expect(assertTestRecord({ tripId: "TEST-TRIP-001", driverId: "TEST-DRIVER-001", vehicleNumber: "TEST-TRUCK-001" })).toBe(true);
  expect(() => assertTestRecord({ tripId: "TEST-TRIP-001", vehicleNumber: "REAL-TRUCK-001" })).toThrow(/禁止操作非 TEST 数据/);
  expect(() => assertTestRecord({ note: "TEST记录但没有ID" })).toThrow(/没有找到可验证的 TEST ID/);
});

test("TEST安全守卫只允许白名单写入动作和TEST目标", () => {
  expect(assertSafeWrite("complete", "TEST-TRIP-001")).toEqual({ action: "complete", targetId: "TEST-TRIP-001" });
  expect(() => assertSafeWrite("complete", "REAL-TRIP-001")).toThrow(/禁止操作非 TEST 数据/);
  expect(() => assertSafeWrite("execute-arbitrary-code", "TEST-TRIP-001")).toThrow(/未知机器人写入动作/);
});

test("机器人命令安全检查接受完整TEST业务ID", () => {
  expect(assertSafeCommand("开始处理 TEST-TRIP-001 和 TEST-TASK-001")).toBe(true);
  expect(assertSafeCommand("TEST-EQUIPMENT-001 检查后交给 TEST-DRIVER-001")).toBe(true);
});

test("机器人命令安全检查拒绝正式业务ID和TEST/正式混合命令", () => {
  expect(() => assertSafeCommand("处理 TRIP-001")).toThrow(/禁止操作非 TEST 数据/);
  expect(() => assertSafeCommand("处理 REAL-TRIP-001")).toThrow(/禁止操作非 TEST 数据/);
  expect(() => assertSafeCommand("完成 TEST-TRIP-001，再删除 DRIVER-002")).toThrow(/禁止操作非 TEST 数据/);
});
