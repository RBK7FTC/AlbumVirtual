const teams = [ "RBK7FTC",
    "DINAMITA",
    "SHADOWFOX",
    "MALBECROBOTICS",
    "IMPERIUMFONS",
    "DEVOLTDEIMOS",
    "DEVOLTPHOBOS",
    "MERINITOS"
];

let stickers = new Array();

const initialCollected = new Set([1, 2, 4, 7]);
let collected = new Set();
let activeTeam = 0;
let authToken = sessionStorage.getItem("album-token") || "";
let currentUser = sessionStorage.getItem("album-user") || "";
let availablePacks = sessionStorage.getItem("album-availablePacks");
let tradeRequests = sessionStorage.getItem("album-tradeRequests");
let eventSource;
let eventFeedbackTimer;
let activePackPlacement = null;

const TRADE_PAGE_SIZE = 4;

const grid = document.querySelector("#album-grid");
const teamTitle = document.querySelector("#teams");
const teamLogo = document.querySelector("#team-logo-stage-header");
const albumStage = document.querySelector("#album-stage");
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
const mobileSidebarToggle = document.querySelector("#mobile-sidebar-toggle");
const albumPanel = document.querySelector("#album-panel");
const albumPanelOverlay = document.querySelector("#album-panel-overlay");
const introCover = document.querySelector("#intro-cover");
const packResults = document.querySelector("#pack-results");
const authForm = document.querySelector("#auth-form");
const authFormPanel = document.querySelector("#auth-form-panel");
const authMessage = document.querySelector("#auth-message");
const currentUsername = document.querySelector("#current-username");
const userPanel = document.querySelector("#user-panel");
const usernameInput = document.querySelector("#username-input");
const passwordInput = document.querySelector("#password-input");
const openPackButton = document.querySelector("#open-pack");

function openAlbumPanel() {
  if (!albumPanel || !albumPanelOverlay) {
    return;
  }

  albumPanel.classList.add("is-open");
  albumPanelOverlay.classList.add("is-visible");
  albumPanelOverlay.setAttribute("aria-hidden", "false");
  mobileSidebarToggle?.setAttribute("aria-expanded", "true");
  document.body.classList.add("is-panel-open");
}

function closeAlbumPanel() {
  if (!albumPanel || !albumPanelOverlay) {
    return;
  }

  albumPanel.classList.remove("is-open");
  albumPanelOverlay.classList.remove("is-visible");
  albumPanelOverlay.setAttribute("aria-hidden", "true");
  mobileSidebarToggle?.setAttribute("aria-expanded", "false");
  document.body.classList.remove("is-panel-open");
}

function toggleAlbumPanel() {
  if (!albumPanel) {
    return;
  }

  if (albumPanel.classList.contains("is-open")) {
    closeAlbumPanel();
  } else {
    openAlbumPanel();
  }
}

let touchStartX = 0;
let touchStartY = 0;
let touchActive = false;

function handlePanelSwipeStart(event) {
  if (window.innerWidth > 840) {
    return;
  }

  const touch = event.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  touchActive = true;
}

function handlePanelSwipeEnd(event) {
  if (!touchActive || window.innerWidth > 840) {
    return;
  }

  const touch = event.changedTouches[0];
  const deltaX = touch.clientX - touchStartX;
  const deltaY = touch.clientY - touchStartY;

  if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 60) {
    if (deltaX > 0 && touchStartX < 48) {
      openAlbumPanel();
    } else if (deltaX < 0 && albumPanel?.classList.contains("is-open")) {
      closeAlbumPanel();
    }
  }

  touchActive = false;
}

mobileSidebarToggle?.addEventListener("click", toggleAlbumPanel);
albumPanelOverlay?.addEventListener("click", closeAlbumPanel);

function dismissIntroCover() {
  introCover?.classList.add("is-hidden");
}

introCover?.addEventListener("click", dismissIntroCover);
document.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    dismissIntroCover();
  }
});
document.addEventListener("touchstart", handlePanelSwipeStart, { passive: true });
document.addEventListener("touchend", handlePanelSwipeEnd, { passive: true });
window.addEventListener("resize", () => {
  if (window.innerWidth > 840) {
    closeAlbumPanel();
  }
});

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
    collected = new Set(payload.collected);
    availablePacks = payload.user.availablePacks;
    tradeRequests = payload.user.tradeRequests;
    passwordInput.value = "";
    document.getElementById("adminStageBtn").classList.toggle("is-hidden", !payload.user.isAdmin);

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
    return (sticker.team === teams[activeTeam]);
  });
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function colorDistance(a, b) {
  return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
}

