"use strict";

const { test, expect } = require("@playwright/test");
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");

async function reserveLoopbackPort() {
  const socket = net.createServer();

  await new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", resolve);
  });

  const address = socket.address();
  await new Promise((resolve, reject) => {
    socket.close(error => error ? reject(error) : resolve());
  });

  return address.port;
}

test("TEST快速检查报告明确完整Playwright仍是独立发布门槛", async () => {
  const source = await require("node:fs/promises").readFile(
    path.join(__dirname, "robot-control-server.js"),
    "utf8"
  );
  expect(source).toContain("核心/黄金检查通过（完整 Playwright 仍需单独通过）");
  expect(source).toContain("发布前仍需独立运行并核对完整 Playwright 套件");
  expect(source).not.toContain('? "可发布"');
});

test("TEST机器人控制API拒绝缺失命令和所有已支持格式的正式业务ID", async () => {
  const port = await reserveLoopbackPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const serverPath = path.join(__dirname, "robot-control-server.js");
  const server = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      ROBOT_PORT: String(port),
      ROBOT_BASE_URL: "http://127.0.0.1:9/"
    },
    stdio: ["ignore", "ignore", "pipe"]
  });

  let serverErrors = "";
  server.stderr.on("data", chunk => {
    serverErrors += chunk.toString();
  });

  try {
    await expect.poll(async () => {
      if (server.exitCode !== null) {
        throw new Error(`robot-control-server exited early: ${serverErrors}`);
      }

      try {
        const response = await fetch(`${baseUrl}/api/status`);
        return response.status;
      } catch {
        return 0;
      }
    }, { timeout: 10_000 }).toBe(200);

    const statusResponse = await fetch(`${baseUrl}/api/status`);
    const status = await statusResponse.json();
    expect(status.ok).toBe(true);
    expect(status.playwright.connected).toBe(false);
    const readinessResponse = await fetch(baseUrl + "/api/readiness");
    expect(readinessResponse.status).toBe(200);
    const readiness = await readinessResponse.json();
    expect(readiness.ok).toBe(true);
    expect(readiness.readiness).toEqual({
      core: null,
      golden: null,
      updatedAt: null
    });
    expect(Array.isArray(readiness.coverage)).toBe(true);
    expect(readiness.coverage.length).toBeGreaterThan(0);
    expect(readiness.coverage.every(item =>
      typeof item.key === "string" &&
      typeof item.label === "string" &&
      ["uncovered", "pass", "fail"].includes(item.status)
    )).toBe(true);

    const latestReportResponse = await fetch(baseUrl + "/api/report/latest");
    expect(latestReportResponse.status).toBe(200);
    const latestReport = await latestReportResponse.json();
    expect(latestReport.ok).toBe(true);
    expect(latestReport.latestReport).toEqual({
      exists: false,
      markdown: null,
      json: null
    });

    const panelResponse = await fetch(baseUrl);
    expect(panelResponse.status).toBe(200);
    expect(await panelResponse.text()).toContain("机器人测试控制中心");

    const emptyCommand = await fetch(`${baseUrl}/api/command`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command: "   " })
    });
    expect(emptyCommand.status).toBe(400);
    expect((await emptyCommand.json()).error).toContain("测试命令不能为空");

    const realIds = [
      "TASK-001",
      "TRIP-001",
      "DRIVER-001",
      "VEHICLE-001",
      "SHIFT-001",
      "ZONE-001",
      "REQ-001",
      "REQUEST-001",
      "PERSON-001",
      "EMPLOYEE-001",
      "EQUIPMENT-001",
      "EQUIP-001",
      "MATERIAL-001",
      "ORDER-001"
    ];

    for (const id of realIds) {
      const response = await fetch(`${baseUrl}/api/command`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target: "TestManager", command: `核对 ${id}` })
      });

      expect(response.status, `ID ${id} must be rejected`).toBe(400);
      expect((await response.json()).error).toContain("禁止操作非 TEST 数据");
    }

    const unmatchedCommandResponse = await fetch(baseUrl + "/api/command", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target: "TestManager",
        command: "请检查一个尚未接入的虚拟场景，不要执行具体测试"
      })
    });
    expect(unmatchedCommandResponse.status).toBe(200);
    const unmatchedCommand = await unmatchedCommandResponse.json();
    expect(unmatchedCommand.ok).toBe(true);
    expect(unmatchedCommand.status).toBe("waiting");
    expect(unmatchedCommand.action).toBe("natural-language-no-match");

    const ambiguousCommandResponse = await fetch(baseUrl + "/api/command", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target: "TestManager",
        command: "把维修和库房跑一下"
      })
    });
    expect(ambiguousCommandResponse.status).toBe(200);
    const ambiguousCommand = await ambiguousCommandResponse.json();
    expect(ambiguousCommand.ok).toBe(true);
    expect(ambiguousCommand.status).toBe("waiting");
    expect(ambiguousCommand.action).toBe("natural-language-awaiting-confirmation");
    expect(ambiguousCommand.guessedAction).toBeTruthy();

    const cancelCommandResponse = await fetch(baseUrl + "/api/command", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target: "TestManager", command: "取消" })
    });
    expect(cancelCommandResponse.status).toBe(200);
    const cancelCommand = await cancelCommandResponse.json();
    expect(cancelCommand.ok).toBe(true);
    expect(cancelCommand.status).toBe("waiting");
    expect(cancelCommand.action).toBe("natural-language-confirmation-cancelled");
    expect(cancelCommand.cancelledAction).toBe(ambiguousCommand.guessedAction);

    const finalStatusResponse = await fetch(`${baseUrl}/api/status`);
    const finalStatus = await finalStatusResponse.json();
    expect(finalStatus.playwright.connected).toBe(false);
  } finally {
    if (server.exitCode === null) {
      const exited = new Promise(resolve => server.once("exit", resolve));
      server.kill("SIGTERM");
      await Promise.race([
        exited,
        new Promise(resolve => setTimeout(resolve, 3_000))
      ]);
      if (server.exitCode === null) {
        server.kill("SIGKILL");
      }
    }
  }
});
