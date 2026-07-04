const teams = [ "RBK7FTC",
    "DINAMITA",
    "SHADOWFOX"
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
  { id: 10, name: "Rising Star", rarity: "common", team: "SHADOWFOX", image: "assets/sticker-10.svg" },
  { id: 11, name: "Derby Night", rarity: "epic", team: "SHADOWFOX", image: "assets/sticker-11.svg" },
  { id: 12, name: "Trophy Lift", rarity: "legendary", team: "SHADOWFOX", image: "assets/sticker-12.svg" }
];

const initialCollected = new Set([1, 2, 4, 7]);
let collected = new Set();
let activeTeam = 0;
let authToken = sessionStorage.getItem("album-token") || "";
let currentUser = sessionStorage.getItem("album-user") || "";
let availablePacks = sessionStorage.getItem("album-availablePacks");
let tradeRequests = sessionStorage.getItem("album-tradeRequests");
let eventSource;
let eventFeedbackTimer;

const TRADE_PAGE_SIZE = 4;

const grid = document.querySelector("#album-grid");
const teamTitle = document.querySelector("#teams");
const teamLogo = document.querySelector("#team-logo-stage-header");
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

function showEventFeedback(title, message) {
  const feedback = document.getElementById("event-feedback");
  const feedbackTitle = document.getElementById("event-feedback-title");
  const feedbackMessage = document.getElementById("event-feedback-message");

  if (!feedback || !feedbackTitle || !feedbackMessage) {
    return;
  }

  feedbackTitle.textContent = title;
  feedbackMessage.textContent = message;
  feedback.setAttribute("aria-hidden", "false");
  feedback.classList.remove("is-visible");
  void feedback.offsetWidth;
  feedback.classList.add("is-visible");

  window.clearTimeout(eventFeedbackTimer);
  eventFeedbackTimer = window.setTimeout(() => {
    feedback.classList.remove("is-visible");
    feedback.setAttribute("aria-hidden", "true");
  }, 2000);
}

function startEvents() {

  if (eventSource)
      eventSource.close();

  eventSource = new EventSource(
  `/api/events?token=${encodeURIComponent(authToken)}`
  );

  eventSource.addEventListener("trade-request-received", (event) => {

      const payload = JSON.parse(event.data);

      tradeRequests.push(payload);
      showEventFeedback("Trade request", "A new trade request arrived");
      updateNotificationsUI(payload);

  });

  eventSource.addEventListener("pack-received", (event) => {

    const payload = JSON.parse(event.data);

    availablePacks = payload.availablePacks;
    showEventFeedback("Pack received", "You received a new pack");
    updatePackUI();

  });

  eventSource.addEventListener("collection-update", (event) => {

    const payload = JSON.parse(event.data);

    collected = new Set(payload);
    renderAlbum();
  });

  eventSource.addEventListener("trade-request-response", (event) => {

    const payload = JSON.parse(event.data);

    if(payload.accepted){
      showEventFeedback("Trade request response", "Trade request accepted");
    } else {
      showEventFeedback("Trade request response", "Trade request rejected");
    }

  });

  eventSource.addEventListener("leaderboard", (event) => {

    const payload = JSON.parse(event.data);

    updateLeaderboardUI(payload);
  });
}

async function loadCollectedCards() {
  const payload = await apiRequest("/api/collection");
  return new Set(payload.collected);
}