function isUsableLogoColor({ r, g, b, a }) {
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  const saturation = Math.max(r, g, b) - Math.min(r, g, b);

  return a > 180 && brightness > 28 && brightness < 238 && saturation > 18;
}

function getLogoPalette(image) {
  const canvas = document.createElement("canvas");
  const sampleSize = 72;
  canvas.width = sampleSize;
  canvas.height = sampleSize;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, sampleSize, sampleSize);

  const data = context.getImageData(0, 0, sampleSize, sampleSize).data;
  const buckets = new Map();

  for (let index = 0; index < data.length; index += 16) {
    const color = {
      r: data[index],
      g: data[index + 1],
      b: data[index + 2],
      a: data[index + 3]
    };

    if (!isUsableLogoColor(color)) {
      continue;
    }

    const key = [
      Math.round(color.r / 24) * 24,
      Math.round(color.g / 24) * 24,
      Math.round(color.b / 24) * 24
    ].join(",");

    buckets.set(key, (buckets.get(key) || 0) + 1);
  }

  const colors = [...buckets.entries()]
    .map(([key, count]) => {
      const [r, g, b] = key.split(",").map(Number);
      return { r, g, b, count };
    })
    .sort((a, b) => b.count - a.count);

  const primary = colors[0] || { r: 0, g: 87, b: 184 };
  const secondary =
    colors.find((color) => colorDistance(color, primary) > 110) ||
    colors[1] ||
    { r: 201, g: 154, b: 46 };

  return { primary, secondary };
}

function applyTeamLogoColors() {
  if (!albumStage || !teamLogo.complete || !teamLogo.naturalWidth) {
    return;
  }

  try {
    const { primary, secondary } = getLogoPalette(teamLogo);
    albumStage.style.setProperty("--team-primary", rgbToHex(primary));
    albumStage.style.setProperty("--team-secondary", rgbToHex(secondary));
    albumStage.style.setProperty("--team-primary-rgb", `${primary.r}, ${primary.g}, ${primary.b}`);
    albumStage.style.setProperty("--team-secondary-rgb", `${secondary.r}, ${secondary.g}, ${secondary.b}`);
  } catch {
    albumStage.style.removeProperty("--team-primary");
    albumStage.style.removeProperty("--team-secondary");
    albumStage.style.removeProperty("--team-primary-rgb");
    albumStage.style.removeProperty("--team-secondary-rgb");
  }
}

function renderAlbum() {
  grid.innerHTML = filteredStickers().map((sticker) => cardTemplate(sticker)).join("");

  const owned = collected.size;
  const rareOwned = stickers.filter((sticker) => sticker.rarity !== "common" && collected.has(sticker.id)).length;
  const rareTotal = stickers.filter((sticker) => sticker.rarity !== "common").length;
  teamTitle.textContent = teams[activeTeam];
  teamLogo.onload = applyTeamLogoColors;
  teamLogo.src = `assets/${teams[activeTeam]}.svg`;
  if (teamLogo.complete) {
    applyTeamLogoColors();
  }

  collectedCount.textContent = owned;
  progressBar.style.width = `${(owned / stickers.length) * 100}%`;
  raritySummary.textContent = `${rareOwned}/${rareTotal} rare stickers collected`;
}

function updateAlbumFilterState() {
  document.querySelectorAll(".filter-button").forEach((button) => {
    button.classList.remove("is-active");
  });

  const activeDirection = activeTeam < teams.length - 1 ? "next" : "prev";
  document.querySelector(`.filter-button[data-filter="${activeDirection}"]`)?.classList.add("is-active");
}

function ensurePackOpeningLayer() {
  let layer = document.querySelector("#pack-opening-layer");

  if (layer) {
    return layer;
  }

  layer = document.createElement("div");
  layer.id = "pack-opening-layer";
  layer.className = "pack-opening-layer";
  layer.setAttribute("aria-hidden", "true");
  layer.innerHTML = `
    <div class="pack-opening-scrim"></div>
    <section class="pack-opening-panel" aria-label="Sticker packet opening">
      <button id="pack-opening-packet" class="pack-opening-packet" type="button" aria-label="Open sticker packet">
        <span>2026</span>
        <strong>Virtual packet</strong>
      </button>
      <div id="pack-opening-stickers" class="pack-opening-stickers" aria-live="polite"></div>
    </section>
  `;

  document.body.appendChild(layer);
  return layer;
}

