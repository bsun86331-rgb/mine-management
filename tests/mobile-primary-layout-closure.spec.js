"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST mobile primary pages reveal horizontal overflow", async ({ page }) => {
  const blocked = [];
  const errors = [];
  const result = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", dialog => dialog.accept());
  await page.route("**/*", async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (!(["GET", "HEAD"].includes(req.method()) && url.origin === ORIGIN)) {
      blocked.push(`${req.method()} ${req.url()}`);
      return route.abort();
    }
    const file = path.resolve(ROOT, decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html");
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const ext = path.extname(file).toLowerCase();
      const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" }[ext] || "application/octet-stream";
      return route.fulfill({ status: 200, contentType: mime, body: await fs.readFile(file) });
    } catch {
      return route.fulfill({ status: 404, body: "missing" });
    }
  });

  const routes = [
    ["index.html", "管理员"], ["person-register.html?position=汽车司机", "汽车司机"],
    ["dispatch.html", "车队长"], ["driver-work.html", "汽车司机"],
    ["excavator.html", "挖机司机"], ["auxiliary.html", "洒水车司机"],
    ["attendance.html", "管理员"], ["maintenance-report.html", "汽车司机"],
    ["maintenance.html", "维修管理"], ["maintenance-worker.html", "维修员"],
    ["fuel.html", "加油车司机"], ["report-center.html", "管理员"],
    ["warehouse.html", "库房管理"], ["material-request.html", "汽车司机"],
    ["payroll-settings.html", "管理员"]
  ];
  const positions = [...new Set(routes.map(([, role]) => role))];
  const people = positions.map((role, i) => ({
    personId: `TEST-RESP-${i}`, employeeNo: `TEST-RESP-${i}`, name: `TEST${role}`,
    position: role, team: "TEST组", status: "approved", approvalStatus: "approved",
    personnelStatus: "在职可用", testFixture: true
  }));

  for (const [route, role] of routes) {
    const person = people.find(item => item.position === role);
    await page.goto(`${ORIGIN}/index.html`);
    await page.evaluate(({ people, person, role }) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem("personnelRecords", JSON.stringify(people));
      localStorage.setItem("currentPersonId", person.personId);
      localStorage.setItem("selectedPosition", role);
      localStorage.setItem("driverProfile", JSON.stringify({ ...person, status: "approved", approvalStatus: "approved" }));
      localStorage.setItem("managementSession", JSON.stringify({ verified: true, role, personId: person.personId, expiresAt: Date.now() + 3600000 }));
      localStorage.setItem("dispatchUserProfile", JSON.stringify(person));
    }, { people, person, role });
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      try {
        await page.goto(`${ORIGIN}/${route}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(80);
        const layout = await page.evaluate(() => ({
          path: location.pathname,
          viewport: document.documentElement.clientWidth,
          document: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
          title: document.title
        }));
        const overflow = layout.document > layout.viewport || layout.body > layout.viewport;
        result.push({ route, requestedWidth: width, ...layout, overflow });
        expect(layout.path, `Unexpected redirect while checking ${route}`).toBe(`/${route.split("?")[0]}`);
        expect(overflow, `${route} overflows at ${width}px`).toBe(false);
      } catch (error) {
        result.push({ route, requestedWidth: width, error: error.message });
        throw error;
      }
    }
  }
  console.log("MOBILE LAYOUT PROBE", JSON.stringify(result));
  console.log("MOBILE LAYOUT ERRORS", JSON.stringify({ errors, blocked }));
  expect(result).toHaveLength(routes.length * 2);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

