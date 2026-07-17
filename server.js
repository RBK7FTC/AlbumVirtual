const crypto = require("crypto");
const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 8000);
const dataPath = path.join(root, "album-data.json");
const initialCollected = [];
//const maxStickerId = 12; //No more hardcoded maxStickerId instead should keep stickers collection in server database
const sessions = new Map();
const eventClients = new Map();
const masterQRCode = "WIWIWIWIWIWIWIWIWIWIWIWIWI";
const packQRCodes = [
  "3OZA6ZF0LJL5XGGZIP32LM73806Q32OC",
  "NCZOQXHX2S0EXTJGPRYDPBM8HNPLFVFU",
  "472GCE7SL2Z6WWP9ZXOID1B9QHREG7I4",
  "QIK4VTJ7S58VSN59USGZOJFUSLF4L0QM",
  "7MNRVW9XRHB8NB2O08L0IAHE1E4MF1W2",
  "64BYIIGYX1FKLF6P53CZAOYU6R9NNTYK",
  "PEWJTNFEVEM6LBJ6NPOZTQ98042YH9OM",
  "PD6MUSWGAKV9Q0AZOC5IMFM13O3G6FBK",
  "2C35MH26B0CALSRQQDHQUN9MIG9V249L",
  "LI73L2JREVILB25BNX6DM8FU76XM653C",
  "QJSVF5MXV9N9ZH4OR2N2XJF3EX2VMFNN",
  "APWCMT33N0ML6VFX9E2BA5PYJPPK50OV",
  "KLNK8FGIPLIPDWC5QTJGTGXW5KBER2RD",
  "JD0BLXXGG36JDBUHM7UT0WHNG6A7T2FC",
  "ONOIOWN9T7DPC4J11SMG82X5J6FZ5IJT",
  "MZB9RM3SWQOC2X8WCSEIP809TP0QOXN8",
  "UK09D4NXA5LK60R3GB1Y1ZAOK6AHX0CA",
  "1X2XPGPSPN8TWK6P2Q3NSY5FMWQ17CMF",
  "OG20SGDHN7QZP3EEKA43LH2M3NJOFANO",
  "QCU4DTFWJOZE6JUQ901DXEIM9FDB9QUG",
  "XZ4O7VGRNYCWKE75TPWLVNXIGS2NTXUR",
  "UBBU6SU7IAAKNJVEIGIYW0JERS8RNHYL",
  "J8QRJNC38QGWZ0B3MHWLD2J1XG8BQLW6",
  "CBPWIVC5N1CRY6JWUTPZAIEK9KGB01SS",
  "WI0Z42OONQ1LRJTZMHHQ47BY8NYTCVQP",
  "AW36K6P7NBBMUBHV50YN7GPQNLV83YYX",
  "VMAL6BP0K24WWQXE2L0BYYYVS8K3WLVR",
  "EF7FZEJTCA71CJWFHKSLOPIFRLRAQDNS",
  "HR4OZ4UE8E7NKVR7F2YT5U6VO1JKAGSK",
  "9T39KELF54X0E00XMCZ08VVAMO7RNM3Q",
  "CJ18RY6LQFWKPTEJKFJ6ZLAVUOR26638",
  "ITNKHUXILDQCB0IVEE1JAABLOABJAEYK",
  "J35I7O5TB71W4292ZAFPSBU2EL2SKSU9",
  "PLI8G5AH6ONRUPD2GB8A58GONMYU1TDZ",
  "3Q10UW1GGHYI5M1POMAAV7O41KTO80UW",
  "SSL660RKDB0X7M8V150A4LYTODL9HE52",
  "09HKO3375O4WX9FA492NNY3582PQ2CGI",
  "K1SYYGC4EEORVHMWLHB2H9XMJ9AOWR0M",
  "7CX25IP59BTR3XKLKW9CAWD9VFMBJ81L",
  "7665K5RQJ7WKH0NDN8CC6I2FOR02Z0YQ",
  "IZR1102QBRG3HOM7ZTJG23M3A0L7GWKL",
  "Q8T59V2CLOL6JHN0TZNQSFSRQHIUD6WM",
  "NLN4K6DPL9LTM66KDI7JAR2UA4UL471G",
  "DVTWLL3PQ95JL4YQDKLJHQIDRU8JA77Z",
  "XD01X1P6L7WVBO1W3PKPFKLI4CVZ9K8V",
  "EFY94QZXEO9DS3DFWPR8O2NYUOCKKCAH",
  "ZXB6MILJ6RHQRCAHP6AOH7J05C13894D",
  "CZ9W6Q9PYKOMM5Y9LTQUIEG4ZP6THGHN",
  "KV2BJF510A218QOUQS8P3MLUIB4EQ8NC",
  "QSZTYMUMWG2XX61QUX1BLHFV5SXS6OK8"
];

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

