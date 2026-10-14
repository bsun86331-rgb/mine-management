"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("设备使用前检查入口在共享生产看板之前", async ({ page }) => {
  const pageErrors = [];
  const blocked = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.addInitScript(() => {
    const people = [
      { personId: "TEST-DISPATCH-ORDER-001", employeeId: "TEST-DISPATCH-ORDER-001", employeeNo: "TEST-DISPATCH-ORDER-001", name: "TEST调度", position: "车队长", team: "管理组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true },
      { personId: "TEST-DRIVER-ORDER-001", employeeId: "TEST-DRIVER-ORDER-001", employeeNo: "TEST-DRIVER-ORDER-001", name: "TEST汽车司机", position: "汽车司机", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true },
      { personId: "TEST-EXCAVATOR-ORDER-001", employeeId: "TEST-EXCAVATOR-ORDER-001", employeeNo: "TEST-EXCAVATOR-ORDER-001", name: "TEST挖机司机", position: "挖机司机", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true },
      { personId: "TEST-AUX-ORDER-001", employeeId: "TEST-AUX-ORDER-001", employeeNo: "TEST-AUX-ORDER-001", name: "TEST洒水车司机", position: "洒水车司机", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true },
      { personId: "TEST-FUEL-ORDER-001", employeeId: "TEST-FUEL-ORDER-001", employeeNo: "TEST-FUEL-ORDER-001", name: "TEST加油车司机", position: "加油车司机", team: "生产A组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true },
      { personId: "TEST-MAINT-WORKER-001", employeeId: "TEST-MAINT-WORKER-001", employeeNo: "TEST-MAINT-WORKER-001", name: "TEST维修员", position: "维修员", team: "维修组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true },
      { personId: "TEST-MAINT-MANAGER-001", employeeId: "TEST-MAINT-MANAGER-001", employeeNo: "TEST-MAINT-MANAGER-001", name: "TEST维修管理", position: "维修管理", team: "维修组", status: "approved", approvalStatus: "approved", personnelStatus: "在职可用", testFixture: true }
    ];
    localStorage.setItem("personnelRecords", JSON.stringify(people));
    if (location.pathname.endsWith("dispatch.html")) {
      localStorage.setItem("currentPersonId", "TEST-DISPATCH-ORDER-001");
      localStorage.setItem("selectedPosition", "车队长");
    } else if (location.pathname.endsWith("driver-work.html")) {
      localStorage.setItem("currentPersonId", "TEST-DRIVER-ORDER-001");
      localStorage.setItem("selectedPosition", "汽车司机");
    } else if (location.pathname.endsWith("excavator.html")) {
      localStorage.setItem("currentPersonId", "TEST-EXCAVATOR-ORDER-001");
      localStorage.setItem("selectedPosition", "挖机司机");
    } else if (location.pathname.endsWith("auxiliary.html")) {
      localStorage.setItem("currentPersonId", "TEST-AUX-ORDER-001");
      localStorage.setItem("selectedPosition", "洒水车司机");
    } else if (location.pathname.endsWith("fuel.html")) {
      localStorage.setItem("currentPersonId", "TEST-FUEL-ORDER-001");
      localStorage.setItem("selectedPosition", "加油车司机");
    } else if (location.pathname.endsWith("maintenance-worker.html")) {
      localStorage.setItem("currentPersonId", "TEST-MAINT-WORKER-001");
      localStorage.setItem("selectedPosition", "维修员");
    } else if (location.pathname.endsWith("maintenance.html")) {
      localStorage.setItem("currentPersonId", "TEST-MAINT-MANAGER-001");
      localStorage.setItem("selectedPosition", "维修管理");
    }
  });
  await page.route("**/*", async route => {
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

  for (const filename of ["dispatch.html", "driver-work.html", "excavator.html", "auxiliary.html", "fuel.html", "maintenance-worker.html", "maintenance.html"]) {
    await page.goto(`${ORIGIN}/${filename}`, { waitUntil: "domcontentloaded" });
    const result = await page.evaluate(async () => {
      for (let i = 0; i < 30; i++) {
        const entry = document.getElementById("equipmentPreUseCard") || document.getElementById("equipmentCheckBox");
        const board = document.getElementById("production-board");
        const quick = document.getElementById("mineBottomQuickActions");
        if (entry && board && quick && entry.compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING && board.compareDocumentPosition(quick) & Node.DOCUMENT_POSITION_FOLLOWING) {
          return { entry: true, board: true, quick: true, entryBeforeBoard: true, boardBeforeQuick: true, collapsed: board.querySelector("#pb-content")?.hidden === true, ariaExpanded: board.querySelector('[data-action="toggle"]')?.getAttribute("aria-expanded") };
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      const entry = document.getElementById("equipmentPreUseCard") || document.getElementById("equipmentCheckBox");
      const board = document.getElementById("production-board");
      const quick = document.getElementById("mineBottomQuickActions");
      return { entry: !!entry, board: !!board, quick: !!quick, entryBeforeBoard: !!entry && !!board && !!(entry.compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING), boardBeforeQuick: !!board && !!quick && !!(board.compareDocumentPosition(quick) & Node.DOCUMENT_POSITION_FOLLOWING), collapsed: board?.querySelector("#pb-content")?.hidden === true, ariaExpanded: board?.querySelector('[data-action="toggle"]')?.getAttribute("aria-expanded") };
    });
    console.log(filename, result);
    expect(result, filename).toEqual({ entry: true, board: true, quick: true, entryBeforeBoard: true, boardBeforeQuick: true, collapsed: true, ariaExpanded: "false" });
  }
  expect(pageErrors).toEqual([]);
  expect(blocked).toEqual([]);
});

