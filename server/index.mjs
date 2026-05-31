import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dataDir = join(rootDir, "data");
const dbPath = join(dataDir, "clicks.json");
const distDir = join(rootDir, "dist");
const port = Number(process.env.PORT || 3001);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

function ensureDb() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  if (!existsSync(dbPath)) {
    writeFileSync(dbPath, JSON.stringify({ events: [] }, null, 2), "utf8");
  }
}

function readDb() {
  ensureDb();
  try {
    return JSON.parse(readFileSync(dbPath, "utf8"));
  } catch {
    return { events: [] };
  }
}

function writeDb(db) {
  ensureDb();
  writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf8");
}

function summarize(events) {
  const byTarget = {};
  const visitors = new Set();
  let pageViews = 0;
  let totalClicks = 0;

  for (const event of events) {
    if (event.visitorId) visitors.add(event.visitorId);
    if (event.type === "page_view") pageViews += 1;
    if (event.type === "cta_click") {
      totalClicks += 1;
      byTarget[event.target] = (byTarget[event.target] || 0) + 1;
    }
  }

  return {
    totalEvents: events.length,
    pageViews,
    totalClicks,
    uniqueVisitors: visitors.size,
    byTarget,
    recentEvents: events.slice(-20).reverse(),
  };
}

function readBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 50_000) {
        request.destroy();
        rejectBody(new Error("Payload muito grande"));
      }
    });
    request.on("end", () => resolveBody(body));
    request.on("error", rejectBody);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  response.end(JSON.stringify(payload));
}

function normalizeEvent(input) {
  const allowedTypes = new Set(["page_view", "cta_click"]);
  const type = allowedTypes.has(input.type) ? input.type : "cta_click";
  const clean = (value, fallback = "") =>
    String(value || fallback)
      .slice(0, 180)
      .replace(/[<>]/g, "");

  return {
    type,
    target: clean(input.target, "unknown"),
    visitorId: clean(input.visitorId, "anonymous"),
    page: clean(input.page, "/"),
    referrer: clean(input.referrer),
    utmSource: clean(input.utmSource),
    utmMedium: clean(input.utmMedium),
    utmCampaign: clean(input.utmCampaign),
    createdAt: new Date().toISOString(),
  };
}

async function handleApi(request, response, url) {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  if (url.pathname === "/api/stats" && request.method === "GET") {
    const db = readDb();
    sendJson(response, 200, summarize(db.events || []));
    return;
  }

  if (url.pathname === "/api/events" && request.method === "POST") {
    try {
      const body = await readBody(request);
      const payload = body ? JSON.parse(body) : {};
      const db = readDb();
      const events = Array.isArray(db.events) ? db.events : [];
      events.push(normalizeEvent(payload));
      const nextDb = { events };
      writeDb(nextDb);
      sendJson(response, 200, summarize(events));
    } catch {
      sendJson(response, 400, { error: "Evento invalido" });
    }
    return;
  }

  sendJson(response, 404, { error: "Endpoint nao encontrado" });
}

function serveStatic(request, response, url) {
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = requestedPath.replace(/^\/+/, "");
  let filePath = resolve(distDir, safePath);

  if (!filePath.startsWith(distDir)) {
    response.writeHead(403);
    response.end("Acesso negado");
    return;
  }

  if (!existsSync(filePath)) {
    filePath = join(distDir, "index.html");
  }

  if (!existsSync(filePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Build nao encontrado. Rode npm run build antes de npm start.");
    return;
  }

  const ext = extname(filePath);
  response.writeHead(200, {
    "Content-Type": contentTypes[ext] || "application/octet-stream",
  });
  response.end(readFileSync(filePath));
}

createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);

  if (url.pathname.startsWith("/api/")) {
    await handleApi(request, response, url);
    return;
  }

  serveStatic(request, response, url);
}).listen(port, () => {
  ensureDb();
  console.log(`Servidor EduNexus rodando em http://localhost:${port}`);
});
