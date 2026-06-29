const teams = [ "RBK7FTC",
    "DINAMITA",
    "ShadowFox"
]

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
  { id: 10, name: "Rising Star", rarity: "common", team: "ShadowFox", image: "assets/sticker-10.svg" },
  { id: 11, name: "Derby Night", rarity: "epic", team: "ShadowFox", image: "assets/sticker-11.svg" },
  { id: 12, name: "Trophy Lift", rarity: "legendary", team: "ShadowFox", image: "assets/sticker-12.svg" }
];

const initialCollected = new Set([1, 2, 4, 7]);
let collected = new Set();
let activeTeam = 0;
let authToken = sessionStorage.getItem("album-token") || "";
let currentUser = sessionStorage.getItem("album-user") || "";
let availablePacks = sessionStorage.getItem("album-availablePacks");

const grid = document.querySelector("#album-grid");
const teamTitle = document.querySelector("#teams");

const homeButton = document.querySelector("#albumSection");
const rankingButton = document.querySelector("#rankingSection");


const collectedCount = document.querySelector("#collected-count");
const totalCount = document.querySelector("#total-count");
const progressBar = document.querySelector("#progress-bar");
const raritySummary = document.querySelector("#rarity-summary");
const databaseStatus = document.querySelector("#database-status");
const packDialog = document.querySelector("#pack-dialog");
const packResults = document.querySelector("#pack-results");
const authForm = document.querySelector("#auth-form");
const authFormPanel = document.querySelector("#auth-form-panel");
const authMessage = document.querySelector("#auth-message");
const currentUsername = document.querySelector("#current-username");
const userPanel = document.querySelector("#user-panel");
const usernameInput = document.querySelector("#username-input");
const passwordInput = document.querySelector("#password-input");
const openPackButton = document.querySelector("#open-pack");
const completeAlbumButton = document.querySelector("#complete-album");
const resetAlbumButton = document.querySelector("#reset-album");
const getPackButton = document.querySelector("#get-pack");

totalCount.textContent = stickers.length;

async function apiRequest(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(path, { ...options, headers });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || `Request failed with ${response.status}`);
  }

  return payload;
}

async function loadCollectedCards() {
  const payload = await apiRequest("/api/collection");
  return new Set(payload.collected);
}

//TODO: Remove, users can query to update his collection
async function saveCollectedCards(ids) {
  const payload = await apiRequest("/api/collection", {
    method: "PUT",
    body: JSON.stringify({ collected: ids })
  });

  return new Set(payload.collected);
}

async function authenticate(path) {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  authMessage.textContent = "";

  try {
    const payload = await apiRequest(path, {
      method: "POST",
      body: JSON.stringify({ username, password })
    });

    authToken = payload.token;
    currentUser = payload.user.username;
    adminTools.classList.toggle("is-hidden", !payload.user.isAdmin);
    console.log(!payload.user.isAdmin);
    collected = new Set(payload.collected);
    availablePacks = payload.user.availablePacks;
    sessionStorage.setItem("album-token", authToken);
    sessionStorage.setItem("album-user", currentUser);
    sessionStorage.setItem("album-availablePacks", availablePacks);
    passwordInput.value = "";
    setSignedInState();
    renderAlbum();
  } catch (error) {
    authMessage.textContent = error.message;
  }
}

function cardTemplate(sticker, forceCollected = false) {
  const isCollected = forceCollected || collected.has(sticker.id);
  const stateClass = isCollected ? "is-collected" : "is-missing";
  const altText = isCollected ? sticker.name : `Missing sticker ${sticker.id}`;

  return `
    <article class="sticker-card ${stateClass}" data-rarity="${sticker.rarity}">
      <span class="card-number">#${String(sticker.id).padStart(2, "0")}</span>
      <div class="sticker-image">
        <img src="${sticker.image}" alt="${altText}" />
      </div>
      <div class="sticker-meta">
        <span class="rarity ${sticker.rarity}">${sticker.rarity}</span>
        <h3>${isCollected ? sticker.name : "Missing sticker"}</h3>
        <p>${sticker.team}</p>
      </div>
    </article>
  `;
}

function filteredStickers() {
  return stickers.filter((sticker) => {
    return (sticker.team === teams[activeTeam]); //collected.has(sticker.id) &&
    return true;
  });
}

function renderAlbum() {
  grid.innerHTML = filteredStickers().map((sticker) => cardTemplate(sticker)).join("");

  const owned = collected.size;
  const rareOwned = stickers.filter((sticker) => sticker.rarity !== "common" && collected.has(sticker.id)).length;
  const rareTotal = stickers.filter((sticker) => sticker.rarity !== "common").length;
  teamTitle.textContent = teams[activeTeam];

  collectedCount.textContent = owned;
  progressBar.style.width = `${(owned / stickers.length) * 100}%`;
  raritySummary.textContent = `${rareOwned}/${rareTotal} rare stickers collected`;
}