//TODO: Remove, users can use this url to auto update his collection
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
    tradeRequests = payload.user.tradeRequests;
    passwordInput.value = "";

    startEvents();

    sessionStorage.setItem("album-token", authToken);
    sessionStorage.setItem("album-user", currentUser);
    sessionStorage.setItem("album-availablePacks", availablePacks);
    sessionStorage.setItem("album-tradeRequests", tradeRequests);
    
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
  const isMinimal = options.minimal === true;
  const isFirst = options.first === true;

  if (isMinimal) {
    return `
      <article class="sticker-card sticker-card--minimal ${stateClass}" data-rarity="${sticker.rarity}" data-sticker-index="${sticker.id}">
        <div class="sticker-image">
          <img src="${sticker.image}" alt="${altText}" />
        </div>
        <span class="card-number">#${String(sticker.id).padStart(2, "0")}</span>
        <span class="eyebrown">${isFirst ? "GIVES" : "WANTS"}</span>
      </article>
    `;
  }

  return `
    <article class="sticker-card ${stateClass} ${variantClass}" data-rarity="${sticker.rarity}" data-sticker-index="${sticker.id}" ${interactiveAttrs}>
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

  const tradeStickers = container.querySelectorAll(".trade-card");
  tradeStickers.forEach((tradeSticker) => {
    if (tradeSticker.dataset.hasClickListener) {
      return;
    }

    tradeSticker.dataset.hasClickListener = "true";
    tradeSticker.addEventListener("click", (event) => {
      event.stopPropagation();

      const sourceImage = tradeSticker.querySelector("img");
      if (!sourceImage) {
        return;
      }

      const slot = container.id === "own-collection-trade-container"
        ? document.querySelector(".trade-center-panel .trade-stickers-selection:first-child .trade-sticker-slot")
        : document.querySelector(".trade-center-panel .trade-stickers-selection:last-child .trade-sticker-slot");

      if (!slot) {
        return;
      }

      slot.dataset.stickerIndex = tradeSticker.dataset.stickerIndex;

      const clonedImage = sourceImage.cloneNode(true);
      clonedImage.classList.add("trade-fly-image");
      document.body.appendChild(clonedImage);

      const sourceImg = tradeSticker.querySelector('img');
      const sourceRect = sourceImg.getBoundingClientRect();
      const targetRect = slot.getBoundingClientRect();

      const scaleFactor = 1.5;
      const finalSourceSize = [sourceRect.width * scaleFactor, sourceRect.height * scaleFactor];
      const translation = [
        targetRect.left - sourceRect.left + (targetRect.width / 2) - (finalSourceSize[0] / 2),
        targetRect.top - sourceRect.top - (targetRect.height / 2) + (finalSourceSize[1] / 2)
      ];

      clonedImage.style.position = "fixed";
      clonedImage.style.left = `${sourceRect.left}px`;
      clonedImage.style.top = `${sourceRect.top}px`;
      clonedImage.style.width = `${sourceRect.width}px`;
      clonedImage.style.height = `${sourceRect.height}px`;
      clonedImage.style.zIndex = "2000";
      clonedImage.style.pointerEvents = "none";
      clonedImage.style.transition = "transform 0.45s ease, opacity 0.45s ease";
      clonedImage.style.opacity = "1";

      requestAnimationFrame(() => {
        clonedImage.style.transform = `translate(${translation[0]}px, ${translation[1]}px) scale(${scaleFactor})`;
        clonedImage.style.opacity = "0.4";
      });

      setTimeout(() => {
        slot.innerHTML = "";
        const finalImage = sourceImage.cloneNode(true);
        finalImage.classList.add("trade-slot-image");
        slot.appendChild(finalImage);
        clonedImage.remove();
      }, 450);
    });
  });

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
  teamLogo.src = `assets/${teams[activeTeam]}.svg`;

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
  sessionStorage.setItem("album-availablePacks", availablePacks);
  
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
  switchTo("album-stage");

  if (!authToken) {
    setSignedOutState();
    return;
  }

  try {
    collected = await loadCollectedCards();
    startEvents();
    setSignedInState();
    renderAlbum();
  } catch {
    authToken = "";
    currentUser = "";
    availablePacks = 0;
    tradeRequests = [];
    eventSource?.close();
    eventSource = null;
    sessionStorage.removeItem("album-availablePacks");
    sessionStorage.removeItem("album-tradeRequests");
    sessionStorage.removeItem("album-token");
    sessionStorage.removeItem("album-user");
    setSignedOutState("Session expired");
  }
}

authForm.addEventListener("submit", (event) => {
  switchTo("album-stage");
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
    availablePacks = 0;
    tradeRequests = [];
    eventSource?.close();
    eventSource = null;
    sessionStorage.removeItem("album-availablePacks");
    sessionStorage.removeItem("album-tradeRequests");
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
  const username = sessionStorage.getItem("album-user") || "NULL";
  const text = `{"username": "${username}"}`;
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
      
      html5QrCode.pause();
      setTimeout(() => {
        const currentState = html5QrCode.getState();
        if(currentState === html5QrCode.PAUSED)
          html5QrCode.resume();
      }, 1000);

      if(Object.hasOwn(data, 'username')){
        handleStartTrade(data);
      } else if(Object.hasOwn(data, 'code')){
        handlePackQRCodeScanned(data);
      }
 
    };

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    html5QrCode.start(
        { facingMode: "environment" }, 
        config, 
        qrCodeSuccessCallback
    ).catch((err) => {
        alert("Unable to start scanning", err);
    });
}

async function handlePackQRCodeScanned(data){
  const res = await apiRequest("/api/qrCodeScanned", {
    method: "PUT",
    body: JSON.stringify({ code: data.code })
  });

  if(res.state == false){
    if(res.codeID == -1){
      console.error("Invalid QR Code: ", data.code);
    } else {
      console.error("QR Code: ", res.codeID ," already scanned");
    }
    return;
  }


  availablePacks = res.availablePacks;
  updatePackUI();
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
    
    const divs = document.getElementsByClassName("trade-stickers-selection");
    for(const div of divs){
      const img = div.querySelector('img');
      img.alt = "Select a sticker";
      img.removeAttribute('src'); 
      for (const key in div.dataset) {
        delete div.dataset[key];
      }
    }

    switchTo("trade-stage");

    document.getElementById("trade-send-trade-button").dataset.username = data.username;

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

document.getElementById("trade-send-trade-button").addEventListener("click", async () => {
  try {
    const sendTradeButton = document.getElementById("trade-send-trade-button");
    if(!sendTradeButton) return;
    const targetUsername = sendTradeButton.dataset.username;

    const tradeSlots = document.getElementsByClassName("trade-sticker-slot");
    if(!tradeSlots || tradeSlots.length != 2)
      return;
    const givesStickerIndex = tradeSlots[0].dataset.stickerIndex;
    const wantsStickerIndex = tradeSlots[1].dataset.stickerIndex;
    
    const data = await apiRequest("/api/post-trade-request", {
      method: "PUT",
      body: JSON.stringify({
        targetUser: targetUsername,
        givesStickerIndex: givesStickerIndex,
        wantsStickerIndex: wantsStickerIndex  
      })
    });
    
    if(data.state == true){
      switchToTradingStage();
    } else {
      alert(data.error)
    }

  } catch (error) {
    alert(error);
  }
});

async function switchToTradingStage(){
  try{
    const data = await apiRequest("/api/require-tradeRequests");

    await switchTo("trading-stage");

    updateNotificationsUI(data);

    generateUsernameQRCode();
  } catch(error){
    alert(error);
  }
}

function updateNotificationsUI(data){
    const span = notificationsBtn.querySelector("span");
    span.style.display = data.length ? "flex" : "none";
    span.innerHTML = data.length;
    tradeRequests = data;
    sessionStorage.setItem("album-tradeRequests", tradeRequests);
}

tradingStageButton.addEventListener("click", async () => {
  switchToTradingStage();
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

function updateLeaderboardUI(data){
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
}

leaderboardStageButton.addEventListener("click", async () => {
  switchTo("leaderboard-stage");

  try {
    const data = await apiRequest("/api/get-leaderboard");
    
    updateLeaderboardUI(data);

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

  const toggleDropdown = (e) => {
    e.stopPropagation();
    const isVisible = notificationsDropdown.style.display === 'block';
    notificationsDropdown.style.display = isVisible ? 'none' : 'block';

    notificationsDropdown.innerHTML = "<div style='font-weight: bold; border-bottom: 1px solid #eee; margin-bottom: 8px; padding-bottom: 4px;'>Notifications</div>";

    if(tradeRequests.length == 0){
      notificationsDropdown.innerHTML += " <div class='notifications-dropdown-item'>No available notifications</div>";
    }

    for(let i=0; i<tradeRequests.length; i++){
      const givesSticker = stickers[tradeRequests[i].givesStickerIndex - 1];
      const wantsSticker = stickers[tradeRequests[i].wantsStickerIndex - 1];

      notificationsDropdown.innerHTML += `
        <div class="notifications-dropdown-item" data-trade-request-index="${i}">
          <div class="notification-content">
            <strong>${tradeRequests[i].username}</strong>
            <div class="notification-stickers">
              ${givesSticker ? cardTemplate(givesSticker, true, { minimal: true, first: true }) : ""}
              ${wantsSticker ? cardTemplate(wantsSticker, false, { minimal: true, first: false }) : ""}
            </div>
          </div>
          <div class="notification-actions">
            <button type="button" class="notification-action-btn notification-accept-btn" data-action="accept">Accept</button>
            <button type="button" class="notification-action-btn notification-reject-btn" data-action="reject" style='margin-left: auto; display:flex; justify-self:flex-end;'>Reject</button>
          </div>
        </div>
      `;
    }

    const targetDivs = document.getElementsByClassName('notifications-dropdown-item');

    for(const div of targetDivs){
      const actionButtons = div.querySelectorAll('.notification-action-btn');
      actionButtons.forEach((button) => {
        button.addEventListener('click', async (event) => {
          event.stopPropagation();

          const dropdown = document.querySelector('div#notificationsDropdown');
          if (dropdown) {
            dropdown.style.display = 'none';
          }

          let responseAccepted = false;
          if(button.dataset.action === "accept"){
            responseAccepted = true;
          } else if(button.dataset.action === "reject"){
            responseAccepted = false;
          } else {
            return;
          }

          const data = await apiRequest("/api/response-to-trade-request", {
            method: "PUT",
            body: JSON.stringify({ 
              accepted: responseAccepted,
              tradeRequest: tradeRequests[div.dataset.tradeRequestIndex],
              tradeRequestIndex: div.dataset.tradeRequestIndex })
          });

          if(data.state == true){
            tradeRequests = data.tradeRequests;
            collected = new Set(data.collection);
            renderAlbum();
            switchToTradingStage();
          }

        });
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