const stickers = [
  { id: 1, name: "Opening Spark", rarity: "common", team: "RBK7FTC", image: "assets/sticker-01.svg" },
  { id: 2, name: "Midfield Pulse", rarity: "common", team: "RBK7FTC", image: "assets/sticker-02.svg" },
  { id: 3, name: "Golden Save", rarity: "rare", team: "RBK7FTC", image: "assets/sticker-03.svg" },
  { id: 4, name: "Street Captain", rarity: "common", team: "RBK7FTC", image: "assets/sticker-04.svg" },
  { id: 5, name: "Final Whistle", rarity: "rare", team: "RBK7FTC", image: "assets/sticker-05.svg" },
  { id: 6, name: "Neon Striker", rarity: "epic", team: "RBK7FTC", image: "assets/sticker-06.svg" },
  { id: 7, name: "Home Colors", rarity: "common", team: "DINAMITA", image: "assets/sticker-07.svg" },
  { id: 8, name: "Away Colors", rarity: "common", team: "DINAMITA", image: "assets/sticker-08.svg" },
  { id: 9, name: "Stadium Lights", rarity: "rare", team: "DINAMITA", image: "assets/sticker-09.svg" },
  { id: 10, name: "Rising Star", rarity: "common", team: "SHADOWFOX", image: "assets/sticker-10.svg" },
  { id: 11, name: "Derby Night", rarity: "epic", team: "SHADOWFOX", image: "assets/sticker-11.svg" },
  { id: 12, name: "Trophy Lift", rarity: "legendary", team: "SHADOWFOX", image: "assets/sticker-12.svg" },
  { id: 13, name: "Opening Spark", rarity: "common", team: "RBK7FTC", image: "assets/sticker-01.svg" },
  { id: 14, name: "Midfield Pulse", rarity: "common", team: "RBK7FTC", image: "assets/sticker-02.svg" },
  { id: 15, name: "Golden Save", rarity: "rare", team: "RBK7FTC", image: "assets/sticker-03.svg" },
  { id: 16, name: "Street Captain", rarity: "common", team: "RBK7FTC", image: "assets/sticker-04.svg" },
  { id: 17, name: "Final Whistle", rarity: "rare", team: "RBK7FTC", image: "assets/sticker-05.svg" },
  { id: 18, name: "Neon Striker", rarity: "epic", team: "RBK7FTC", image: "assets/sticker-06.svg" },

  { id: 19, name: "Opening Spark", rarity: "common", team: "MALBECROBOTICS", image: "assets/sticker-01.svg" },
  { id: 20, name: "Midfield Pulse", rarity: "common", team: "MALBECROBOTICS", image: "assets/sticker-02.svg" },
  { id: 21, name: "Golden Save", rarity: "rare", team: "MALBECROBOTICS", image: "assets/sticker-03.svg" },
  { id: 22, name: "Street Captain", rarity: "common", team: "MALBECROBOTICS", image: "assets/sticker-04.svg" },
  { id: 23, name: "Final Whistle", rarity: "rare", team: "MALBECROBOTICS", image: "assets/sticker-05.svg" },
  { id: 24, name: "Neon Striker", rarity: "epic", team: "MALBECROBOTICS", image: "assets/sticker-06.svg" },
  { id: 25, name: "Home Colors", rarity: "common", team: "MALBECROBOTICS", image: "assets/sticker-07.svg" },

  { id: 26, name: "Opening Spark", rarity: "common", team: "IMPERIUMFONS", image: "assets/IMPERIUMFONS01.svg" },
  { id: 27, name: "Midfield Pulse", rarity: "common", team: "IMPERIUMFONS", image: "assets/IMPERIUMFONS02.svg" },
  { id: 28, name: "Golden Save", rarity: "rare", team: "IMPERIUMFONS", image: "assets/IMPERIUMFONS03.svg" },
  { id: 29, name: "Street Captain", rarity: "common", team: "IMPERIUMFONS", image: "assets/IMPERIUMFONS04.svg" },
  { id: 30, name: "Final Whistle", rarity: "rare", team: "IMPERIUMFONS", image: "assets/IMPERIUMFONS05.svg" },
  { id: 31, name: "Neon Striker", rarity: "epic", team: "IMPERIUMFONS", image: "assets/IMPERIUMFONS06.svg" },
  { id: 32, name: "Home Colors", rarity: "common", team: "IMPERIUMFONS", image: "assets/IMPERIUMFONS07.svg" },

  { id: 33, name: "Opening Spark", rarity: "common", team: "DEVOLTDEIMOS", image:   "assets/DEVOLTDEIMOS01.svg" },
  { id: 34, name: "Midfield Pulse", rarity: "common", team: "DEVOLTDEIMOS", image:  "assets/DEVOLTDEIMOS02.svg" },
  { id: 35, name: "Golden Save", rarity: "rare", team: "DEVOLTDEIMOS", image:       "assets/DEVOLTDEIMOS03.svg" },
  { id: 36, name: "Street Captain", rarity: "common", team: "DEVOLTDEIMOS", image:  "assets/DEVOLTDEIMOS04.svg" },
  { id: 37, name: "Final Whistle", rarity: "rare", team: "DEVOLTDEIMOS", image:     "assets/DEVOLTDEIMOS05.svg" },
  { id: 38, name: "Neon Striker", rarity: "epic", team: "DEVOLTDEIMOS", image:      "assets/DEVOLTDEIMOS06.svg" },
  { id: 39, name: "Home Colors", rarity: "common", team: "DEVOLTDEIMOS", image:     "assets/DEVOLTDEIMOS07.svg" },
  { id: 40, name: "Home Colors", rarity: "common", team: "DEVOLTDEIMOS", image:     "assets/DEVOLTDEIMOS08.svg" },

  { id: 41, name: "Opening Spark", rarity: "common", team: "DEVOLTPHOBOS", image:   "assets/DEVOLTPHOBOS01.svg" },
  { id: 42, name: "Midfield Pulse", rarity: "common", team: "DEVOLTPHOBOS", image:  "assets/DEVOLTPHOBOS02.svg" },
  { id: 43, name: "Golden Save", rarity: "rare", team: "DEVOLTPHOBOS", image:       "assets/DEVOLTPHOBOS03.svg" },
  { id: 44, name: "Street Captain", rarity: "common", team: "DEVOLTPHOBOS", image:  "assets/DEVOLTPHOBOS04.svg" },
  { id: 45, name: "Final Whistle", rarity: "rare", team: "DEVOLTPHOBOS", image:     "assets/DEVOLTPHOBOS05.svg" }
];

