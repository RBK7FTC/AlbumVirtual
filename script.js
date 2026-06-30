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

const TRADE_PAGE_SIZE = 4;

const grid = document.querySelector("#album-grid");
const teamTitle = document.querySelector("#teams");

const tradingStageButton = document.querySelector("#tradingStageBtn");
const albumStageButton = document.querySelector("#albumStageBtn");
const leaderboardStageButton = document.querySelector("#leaderboardStageBtn");
const notificationsBtn = document.querySelector('#tradingNotificationsBtn');
const notificationsDropdown = document.querySelector('#notificationsDropdown');

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

function cardTemplate(sticker, forceCollected = false, options = {}) {
  const isCollected = forceCollected || collected.has(sticker.id);
  const stateClass = isCollected ? "is-collected" : "is-missing";
  const altText = isCollected ? sticker.name : `Missing sticker ${sticker.id}`;
  const variantClass = options.variant === "trade" ? "trade-card" : "";
  const interactiveAttrs = options.variant === "trade" ? 'role="button" tabindex="0"' : "";

  return `
    <article class="sticker-card ${stateClass} ${variantClass}" data-rarity="${sticker.rarity}" ${interactiveAttrs}>
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

function updateTradeNavButtons(panel, totalCount, currentIndex) {
  const buttons = panel.querySelectorAll(".trade-nav-button");
  const maxIndex = Math.max(0, totalCount - TRADE_PAGE_SIZE);

  buttons.forEach((button) => {
    const direction = button.dataset.direction;
    const isDisabled =
      (direction === "prev" && currentIndex === 0) ||
      (direction === "next" && currentIndex >= maxIndex) ||
      totalCount <= TRADE_PAGE_SIZE;

    button.disabled = isDisabled;
    button.classList.toggle("is-disabled", isDisabled);
  });
}

function renderTradeCollection(container, stickerIndexes, forceCollected = false, startIndex = 0) {
  const visibleIndexes = stickerIndexes.slice(startIndex, startIndex + TRADE_PAGE_SIZE);
  container.dataset.tradeItems = JSON.stringify(stickerIndexes);
  container.dataset.tradeIndex = String(startIndex);
  container.dataset.tradeForceCollected = String(forceCollected);
  container.innerHTML = visibleIndexes
    .map((stickerIndex) => cardTemplate(stickers[stickerIndex - 1], forceCollected, { variant: "trade" }))
    .join("");

  const panel = container.closest(".trade-collection-panel");
  updateTradeNavButtons(panel, stickerIndexes.length, startIndex);
}

function handleTradeNavClick(event) {
  const button = event.target.closest("#trade-stage .trade-nav-button");
  if (!button) {
    return;
  }

  const panel = button.closest(".trade-collection-panel");
  const container = panel?.querySelector(".trade-strickers-collection");
  if (!container) {
    return;
  }

  const stickerIndexes = JSON.parse(container.dataset.tradeItems || "[]");
  const currentIndex = Number(container.dataset.tradeIndex || 0);
  const direction = button.dataset.direction === "next" ? 1 : -1;
  const nextIndex = Math.min(Math.max(currentIndex + direction, 0), Math.max(0, stickerIndexes.length - TRADE_PAGE_SIZE));

  renderTradeCollection(
    container,
    stickerIndexes,
    container.dataset.tradeForceCollected === "true",
    nextIndex
  );
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

var html5QrCode;

function generateUsernameQRCode(){
  const container = document.getElementById("qrCode");
  container.innerHTML = "";
  const size = container.offsetWidth;
  //const text = sessionStorage.getItem("album-user") || "NULL";
  const text = '{"username": "pepe"}';
  const usernameQrCode = new QRCode(container, {
    text: text,
    width: size,
    height: size,
    correctLevel: QRCode.CorrectLevel.H
  });
}

function startQRScanner(){
    html5QrCode = new Html5Qrcode("qrCode");

    const qrCodeSuccessCallback = async (decodedText, decodedResult) => {
      const data = JSON.parse(decodedText);
      
      if(Object.hasOwn(data, 'username')){
        handleStartTrade(data);
      } else if(Object.hasOwn(data, 'code')){

      }
 
    };

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    html5QrCode.start(
        { facingMode: "environment" }, 
        config, 
        qrCodeSuccessCallback
    ).catch((err) => {
        console.error("Unable to start scanning", err);
    });
}

async function handleStartTrade(data){
  try{
    if (!authToken){
      alert("Sing-in required");
      return;
    } 

    const payload = await apiRequest("/api/start-trade", {
      method: "PUT",
      body: JSON.stringify({ username: data.username })
    });
    
    switchTo("trade-stage");

    const ownContainer = document.getElementById("own-collection-trade-container");
    const ownStickerIndexes = [...collected];

    renderTradeCollection(ownContainer, ownStickerIndexes, false, 0);

    const otherContainer = document.getElementById("other-collection-trade-container");
    const otherStickerIndexes = payload.collected;

    renderTradeCollection(otherContainer, otherStickerIndexes, true, 0);

    html5QrCode.stop().then((ignore) => {
    }).catch((err) => {
        console.error("Stop failed: ", err);
    });

  } catch(error) {
    alert(error.message);
  }
}

function toggleVisibility(targetId) {
  const stages = document.querySelectorAll('.stage');
  
  stages.forEach(stage => {
    stage.classList.add('is-hidden');
  });

  document.getElementById(targetId).classList.remove('is-hidden');
}

async function switchTo(targetId) {

  if (!document.startViewTransition) {
    toggleVisibility(targetId);
    return Promise.resolve();
  }

  const transition = document.startViewTransition(() => {
    toggleVisibility(targetId);
  });

  return transition.finished;   
}

tradingStageButton.addEventListener("click", async () => {
  await switchTo("trading-stage");

  generateUsernameQRCode();
});

document.querySelector("#trade-stage").addEventListener("click", handleTradeNavClick);

document.querySelector("#scanQRBtn").addEventListener("click", () => {
  startQRScanner();
});

document.querySelector("#generateQRBtn").addEventListener("click", () => {
  generateUsernameQRCode();
});

albumStageButton.addEventListener("click", async () => {
  switchTo("album-stage");
});

leaderboardStageButton.addEventListener("click", async () => {
  switchTo("leaderboard-stage");

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

{
  const notificationsCount = 2;

  const toggleDropdown = (e) => {
    e.stopPropagation();
    const isVisible = notificationsDropdown.style.display === 'block';
    notificationsDropdown.style.display = isVisible ? 'none' : 'block';

    notificationsDropdown.innerHTML = "<div style='font-weight: bold; border-bottom: 1px solid #eee; margin-bottom: 8px; padding-bottom: 4px;'>Notifications</div>";

    for(let i=0; i<notificationsCount; i++){
      notificationsDropdown.innerHTML += `
        <div class="notifications-dropdown-item">No new notifications</div>
      `;
    }

    const targetDivs = document.getElementsByClassName('notifications-dropdown-item');

    for(const div of targetDivs){
      div.addEventListener('click', function(event) {
        console.log('Notification item clicked:', this.textContent);

        const dropdown = document.querySelector('div#notificationsDropdown');
        if (dropdown) {
          dropdown.style.display = 'none';
        }
      });
    }
    
  };

  const closeDropdown = () => {
    notificationsDropdown.style.display = 'none';
  };

  notificationsBtn.addEventListener('click', toggleDropdown);

  notificationsDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  document.addEventListener('click', closeDropdown);

}

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