function pickPack() {
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

async function persistAndRender() {
  collected = await saveCollectedCards([...collected]);
  renderAlbum();
}

function updatePackUI() {
    let packCount = document.querySelector("#pack-count");
    if(!packCount)
        return;

    packCount.textContent = availablePacks;

    openPackButton.disabled = availablePacks <= 0;

    openPackButton.classList.toggle(
        "is-disabled",
        availablePacks <= 0
    );
}

function setControlsEnabled(isEnabled) {
  [openPackButton, completeAlbumButton, resetAlbumButton, getPackButton].forEach((button) => {
    button.disabled = !isEnabled;
    button.classList.toggle("is-disabled", !isEnabled);
  });
}

function setSignedInState() {
  authFormPanel.classList.add("is-hidden");
  userPanel.classList.remove("is-hidden");
  currentUsername.textContent = currentUser;
  databaseStatus.textContent = "Packs available: ";
  const newSpan = document.createElement('span');
  newSpan.textContent = "0";
  newSpan.id = 'pack-count';
  databaseStatus.appendChild(newSpan);
  setControlsEnabled(true);
  updatePackUI();
}

function setSignedOutState(message = "") {
  authFormPanel.classList.remove("is-hidden");
  userPanel.classList.add("is-hidden");
  currentUsername.textContent = "";
  authMessage.textContent = message;
  databaseStatus.textContent = "Sign in to save cards";
  adminTools.classList.add("is-hidden");
  collected = new Set();
  setControlsEnabled(false);
  renderAlbum();
}

async function startAlbum() {
  if (!authToken) {
    setSignedOutState();
    return;
  }

  try {
    collected = await loadCollectedCards();
    setSignedInState();
    renderAlbum();
  } catch {
    authToken = "";
    currentUser = "";
    availablePacks = 0;
    sessionStorage.removeItem("album-token");
    sessionStorage.removeItem("album-user");
    sessionStorage.removeItem("album-availablePacks");
    setSignedOutState("Session expired");
  }
}

authForm.addEventListener("submit", (event) => {
  event.preventDefault();
  authenticate("/api/sessions");
});

document.querySelector("#register-button").addEventListener("click", () => {
  authenticate("/api/users");
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  try {
    await apiRequest("/api/sessions", { method: "DELETE" });
  } finally {
    authToken = "";
    currentUser = "";
    sessionStorage.removeItem("album-availablePacks");
    sessionStorage.removeItem("album-token");
    sessionStorage.removeItem("album-user");
    setSignedOutState();
  }
});

const adminTools = document.querySelector("#admin-tools");

openPackButton.addEventListener("click", async () => {
    try{
        if (!authToken) return;

        const payload = await apiRequest(
            "/api/open-pack",
            { method: "POST" }
        );

        availablePacks = payload.availablePacks;

        updatePackUI();

          const pack = pickPack();
          pack.forEach((sticker) => collected.add(sticker.id));
          packResults.innerHTML = pack.map((sticker) => cardTemplate(sticker, true)).join("");
          await persistAndRender();
          packDialog.showModal();
    } catch(error) {
        authMessage.textContent = error.message;
    }
});

async function switchTo(targetId) {
  const albumStage = document.querySelector('.album-stage');
  const rankingStage = document.getElementById('ranking-stage');

  if (!document.startViewTransition) {
    toggleVisibility(targetId, albumStage, rankingStage);
    return;
  }

  document.startViewTransition(() => {
    toggleVisibility(targetId, albumStage, rankingStage);
  });
}

function toggleVisibility(targetId, album, ranking) {
  if (targetId === 'albumSection') {
    album.classList.remove('is-hidden');
    ranking.classList.add('is-hidden');
  } else {
    album.classList.add('is-hidden');
    ranking.classList.remove('is-hidden');
  }
}

homeButton.addEventListener("click", async () => {
  switchTo("albumSection");
});

rankingButton.addEventListener("click", async () => {
  switchTo("rankingSection")

  try {
    const data = await apiRequest("/api/get-leaderboard");
    
    const rankingData = data.map(user => ({
      username: user.username,
      stickerCount: user.stickerCount
    })).sort((a, b) => b.stickerCount - a.stickerCount);

    const rankingList = document.querySelector(".ranking-list");
    rankingList.innerHTML = rankingData.map((user, index) => `
      <div class="ranking-item ${user.username === currentUser ? 'is-current-user' : ''}">
        <span class="rank-number">#${index + 1}</span>
        <strong class="username">${user.username}</strong>
        <span class="sticker-count">${user.stickerCount} stickers</span>
      </div>
    `).join("");

  } catch (error) {
    console.error("Failed to load leaderboard:", error);
  }
  
});

document.querySelector("#close-dialog").addEventListener("click", () => packDialog.close());

completeAlbumButton.addEventListener("click", async () => {
  if (!authToken) return;

  collected = new Set(stickers.map((sticker) => sticker.id));
  await persistAndRender();
});

resetAlbumButton.addEventListener("click", async () => {
  if (!authToken) return;

  collected = new Set(initialCollected);
  await persistAndRender();
});

getPackButton.addEventListener("click", async () => {
  if (!authToken) return;

  const payload = await apiRequest("/api/get-pack");
  availablePacks = payload.availablePacks;
  updatePackUI();
});

document.querySelectorAll(".filter-button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector(".filter-button.is-active").classList.remove("is-active");
    button.classList.add("is-active");
    if(button.dataset.filter === "next" && activeTeam<teams.length-1) activeTeam++; 
    if(button.dataset.filter === "prev" && activeTeam>0) activeTeam--;
    renderAlbum();
  });
});

startAlbum();
