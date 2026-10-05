"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const HOST = "127.0.0.1";
const PORT = Number(process.env.DATA_SERVICE_PORT || 14311);

const ROUTES = new Map([
  ["/", "data-service-check.html"],
  ["/data-service-check.html", "data-service-check.html"],
  ["/js/data-service.js", "js/data-service.js"]
]);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://${HOST}:${PORT}`);

    if (req.method !== "GET") {
      res.writeHead(405, {"Content-Type":"text/plain; charset=utf-8"});
      res.end("Method Not Allowed");
      return;
    }

    if (url.pathname === "/health") {
      res.writeHead(200, {
        "Content-Type":"application/json; charset=utf-8",
        "Cache-Control":"no-store"
      });
      res.end(JSON.stringify({
        ok: true,
        service: "data-service-check-server",
        host: HOST,
        port: PORT
      }));
      return;
    }

    const relative = ROUTES.get(url.pathname);

    if (!relative) {
      res.writeHead(404, {"Content-Type":"text/plain; charset=utf-8"});
      res.end("Not Found");
      return;
    }

    const file = path.join(ROOT, relative);

    if (!fs.existsSync(file)) {
      res.writeHead(404, {"Content-Type":"text/plain; charset=utf-8"});
      res.end("Missing file: " + relative);
      return;
    }

    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
      "Cache-Control":"no-store"
    });

    fs.createReadStream(file).pipe(res);

  } catch (error) {
    res.writeHead(500, {"Content-Type":"text/plain; charset=utf-8"});
    res.end(error?.message || String(error));
  }
});

server.on("error", error => {
  console.error("");
  console.error("DataService 检查服务器启动失败：", error);
  process.exitCode = 1;
});

server.on("close", () => {
  console.log("DataService 检查服务器已关闭");
});

server.listen(PORT, HOST, () => {
  const address = server.address();

  console.log("");
  console.log("🔌 DataService 本地检查服务器已启动");
  console.log(`地址：http://${HOST}:${PORT}/data-service-check.html`);
  console.log(`健康检查：http://${HOST}:${PORT}/health`);
  console.log(
    "实际监听：" +
    (typeof address === "object" && address
      ? `${address.address}:${address.port}`
      : String(address))
  );
  console.log("按 Ctrl + C 停止");
  console.log("");
});
