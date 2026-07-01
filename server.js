const crypto = require("crypto");
const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 8000);
const dataPath = path.join(root, "album-data.json");
const initialCollected = [];
const maxStickerId = 12;
const sessions = new Map();

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
    await writeData({ users: {} });
  }
}

async function readData() {
  await ensureDataFile();

  try {
    const raw = await fsp.readFile(dataPath, "utf8");
    const data = JSON.parse(raw);
    return data && data.users ? data : { users: {} };
  } catch {
    return { users: {} };
  }
}

async function writeData(data) {
  await fsp.writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function validateUsername(username) {
  return /^[a-z0-9_-]{3,20}$/.test(username);
}

function validatePassword(password) {
  return typeof password === "string" && password.length >= 6 && password.length <= 128;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, passwordRecord) {
  const candidate = hashPassword(password, passwordRecord.salt);
  const stored = Buffer.from(passwordRecord.hash, "hex");
  const incoming = Buffer.from(candidate.hash, "hex");

  return stored.length === incoming.length && crypto.timingSafeEqual(stored, incoming);
}

function createToken(username) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, username);
  return token;
}

function getBearerToken(request) {
  const header = request.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" ? token : "";
}

async function getAuthenticatedUser(request) {
  const token = getBearerToken(request);
  const username = sessions.get(token);

  if (!username) {
    return null;
  }

  const data = await readData();
  const user = data.users[username];
  return user ? { data, username, user, token } : null;
}

function sanitizeCollection(cardIds) {
  if (!Array.isArray(cardIds)) {
    return [];
  }

  return [...new Set(cardIds.map(Number))]
    .filter((cardId) => Number.isInteger(cardId) && cardId >= 1 && cardId <= maxStickerId)
    .sort((a, b) => a - b);
}