function closePackOpeningLayer() {
  const layer = document.querySelector("#pack-opening-layer");

  if (!layer) {
    return;
  }

  layer.classList.remove("is-opened");
  layer.classList.remove("is-visible");
  layer.setAttribute("aria-hidden", "true");
  layer.style.pointerEvents = "none";
  activePackPlacement = null;

  const stickerContainer = layer.querySelector("#pack-opening-stickers");
  if (stickerContainer) {
    stickerContainer.innerHTML = "";
  }

  window.setTimeout(() => {
    layer.remove();
  }, 260);
}

function packStickerTemplate(sticker, index) {
  return `
    <article class="pack-reveal-sticker" data-sticker-id="${sticker.id}" style="--sticker-index: ${index}" role="button" tabindex="0" aria-label="Place ${sticker.name} in album">
      <span class="card-number">#${String(sticker.id).padStart(2, "0")}</span>
      <div class="sticker-image">
        <img src="${sticker.image}" alt="${sticker.name}" draggable="false" />
      </div>
      <div class="sticker-meta">
        <span class="rarity ${sticker.rarity}">${sticker.rarity}</span>
        <h3>${sticker.name}</h3>
        <p>${sticker.team}</p>
      </div>
    </article>
  `;
}

function revealPackStickers(layer, pack) {
  const stickerContainer = layer.querySelector("#pack-opening-stickers");
  stickerContainer.innerHTML = pack.map((sticker, index) => packStickerTemplate(sticker, index)).join("");

  stickerContainer.querySelectorAll(".pack-reveal-sticker").forEach((stickerCard) => {
    const stickerIndex = Number(stickerCard.style.getPropertyValue("--sticker-index") || 0);
    stickerCard.dataset.currentRotation = String((stickerIndex - 1) * -3);
    stickerCard.addEventListener("click", handlePackStickerClick);
    stickerCard.addEventListener("keydown", handlePackStickerKeydown);
  });
}

function startPackOpening(pack) {
  closeAlbumPanel();

  const existingLayer = document.querySelector("#pack-opening-layer");
  if (existingLayer) {
    existingLayer.remove();
  }

  const layer = ensurePackOpeningLayer();
  const packet = layer.querySelector("#pack-opening-packet");

  activePackPlacement = {
    pack,
    placed: new Set()
  };

  layer.classList.remove("is-opened");
  layer.querySelector("#pack-opening-stickers").innerHTML = "";
  layer.classList.add("is-visible");
  layer.setAttribute("aria-hidden", "false");

  const openPacket = () => {
    layer.classList.add("is-opened");
    packet.removeEventListener("click", openPacket);
    revealPackStickers(layer, pack);
  };

  packet.addEventListener("click", openPacket);
}

async function handlePackStickerClick(event) {
  const card = event.currentTarget;

  if (card.classList.contains("is-placing") || card.classList.contains("is-placed")) {
    return;
  }

  const sticker = getPackStickerById(Number(card.dataset.stickerId));

  if (!sticker) {
    return;
  }

  await placePackSticker(sticker, card);
}

async function handlePackStickerKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  event.preventDefault();
  await handlePackStickerClick(event);
}

