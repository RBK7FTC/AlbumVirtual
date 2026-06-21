const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 8000);
const dataPath = path.join(root, "album-data.json");
const initialCollected = [1, 2, 4, 7];
const maxStickerId = 12;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

async function ensureDataFile() {
  try {
    await fsp.access(dataPath, fs.constants.F_OK);
  } catch {
    await writeCollection(initialCollected);
  }
}

async function readCollection() {
  await ensureDataFile();

  try {
    const raw = await fsp.readFile(dataPath, "utf8");
    const data = JSON.parse(raw);
    return sanitizeCollection(data.collected);
  } catch {
    await writeCollection(initialCollected);
    return initialCollected;
  }
}

async function writeCollection(cardIds) {
  const collected = sanitizeCollection(cardIds);
  const payload = {
    collected,
    updatedAt: new Date().toISOString()
  };

  await fsp.writeFile(dataPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return collected;
}

function sanitizeCollection(cardIds) {
  if (!Array.isArray(cardIds)) {
    return [];
  }

  return [...new Set(cardIds.map(Number))]
    .filter((cardId) => Number.isInteger(cardId) && cardId >= 1 && cardId <= maxStickerId)
    .sort((a, b) => a - b);
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 1024 * 1024) {
        request.destroy();
        reject(new Error("Request body is too large"));
      }
    });

    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);

  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(body);
}

function sendError(response, status, message) {
  sendJson(response, status, { error: message });
}

async function handleCollectionApi(request, response) {
  if (request.method === "GET") {
    const collected = await readCollection();
    sendJson(response, 200, { collected });
    return;
  }

  if (request.method === "PUT") {
    try {
      const body = await readRequestBody(request);
      const payload = JSON.parse(body || "{}");
      const collected = await writeCollection(payload.collected);
      sendJson(response, 200, { collected });
    } catch {
      sendError(response, 400, "Invalid collection payload");
    }
    return;
  }

  sendError(response, 405, "Method not allowed");
}

async function serveStaticFile(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const decodedPath = decodeURIComponent(pathname);
  const filePath = path.resolve(root, `.${decodedPath}`);

  if (!filePath.startsWith(root)) {
    sendError(response, 403, "Forbidden");
    return;
  }

  try {
    const file = await fsp.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": mimeTypes[extension] || "application/octet-stream"
    });
    response.end(file);
  } catch {
    sendError(response, 404, "Not found");
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);

    if (requestUrl.pathname === "/api/collection") {
      await handleCollectionApi(request, response);
      return;
    }

    await serveStaticFile(request, response);
  } catch {
    sendError(response, 500, "Internal server error");
  }
});

server.listen(port, () => {
  console.log(`Virtual album server running at http://127.0.0.1:${port}`);
});
