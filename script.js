const stickers = [
  { id: 1, name: "Opening Spark", rarity: "common", category: "Moment", image: "assets/sticker-01.svg" },
  { id: 2, name: "Midfield Pulse", rarity: "common", category: "Player", image: "assets/sticker-02.svg" },
  { id: 3, name: "Golden Save", rarity: "rare", category: "Highlight", image: "assets/sticker-03.svg" },
  { id: 4, name: "Street Captain", rarity: "common", category: "Player", image: "assets/sticker-04.svg" },
  { id: 5, name: "Final Whistle", rarity: "rare", category: "Moment", image: "assets/sticker-05.svg" },
  { id: 6, name: "Neon Striker", rarity: "epic", category: "Legend", image: "assets/sticker-06.svg" },
  { id: 7, name: "Home Colors", rarity: "common", category: "Crest", image: "assets/sticker-07.svg" },
  { id: 8, name: "Away Colors", rarity: "common", category: "Crest", image: "assets/sticker-08.svg" },
  { id: 9, name: "Stadium Lights", rarity: "rare", category: "Arena", image: "assets/sticker-09.svg" },
  { id: 10, name: "Rising Star", rarity: "common", category: "Player", image: "assets/sticker-10.svg" },
  { id: 11, name: "Derby Night", rarity: "epic", category: "Moment", image: "assets/sticker-11.svg" },
  { id: 12, name: "Trophy Lift", rarity: "rare", category: "Legend", image: "assets/sticker-12.svg" }
];

const initialCollected = new Set([1, 2, 4, 7]);
let collected = new Set(JSON.parse(localStorage.getItem("virtual-album")) || [...initialCollected]);
let activeFilter = "all";

const grid = document.querySelector("#album-grid");
const collectedCount = document.querySelector("#collected-count");
const totalCount = document.querySelector("#total-count");
const progressBar = document.querySelector("#progress-bar");
const raritySummary = document.querySelector("#rarity-summary");
const packDialog = document.querySelector("#pack-dialog");
const packResults = document.querySelector("#pack-results");

totalCount.textContent = stickers.length;

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
        <p>${isCollected ? sticker.category : "Empty slot"}</p>
      </div>
    </article>
  `;
}

function filteredStickers() {
  return stickers.filter((sticker) => {
    if (activeFilter === "collected") return collected.has(sticker.id);
    if (activeFilter === "missing") return !collected.has(sticker.id);
    if (activeFilter === "rare") return sticker.rarity !== "common";
    return true;
  });
}

function renderAlbum() {
  grid.innerHTML = filteredStickers().map((sticker) => cardTemplate(sticker)).join("");

  const owned = collected.size;
  const rareOwned = stickers.filter((sticker) => sticker.rarity !== "common" && collected.has(sticker.id)).length;
  const rareTotal = stickers.filter((sticker) => sticker.rarity !== "common").length;

  collectedCount.textContent = owned;
  progressBar.style.width = `${(owned / stickers.length) * 100}%`;
  raritySummary.textContent = `${rareOwned}/${rareTotal} rare stickers collected`;
  localStorage.setItem("virtual-album", JSON.stringify([...collected]));
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

document.querySelector("#open-pack").addEventListener("click", () => {
  const pack = pickPack();
  pack.forEach((sticker) => collected.add(sticker.id));
  packResults.innerHTML = pack.map((sticker) => cardTemplate(sticker, true)).join("");
  renderAlbum();
  packDialog.showModal();
});

document.querySelector("#close-dialog").addEventListener("click", () => packDialog.close());

document.querySelector("#complete-album").addEventListener("click", () => {
  collected = new Set(stickers.map((sticker) => sticker.id));
  renderAlbum();
});

document.querySelector("#reset-album").addEventListener("click", () => {
  collected = new Set(initialCollected);
  renderAlbum();
});

document.querySelectorAll(".filter-button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector(".filter-button.is-active").classList.remove("is-active");
    button.classList.add("is-active");
    activeFilter = button.dataset.filter;
    renderAlbum();
  });
});

renderAlbum();