let leaderboard;

function pickPack(collected) {
  const weighted = stickers.flatMap((sticker) => {
    if (sticker.rarity === "epic") return [sticker];
    if (sticker.rarity === "rare") return [sticker, sticker];
    return [sticker, sticker, sticker, sticker];
  });

  const pack = new Map();
  while (pack.size < 3) {
    const sticker = weighted[Math.floor(Math.random() * weighted.length)];
    pack.set(sticker.id, sticker);
  }

  return [...pack.values()];
}

function broadcastToUser(username, event, payload) {
  try{
    const clients = eventClients.get(username);
  
    if (!clients)
        return;
  
    for (const client of clients){
      client.write(`event: ${event}\n`);
      client.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
  } catch(e){
    console.log(e);
  }
}

async function updateLeaderboard(data){
  

  leaderboard = Object.values(data.users).map(user => ({
    username: user.username,
    stickerCount: (new Set(user.collected).size)
  }));

  leaderboard.sort((a, b) => b.stickerCount - a.stickerCount);
}

async function broadcastLeaderboard(data) {
  updateLeaderboard(data);
  
  for (const username of eventClients.keys()) {
    broadcastToUser(
        username,
        "leaderboard",
        leaderboard
    );
  }
}

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

function getRequestToken(request) {
  const header = request.headers.authorization || "";
  const [scheme, bearerToken] = header.split(" ");

  if (scheme === "Bearer" && bearerToken)
      return bearerToken;

  const url = new URL(request.url, `http://${request.headers.host}`);

  return url.searchParams.get("token") || "";
}

async function getAuthenticatedUser(request) {
  const token = getRequestToken(request);
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
    .filter((cardId) => Number.isInteger(cardId) && cardId >= 1 /*&& cardId <= maxStickerId*/)
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

async function handleRequireStickers(request, response) {
      sendJson(response, 201, {
        stickers: stickers
    });
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
      scannedQRCodes: [],
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
    sessions.delete(getRequestToken(request));
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

    const pack = pickPack(auth.user.collected);
    pack.forEach( (sticker) => {auth.user.collected.push(sticker.id)});
    
    await writeData(auth.data);
    
    sendJson(response, 200, {
      availablePacks: auth.user.availablePacks,
      pack: pack
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
  
  if(!leaderboard){
    const data = await readData();
    updateLeaderboard(data);
  }

  sendJson(response, 200, leaderboard);
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
        const targetUser = data.users[payload.username];
        
        if(!targetUser){
          sendError(response, 401, "Unknow target user");
          return;
        }

        sendJson(response, 200, {
          collected: targetUser.collected
        });


      } catch {
        sendError(response, 400, "Invalid collection payload");
      }

      return;
    }
}

function validateTradeRequest(tradeRequest, givesUser, wantsUser){
  if(!givesUser.collected.includes(Number(tradeRequest.givesStickerIndex))){
    sendJson(response, 200, {
      state: false,
      error: "Target user does not have the required sticker"
    });
    return false;
  }

  if(!wantsUser.collected.includes(Number(tradeRequest.wantsStickerIndex))){
    sendJson(response, 200, {
      state: false,
      error: "Current user does not have the required sticker"
    });
    return false;
  }

  //Prohibit trade already owned stickers
  /*
  if(targetUser.collected.includes(Number(tradeRequest.ownStickerIndex))){
    sendJson(response, 200, {
      state: false,
      error: "Target user already has the given sticker"
    });
    return;
  }

  if(user.collected.includes(Number(tradeRequest.otherStickerIndex))){
    sendJson(response, 200, {
      state: false,
      error: "Current user already has the requested sticker"
    });
    return;
  }
  */

  return true;
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

        if(!validateTradeRequest(payload, auth.user, targetUser)){
          return;
        }

        auth.data.users[payload.targetUser].tradeRequests.push({
          givesStickerIndex: payload.givesStickerIndex,
          wantsStickerIndex: payload.wantsStickerIndex,
          username: auth.username
        });

        await writeData(auth.data);

        broadcastToUser(
          targetUser.username,
          "trade-request-received",
          auth.data.users[targetUser.username].tradeRequests
        );

        sendJson(response, 200, {
          state: true
        });

      } catch(error) {
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
    sendError(response, 403, "server error");
  }
  return;
}

function compareTradeRequests(t1, t2){

  if(t1.username != t2.username){
    console.log("Username mismatch");
    return false;
  }

  if(t1.givesStickerIndex != t2.givesStickerIndex){
    console.log("givesStickerIndex mismatch");
    return false;
  }

  if(t1.wantsStickerIndex != t2.wantsStickerIndex){
    console.log("wantsStickerIndex mismatch");
    return false;
  }

  return true;
}

async function handleResponseToTradeRequests(request, response) {
  
    const auth = await getAuthenticatedUser(request);

    if (!auth) {
        sendError(response, 401, "Sign in required");
        return;
    }

    if (request.method === "PUT") {
      try {
        const payload = await readJsonRequest(request);
        const data = await readData();
        const targetUser = data.users[payload.tradeRequest.username];

        if(!targetUser){
          sendJson(response, 200, {
            state: false,
            error: "Target user not found"
          });
          return;
        }

        if(auth.user.tradeRequests.length <= payload.tradeRequestIndex){
          sendJson(response, 200, {
            state: false,
            error: "Trade request out of bounds"
          });
          return; 
        }

        if(!compareTradeRequests(auth.user.tradeRequests[payload.tradeRequestIndex], payload.tradeRequest)){
          sendJson(response, 200, {
            state: false,
            error: "Trade request not found"
          });
          return;  
        }

        let dataMyUser = auth.data.users[auth.username];
        let dataOtherUser = auth.data.users[payload.tradeRequest.username];

        auth.data.users[auth.username].tradeRequests.splice(payload.tradeRequestIndex, 1);

        if(payload.accepted){
          {
            if(!validateTradeRequest(payload.tradeRequest, targetUser, auth.user)){
              return;
            }
            const index = dataMyUser.collected.indexOf(Number(payload.tradeRequest.wantsStickerIndex));

            if (index > -1) {
              dataMyUser.collected.splice(index, 1);
            } else {
              console.log("ERROR1");
              return;
            }
          }

          {
            const index = dataOtherUser.collected.indexOf(Number(payload.tradeRequest.givesStickerIndex));

            if (index > -1) {
              dataOtherUser.collected.splice(index, 1);
            } else {
              console.log("ERROR2");
              return;
            }
          }

          dataMyUser.collected.push(Number(payload.tradeRequest.givesStickerIndex));

          dataOtherUser.collected.push(Number(payload.tradeRequest.wantsStickerIndex));
        
          broadcastToUser(auth.username, "collection-update", dataMyUser.collected);
          broadcastToUser(payload.tradeRequest.username, "collection-update", dataOtherUser.collected);

          broadcastLeaderboard(auth.data);
        }

        //Send trade request response to both users clients
        broadcastToUser(auth.username, "trade-request-response", payload);
        broadcastToUser(payload.tradeRequest.username, "trade-request-response", payload);

        await writeData(auth.data);
       
        sendJson(response, 200, {
          state: true,
          tradeRequests: auth.data.users[auth.username].tradeRequests,
          collection: auth.data.users[auth.username].collected
        });

      } catch(error) {
        console.log(error);
        sendError(response, 403, "server error");
      }

      return;
    }
}

async function handleQRCodeScanned(request, response) {
  const auth = await getAuthenticatedUser(request);

  if (!auth) {
      sendError(response, 401, "Sign in required");
      return;
  }

  if (request.method === "PUT") {
    try {
      const payload = await readJsonRequest(request);
      const data = await readData();

      const codeIndex = packQRCodes.indexOf(payload.code);
      const isMasterQRCode = masterQRCode === payload.code;

      if(codeIndex == -1 && !isMasterQRCode){
        sendJson(response, 200, {
          state: false,
          availablePacks: auth.user.availablePacks,
          codeID: codeIndex
        });
        return;
      }

      if(auth.user.scannedQRCodes.includes(payload.code) && !isMasterQRCode){
        sendJson(response, 200, {
          state: false,
          availablePacks: auth.user.availablePacks,
          codeID: payload.code
        });
        return;
      }

      if(!isMasterQRCode)
        auth.user.scannedQRCodes.push(payload.code);
      auth.user.availablePacks++;

      await writeData(auth.data);
      
      broadcastToUser(
        auth.username,
        "pack-received",
         { availablePacks: auth.user.availablePacks }
      );

      sendJson(response, 200, {
        state: true,
        availablePacks: auth.user.availablePacks,
        codeID: codeIndex
      });
    }catch(error){
      console.log(error);
      sendError(response, 403, "server error");
    }
  }
}

async function handleEventsApi(request, response) {

    const auth = await getAuthenticatedUser(request);

    if (!auth) {
        sendError(response, 401, "Sign in required");
        return;
    }

    response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
    });

    response.write("\n");

    let clients = eventClients.get(auth.username);

    if (!clients) {
        clients = new Set();
        eventClients.set(auth.username, clients);
    }

    clients.add(response);

    request.on("close", () => {

        clients.delete(response);

        if (clients.size === 0)
            eventClients.delete(auth.username);

    });
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

    if (requestUrl.pathname === "/api/response-to-trade-request") {
      await handleResponseToTradeRequests(request, response);
      return;
    }

    if (requestUrl.pathname === "/api/qrCodeScanned") {
      await handleQRCodeScanned(request, response);
      return;
    }

    if (requestUrl.pathname === "/api/events") {
      await handleEventsApi(request, response);
      return;
    }

    if (requestUrl.pathname === "/api/requireStickers") {
      await handleRequireStickers(request, response);
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