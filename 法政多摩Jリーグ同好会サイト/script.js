const CONTENT_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ3VSgygtQqZ8URsoSde9HCLMyE1ff0ycD58lHyjkLCxPDhCGUGkJxreFp14pWeMm6YpjHA4GuDwnXK/pub?gid=0&single=true&output=csv";
const NEWS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ3VSgygtQqZ8URsoSde9HCLMyE1ff0ycD58lHyjkLCxPDhCGUGkJxreFp14pWeMm6YpjHA4GuDwnXK/pub?gid=690422912&single=true&output=csv";
const REPORTS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ3VSgygtQqZ8URsoSde9HCLMyE1ff0ycD58lHyjkLCxPDhCGUGkJxreFp14pWeMm6YpjHA4GuDwnXK/pub?gid=516860665&single=true&output=csv";
const SCHEDULE_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ3VSgygtQqZ8URsoSde9HCLMyE1ff0ycD58lHyjkLCxPDhCGUGkJxreFp14pWeMm6YpjHA4GuDwnXK/pub?gid=920407538&single=true&output=csv";

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell !== ""));
}

async function fetchRows(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const text = await res.text();
    const rows = parseCSV(text);
    if (rows.length === 0) return null;
    const [header, ...dataRows] = rows;
    const keys = header.map((h) => h.trim().toLowerCase());
    return dataRows.map((r) => {
      const obj = {};
      keys.forEach((k, i) => { obj[k] = (r[i] || "").trim(); });
      return obj;
    });
  } catch (err) {
    return null;
  }
}

function escapeHTML(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function nl2br(str) {
  return escapeHTML(str).replace(/\n/g, "<br>");
}

function isTrue(v) {
  return ["true", "1", "yes", "はい", "○"].includes((v || "").trim().toLowerCase());
}

function driveImageURL(url) {
  const trimmed = (url || "").trim();
  if (!trimmed) return "";
  const match = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match) {
    return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
  }
  return trimmed;
}

async function applySiteContent() {
  const textTargets = document.querySelectorAll("[data-content]");
  const imageTargets = document.querySelectorAll("[data-content-image]");
  const bgTargets = document.querySelectorAll("[data-content-bg]");
  if (textTargets.length === 0 && imageTargets.length === 0 && bgTargets.length === 0) return;
  const rows = await fetchRows(CONTENT_CSV_URL);
  if (!rows) return;
  const contentMap = {};
  rows.forEach((r) => {
    if (r.key) contentMap[r.key] = r.text || "";
  });
  textTargets.forEach((el) => {
    const value = contentMap[el.dataset.content];
    if (value) {
      el.innerHTML = nl2br(value);
    }
  });
  imageTargets.forEach((el) => {
    const value = contentMap[el.dataset.contentImage];
    if (value) {
      el.src = driveImageURL(value);
    }
  });
  bgTargets.forEach((el) => {
    const value = contentMap[el.dataset.contentBg];
    if (value) {
      el.style.backgroundImage = `url("${driveImageURL(value)}")`;
    }
  });
}

function parseFlexibleDate(str) {
  const s = (str || "").trim();
  const match = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return isNaN(date.getTime()) ? null : date;
}

function applyExpiryBadges(root) {
  root.querySelectorAll("[data-expires]").forEach((entry) => {
    const expires = parseFlexibleDate(entry.dataset.expires);
    if (!expires) return;
    if (Date.now() <= expires.getTime()) return;
    entry.classList.add("is-expired");
    const badge = document.createElement("span");
    badge.className = "expired-badge";
    badge.textContent = "期限切れ・削除を検討してください";
    entry.prepend(badge);
  });
}

function applyPostedBadges(root) {
  root.querySelectorAll("[data-posted]").forEach((entry) => {
    const threshold = parseFlexibleDate(entry.dataset.posted);
    if (!threshold) return;
    threshold.setMonth(threshold.getMonth() + 3);
    if (Date.now() <= threshold.getTime()) return;
    entry.classList.add("is-expired");
    const badge = document.createElement("span");
    badge.className = "expired-badge";
    badge.textContent = "投稿から3ヶ月経過・削除を検討してください";
    entry.prepend(badge);
  });
}

const galleryModal = document.getElementById("galleryModal");
let openGallery = () => {};

if (galleryModal) {
  const galleryTitle = galleryModal.querySelector(".gallery-modal-title");
  const galleryGrid = galleryModal.querySelector(".gallery-modal-grid");
  const galleryClose = galleryModal.querySelector(".gallery-modal-close");

  openGallery = (entry) => {
    const images = entry.dataset.gallery.split(",").map((s) => s.trim()).filter(Boolean);
    const title = entry.querySelector("h3, h4")?.textContent ?? "";
    galleryTitle.textContent = title;
    galleryGrid.innerHTML = "";
    images.forEach((src, i) => {
      const img = document.createElement("img");
      img.src = src;
      img.alt = `${title} 写真${i + 1}`;
      galleryGrid.appendChild(img);
    });
    galleryModal.classList.add("open");
    document.body.style.overflow = "hidden";
  };

  const closeGallery = () => {
    galleryModal.classList.remove("open");
    document.body.style.overflow = "";
  };

  galleryClose.addEventListener("click", closeGallery);
  galleryModal.addEventListener("click", (e) => {
    if (e.target === galleryModal) closeGallery();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeGallery();
  });
}

function initGalleryTriggers(root) {
  if (!galleryModal) return;
  root.querySelectorAll("[data-gallery]:not(.gallery-trigger)").forEach((entry) => {
    entry.classList.add("gallery-trigger");
    entry.setAttribute("tabindex", "0");
    entry.setAttribute("role", "button");
    entry.addEventListener("click", () => openGallery(entry));
    entry.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openGallery(entry);
      }
    });
  });
}