function publicUser(user) {
  return { username: user.username,
    isAdmin: !!user.isAdmin,
    availablePacks: user.availablePacks ?? 0,
    tradeRequests: user.tradeRequests
  };
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

async function readJsonRequest(request) {
  const body = await readRequestBody(request);
  return JSON.parse(body || "{}");
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

async function handleUsersApi(request, response) {
  if (request.method !== "POST") {
    sendError(response, 405, "Method not allowed");
    return;
  }

  try {
    const payload = await readJsonRequest(request);
    const username = normalizeUsername(payload.username);
    const password = payload.password;

    if (!validateUsername(username)) {
      sendError(response, 400, "Username must be 3-20 letters, numbers, hyphens, or underscores");
      return;
    }

    if (!validatePassword(password)) {
      sendError(response, 400, "Password must be at least 6 characters");
      return;
    }

    const data = await readData();

    if (data.users[username]) {
      sendError(response, 409, "Username already exists");
      return;
    }

    const now = new Date().toISOString();
    data.users[username] = {
      username,
      password: hashPassword(password),
      isAdmin: false,
      availablePacks: 1,
      tradeRequests: [],
      collected: initialCollected,
      createdAt: now,
      updatedAt: now
    };

    await writeData(data);

    const token = createToken(username);
    sendJson(response, 201, {
      token,
      user: publicUser(data.users[username]),
      collected: data.users[username].collected
    });
  } catch {
    sendError(response, 400, "Invalid user payload");
  }
}

async function handleSessionsApi(request, response) {
  if (request.method === "POST") {
    try {
      const payload = await readJsonRequest(request);
      const username = normalizeUsername(payload.username);
      const password = payload.password;
      const data = await readData();
      const user = data.users[username];

      if (!user || !validatePassword(password) || !verifyPassword(password, user.password)) {
        sendError(response, 401, "Invalid username or password");
        return;
      }

      const token = createToken(username);
      sendJson(response, 200, {
        token,
        user: publicUser(user),
        collected: sanitizeCollection(user.collected)
      });
    } catch {
      sendError(response, 400, "Invalid session payload");
    }
    return;
  }

  if (request.method === "DELETE") {
    sessions.delete(getBearerToken(request));
    sendJson(response, 200, { ok: true });
    return;
  }

  sendError(response, 405, "Method not allowed");
}

async function handleCollectionApi(request, response) {
  const auth = await getAuthenticatedUser(request);

  if (!auth) {
    sendError(response, 401, "Sign in required");
    return;
  }

  if (request.method === "GET") {
    sendJson(response, 200, { collected: sanitizeCollection(auth.user.collected) });
    return;
  }

  //TODO: Remove, users can query to update his collection
  if (request.method === "PUT") {
    try {
      const payload = await readJsonRequest(request);
      auth.user.collected = sanitizeCollection(payload.collected);
      auth.user.updatedAt = new Date().toISOString();
      auth.data.users[auth.username] = auth.user;
      await writeData(auth.data);
      sendJson(response, 200, { collected: auth.user.collected });
    } catch {
      sendError(response, 400, "Invalid collection payload");
    }
    return;
  }

  sendError(response, 405, "Method not allowed");
}

async function handleOpenPackApi(request, response) {
    const auth = await getAuthenticatedUser(request);

    if (!auth) {
        sendError(response, 401, "Sign in required");
        return;
    }

    if (auth.user.availablePacks <= 0) {
        sendError(response, 403, "No packs available");
        return;
    }

    auth.user.availablePacks--;

    auth.user.updatedAt = new Date().toISOString();

    auth.data.users[auth.username] = auth.user;

    await writeData(auth.data);

    sendJson(response, 200, {
        availablePacks: auth.user.availablePacks
    });
}

async function handleGetPackApi(request, response) {
    const auth = await getAuthenticatedUser(request);

    if (!auth) {
        sendError(response, 401, "Sign in required");
        return;
    }

    auth.user.availablePacks++;

    auth.user.updatedAt = new Date().toISOString();

    auth.data.users[auth.username] = auth.user;

    await writeData(auth.data);

    sendJson(response, 200, {
        availablePacks: auth.user.availablePacks
    });
}

async function handleGetLeaderboard(request, response) {
    //const auth = await getAuthenticatedUser(request);

    /*
    if (!auth) {
        sendError(response, 401, "Sign in required");
        return;
    }
    */

    const data = await readData();

    const ranking = Object.values(data.users).map(user => ({
      username: user.username,
      stickerCount: user.collected.length
    }));

    ranking.sort((a, b) => b.stickerCount - a.stickerCount);

    sendJson(response, 200, ranking);
}

async function handleStartTrade(request, response) {

    const auth = await getAuthenticatedUser(request);

    if (!auth) {
        sendError(response, 401, "Sign in required");
        return;
    }

    if (request.method === "PUT") {
      try {
        const payload = await readJsonRequest(request);
        const data = await readData();
        const user = data.users[payload.username];
        
        if(!user){
          sendError(response, 401, "Unknow target user");
          return;
        }
        
        sendJson(response, 200, {
          collected: user.collected
        });

      } catch {
        sendError(response, 400, "Invalid collection payload");
      }

      return;
    }
}

async function handlePostTradeRequest(request, response) {

    const auth = await getAuthenticatedUser(request);

    if (!auth) {
        sendError(response, 401, "Sign in required");
        return;
    }

    if (request.method === "PUT") {
      try {
        const payload = await readJsonRequest(request);
        const data = await readData();
        const targetUser = data.users[payload.targetUser];

        if(!targetUser){
                    sendJson(response, 200, {
            state: false,
            error: "Target user not found"
          });
          return;
        }

        if(!targetUser.collected.includes(Number(payload.otherStickerIndex))){
          sendJson(response, 200, {
            state: false,
            error: "Target user does not have the required sticker"
          });
          return;
        }

        if(!auth.user.collected.includes(Number(payload.ownStickerIndex))){
          sendJson(response, 200, {
            state: false,
            error: "Current user does not have the required sticker"
          });
          return;
        }

        //Prohibit trade already owned stickers
        /*
        if(targetUser.collected.includes(Number(payload.ownStickerIndex))){
          sendJson(response, 200, {
            state: false,
            error: "Target user already has the given sticker"
          });
          return;
        }

        if(auth.user.collected.includes(Number(payload.otherStickerIndex))){
          sendJson(response, 200, {
            state: false,
            error: "Current user already has the requested sticker"
          });
          return;
        }
        */

        auth.data.users[payload.targetUser].tradeRequests.push({
          ownStickerIndex: payload.otherStickerIndex,
          otherStickerIndex: payload.ownStickerIndex,
          username: auth.username
        });

        await writeData(auth.data);

        sendJson(response, 200, {
          state: true
        });

      } catch(error) {
        console.log(error);
        sendError(response, 403, "server error");
      }

      return;
    }
}

async function handleRequireTradeRequests(request, response){
  const auth = await getAuthenticatedUser(request);

  if (!auth) {
      sendError(response, 401, "Sign in required");
      return;
  }

  try {

    sendJson(response, 200, auth.user.tradeRequests);

  } catch(error) {
    console.log(error);
    sendError(response, 403, "server error");
  }
  return;
}

async function serveStaticFile(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const decodedPath = decodeURIComponent(pathname);
  const filePath = path.resolve(root, `.${decodedPath}`);
  const relativePath = path.relative(root, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
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

    if (requestUrl.pathname === "/api/users") {
      await handleUsersApi(request, response);
      return;
    }

    if (requestUrl.pathname === "/api/sessions") {
      await handleSessionsApi(request, response);
      return;
    }

    if (requestUrl.pathname === "/api/collection") {
      await handleCollectionApi(request, response);
      return;
    }

    if (requestUrl.pathname === "/api/open-pack") {
        await handleOpenPackApi(request, response);
        return;
    }

    if (requestUrl.pathname === "/api/get-pack") {
        await handleGetPackApi(request, response);
        return;
    }

    if (requestUrl.pathname === "/api/get-leaderboard") {
        await handleGetLeaderboard(request, response);
        return;
    }

    if (requestUrl.pathname === "/api/start-trade") {
        await handleStartTrade(request, response);
        return;
    }

    if (requestUrl.pathname === "/api/post-trade-request") {
        await handlePostTradeRequest(request, response);
        return;
    }

    if (requestUrl.pathname === "/api/require-tradeRequests") {
        await handleRequireTradeRequests(request, response);
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