function getPackStickerById(stickerId) {
  return activePackPlacement?.pack.find((sticker) => sticker.id === stickerId);
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function animatePageCards(cards, type) {
  cards.forEach((card, index) => {
    const direction = Math.random() > 0.5 ? 1 : -1;
    card.style.setProperty(`--page-${type}-direction`, String(direction));
    card.style.setProperty(`--page-${type}-delay`, `${index * 24}ms`);
    card.classList.add(`is-page-${type}`);
  });
}

function animatePageHeader(type) {
  [teamTitle, teamLogo].forEach((element, index) => {
    if (!element) {
      return;
    }

    const direction = Math.random() > 0.5 ? 1 : -1;
    element.style.setProperty(`--page-${type}-direction`, String(direction));
    element.style.setProperty(`--page-${type}-delay`, `${index * 18}ms`);
    element.classList.add(`is-page-${type}`);
  });
}

function clearPageTransitionCards(cards) {
  cards.forEach((card) => {
    card.classList.remove("is-page-exiting", "is-page-entering");
    card.style.removeProperty("--page-exit-direction");
    card.style.removeProperty("--page-exit-delay");
    card.style.removeProperty("--page-enter-direction");
    card.style.removeProperty("--page-enter-delay");
  });
}

function clearPageTransitionHeader() {
  [teamTitle, teamLogo].forEach((element) => {
    if (!element) {
      return;
    }

    element.classList.remove("is-page-exiting", "is-page-entering");
    element.style.removeProperty("--page-exit-direction");
    element.style.removeProperty("--page-exit-delay");
    element.style.removeProperty("--page-enter-direction");
    element.style.removeProperty("--page-enter-delay");
  });
}

async function changeTeamPage(teamIndex, { animate = true, stickerId = null } = {}) {
  if (teamIndex < 0 || teamIndex >= teams.length) {
    return null;
  }

  if (teamIndex === activeTeam) {
    updateAlbumFilterState();
    await switchTo("album-stage");
    renderAlbum();
    return stickerId !== null ? grid.querySelector(`[data-sticker-index="${stickerId}"]`) : null;
  }

  if (animate && grid) {
    albumStage.classList.add("is-page-swapping");
    const exitingCards = [...grid.querySelectorAll(".sticker-card")];
    animatePageCards(exitingCards, "exiting");
    animatePageHeader("exiting");
    await wait(420);
  }

  activeTeam = teamIndex;
  updateAlbumFilterState();
  await switchTo("album-stage");

  renderAlbum();

  if (animate && grid) {
    const enteringCards = [...grid.querySelectorAll(".sticker-card")];
    animatePageCards(enteringCards, "entering");
    animatePageHeader("entering");
    await wait(560);
    clearPageTransitionCards(enteringCards);
    clearPageTransitionHeader();
  }

  albumStage.classList.remove("is-page-swapping");

  return stickerId !== null ? grid.querySelector(`[data-sticker-index="${stickerId}"]`) : null;
}

async function showStickerTeam(sticker) {
  const stickerTeamIndex = teams.indexOf(sticker.team);

  if (stickerTeamIndex === -1) {
    return null;
  }

  return changeTeamPage(stickerTeamIndex, {
    animate: stickerTeamIndex !== activeTeam,
    stickerId: sticker.id
  });
}

async function placePackSticker(sticker, sourceCard) {
  if (!activePackPlacement || activePackPlacement.placed.has(sticker.id)) {
    return;
  }

  const sourceRect = sourceCard.getBoundingClientRect();
  const sourceRotation = Number(sourceCard.dataset.currentRotation || 0);
  const flyingSticker = sourceCard.cloneNode(true);
  flyingSticker.classList.add("is-flying-to-album");
  flyingSticker.style.left = `${sourceRect.left}px`;
  flyingSticker.style.top = `${sourceRect.top}px`;
  flyingSticker.style.width = `${sourceRect.width}px`;
  flyingSticker.style.height = `${sourceRect.height}px`;
  flyingSticker.style.setProperty("--flight-rotation", `${sourceRotation}deg`);
  document.body.appendChild(flyingSticker);
  sourceCard.classList.add("is-placing");
  sourceCard.classList.add("is-placed");
  sourceCard.style.visibility = "hidden";
  sourceCard.style.pointerEvents = "none";
  flyingSticker.classList.add("is-lifting");

  await wait(280);
  const targetCard = await showStickerTeam(sticker);

  if (!targetCard) {
    flyingSticker.remove();
    sourceCard.classList.remove("is-placing");
    sourceCard.classList.remove("is-placed");
    sourceCard.style.visibility = "";
    sourceCard.style.pointerEvents = "";
    return;
  }

  const targetRect = targetCard.getBoundingClientRect();
  const scale = Math.min(targetRect.width / sourceRect.width, targetRect.height / sourceRect.height);
  const x = targetRect.left + (targetRect.width - sourceRect.width) / 2 - sourceRect.left;
  const y = targetRect.top + (targetRect.height - sourceRect.height) / 2 - sourceRect.top;
  const arcLift = Math.min(140, Math.max(56, Math.abs(y) * 0.18));
  const flightDuration = 620;

  targetCard.classList.add("is-receiving-sticker");
  targetCard.style.setProperty("--receive-color", `rgba(var(--team-secondary-rgb), 0.34)`);

  window.setTimeout(() => {
    flyingSticker.classList.remove("is-lifting");
    flyingSticker.classList.add("is-in-flight");
    flyingSticker.style.setProperty("--flight-x", `${x}px`);
    flyingSticker.style.setProperty("--flight-y", `${y}px`);
    flyingSticker.style.setProperty("--flight-arc-y", `${y - arcLift}px`);
    flyingSticker.style.setProperty("--flight-scale", `${Math.max(scale * 1.04, scale + 0.02)}`);
    flyingSticker.style.setProperty("--flight-scale-end", `${scale}`);
    flyingSticker.style.setProperty("--flight-duration", `${flightDuration}ms`);
  }, 120);

  window.setTimeout(async () => {
    collected.add(sticker.id);
    activePackPlacement?.placed.add(sticker.id);
    flyingSticker.remove();
    sourceCard.remove();
    renderAlbum();

    if (activePackPlacement && activePackPlacement.placed.size === activePackPlacement.pack.length) {
      closePackOpeningLayer();
    }
  }, 860);
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
  [openPackButton].forEach((button) => {
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
  databaseStatus.textContent = "Sign in to save stickers";
  document.getElementById("adminStageBtn").classList.add("is-hidden");
  collected = new Set();
  setControlsEnabled(false);
  renderAlbum();
}

async function startAlbum() {
  switchTo("album-stage");

  const payload = await apiRequest("/api/requireStickers");
  stickers = payload.stickers;
  totalCount.textContent = stickers.length;

  if (!authToken) {
    setSignedOutState();
    return;
  }

  try {
    collected = await loadCollectedCards();
    startEvents();
    setSignedInState();
    renderAlbum();
    
    document.getElementById("adminStageBtn").classList.toggle("is-hidden", !payload.isAdmin);
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

openPackButton.addEventListener("click", async () => {
  try{
    if (!authToken) return;

    const payload = await apiRequest(
      "/api/open-pack",
      { method: "POST" }
    );

    availablePacks = payload.availablePacks;
    updatePackUI();
    
    await switchTo("album-stage");
    startPackOpening(payload.pack);
  } catch(error) {
    authMessage.textContent = error.message;
  }
});

var html5QrCode;

function generateUsernameQRCode(){
  const container = document.getElementById("qrCode");
  container.innerHTML = "";
  const size = container.offsetWidth * 0.9;
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
        if(currentState === Html5QrcodeScannerState.PAUSED)
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
      const msg = `Invalid QR Code: ${data.code}`; 
      alert(msg);
    } else {
      const msg = `QR Code: ${res.codeID}, already scanned`; 
      alert(msg);
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
  toggleVisibility(targetId);
  return Promise.resolve();
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
  closeAlbumPanel();
  switchToTradingStage();
});

document.querySelector("#trade-stage").addEventListener("click", handleTradeNavClick);

document.querySelector("#scanQRBtn").addEventListener("click", () => {
  startQRScanner();
});

document.querySelector("#generateQRBtn").addEventListener("click", () => {
  generateUsernameQRCode();
});

document.getElementById("adminStageBtn").addEventListener("click", async () => {
  closeAlbumPanel();
  switchTo("admin-stage");
});

albumStageButton.addEventListener("click", async () => {
  closeAlbumPanel();
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
  closeAlbumPanel();
  switchTo("leaderboard-stage");

  try {
    const data = await apiRequest("/api/get-leaderboard");
    
    updateLeaderboardUI(data);

  } catch (error) {
    console.error("Failed to load leaderboard:", error);
  }
  
});

document.querySelector("#close-dialog").addEventListener("click", () => packDialog.close());

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
  button.addEventListener("click", async () => {
    const targetTeamIndex = button.dataset.filter === "next"
      ? Math.min(activeTeam + 1, teams.length - 1)
      : Math.max(activeTeam - 1, 0);

    if (targetTeamIndex === activeTeam) {
      updateAlbumFilterState();
      renderAlbum();
      return;
    }

    await changeTeamPage(targetTeamIndex);
  });
});

startAlbum();