function dateSortValue(str) {
  const d = parseFlexibleDate(str);
  return d ? d.getTime() : 0;
}

function sortByDateDesc(items) {
  return items.slice().sort((a, b) => dateSortValue(b.date) - dateSortValue(a.date));
}

function buildNewsEntryHTML(item) {
  const priority = isTrue(item.priority);
  const badge = priority
    ? '<span class="news-badge news-badge--priority">注目</span>'
    : '<span class="news-badge">NEWS</span>';
  const expiresAttr = item.expires ? ` data-expires="${escapeHTML(item.expires)}"` : "";
  const linkHTML = item.link
    ? `<a href="${escapeHTML(item.link)}" class="card-link" target="_blank" rel="noopener">詳しく見る →</a>`
    : "";
  return `<div class="report-entry${priority ? " report-entry--priority" : ""}"${expiresAttr}>
    <span class="report-date">${escapeHTML(item.date)}</span>
    ${badge}
    <h3>${escapeHTML(item.title)}</h3>
    <p>${nl2br(item.body)}</p>
    ${linkHTML}
  </div>`;
}

async function renderNews() {
  const homeList = document.querySelector("#news .report-list");
  const archiveList = document.getElementById("newsArchiveList");
  if (!homeList && !archiveList) return;
  const rows = await fetchRows(NEWS_CSV_URL);
  const items = (rows || []).filter((r) => r.title);
  if (items.length === 0) return;

  if (homeList) {
    const priorityItems = sortByDateDesc(items.filter((r) => isTrue(r.priority)));
    if (priorityItems.length > 0) {
      homeList.innerHTML = priorityItems.map(buildNewsEntryHTML).join("");
      applyExpiryBadges(homeList);
    }
  }
  if (archiveList) {
    archiveList.innerHTML = sortByDateDesc(items).map(buildNewsEntryHTML).join("");
    applyExpiryBadges(archiveList);
  }
}

function buildResearchEntryHTML(item) {
  const postedAttr = item.posted ? ` data-posted="${escapeHTML(item.posted)}"` : "";
  const pdfHTML = item.pdf
    ? `<a href="${escapeHTML(item.pdf)}" target="_blank" rel="noopener" class="card-link">📄 研究PDFを見る →</a>`
    : "";
  return `<div class="report-entry"${postedAttr}>
    <span class="report-date">${escapeHTML(item.date)}</span>
    <h3>${escapeHTML(item.title)}</h3>
    <p>研究者：${escapeHTML(item.researcher)}</p>
    ${pdfHTML}
  </div>`;
}

function buildReportEntryHTML(item) {
  if (item.category === "research") return buildResearchEntryHTML(item);
  const postedAttr = item.posted ? ` data-posted="${escapeHTML(item.posted)}"` : "";
  const images = (item.images || "")
    .split(",")
    .map((s) => driveImageURL(s))
    .filter(Boolean);
  const galleryAttr = images.length ? ` data-gallery="${escapeHTML(images.join(","))}"` : "";
  const galleryHint = images.length ? '<span class="card-link">📷 写真を見る</span>' : "";
  return `<div class="report-entry"${postedAttr}${galleryAttr}>
    <span class="report-date">${escapeHTML(item.date)}</span>
    <h3>${escapeHTML(item.title)}</h3>
    <p>${nl2br(item.body)}</p>
    ${galleryHint}
  </div>`;
}

async function renderReports() {
  const list = document.querySelector(".report-list[data-category]");
  if (!list) return;
  const category = list.dataset.category;
  const rows = await fetchRows(REPORTS_CSV_URL);
  const items = (rows || []).filter((r) => r.category === category && r.title);
  if (items.length === 0) return;
  const sorted = items.slice().sort((a, b) => dateSortValue(b.date) - dateSortValue(a.date));
  list.innerHTML = sorted.map(buildReportEntryHTML).join("");
  applyPostedBadges(list);
  initGalleryTriggers(list);
}

function buildScheduleRowHTML(item) {
  return `<tr>
    <td>${escapeHTML(item.date)}</td>
    <td>${escapeHTML(item.activity)}</td>
    <td>${escapeHTML(item.location)}</td>
    <td>${escapeHTML(item.fee)}</td>
    <td>${escapeHTML(item.details)}</td>
  </tr>`;
}

async function renderSchedule() {
  const tbody = document.querySelector(".schedule-table tbody");
  if (!tbody) return;
  const rows = await fetchRows(SCHEDULE_CSV_URL);
  const items = (rows || []).filter((r) => r.date || r.activity);
  if (items.length === 0) return;
  tbody.innerHTML = items.map(buildScheduleRowHTML).join("");
}

applySiteContent();
renderNews();
renderReports();
renderSchedule();

const navToggle = document.getElementById("navToggle");
const nav = document.getElementById("nav");

navToggle.addEventListener("click", () => {
  nav.classList.toggle("open");
});

nav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    nav.classList.remove("open");
  });
});

const heroSlides = document.querySelectorAll(".hero-slide");

if (heroSlides.length > 1) {
  let currentSlide = 0;
  setInterval(() => {
    heroSlides[currentSlide].classList.remove("is-active");
    currentSlide = (currentSlide + 1) % heroSlides.length;
    heroSlides[currentSlide].classList.add("is-active");
  }, 5000);
}

initGalleryTriggers(document);
applyExpiryBadges(document);
applyPostedBadges(document);
