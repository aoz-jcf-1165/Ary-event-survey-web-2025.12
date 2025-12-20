// =====================
// survey.js (ARY / FULL REPLACE)
// =====================

// ==== Cloudflare Pages Functions API エンドポイント ====
// 同一ドメイン: /api/submit
const API_URL = "/api/submit";

// ==== 多言語翻訳設定 ====
const TRANSLATION_FILE = "translations.tsv";

// ===== CDN PDF link =====
// ※ PDFカードをコメントアウトしていても、リンク処理は残しておいてOK
const CDN_PDF_URL =
  "https://cdn.jsdelivr.net/gh/aoz-jcf-1165/Ary-event-survey-web-2025.12@main/share_document/Ary-event-survey-2025-12.pdf";

const LANGUAGE_LABELS = {
  "en": "English",
  "de": "Deutsch",
  "nl": "Nederlands",
  "fr": "Français",
  "ru": "Русский",
  "es": "Español",
  "pt": "Português",
  "it": "Italiano",
  "zh-Hans": "简体中文",
  "ja": "日本語",
  "ko": "한국어",
  "zh-Hant": "繁體中文",
  "ar": "العربية",
  "th": "ไทย",
  "vi": "Tiếng Việt",
  "tr": "Türkçe",
  "pl": "Polski",
  "ms": "Bahasa Melayu",
  "id": "Bahasa Indonesia"
};

let translations = {};
let availableLangs = [];

// ★ 言語は localStorage を優先（無ければ en）
let currentLang = (localStorage.getItem("ary_lang") || "en").trim() || "en";

// ★ 翻訳ロード完了フラグ（未完了なら送信禁止）
let isAppReady = false;

function parseTSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
  if (lines.length < 2) return;

  const headerCols = lines[0].split("\t");
  const langs = headerCols.slice(1);
  availableLangs = langs;

  const data = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    const key = cols[0];
    if (!key) continue;
    data[key] = {};
    langs.forEach((lang, idx) => {
      data[key][lang] = cols[idx + 1] || "";
    });
  }
  translations = data;
}

function t(key) {
  const entry = translations[key];
  if (!entry) return null;
  return entry[currentLang] || entry["en"] || null;
}

function applyLanguage(lang) {
  currentLang = (lang || "en").toString().trim() || "en";
  localStorage.setItem("ary_lang", currentLang);

  document.documentElement.lang = currentLang;
  document.documentElement.dir = (currentLang === "ar") ? "rtl" : "ltr";

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    const translated = t(key);
    if (translated != null) el.textContent = translated;
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    const translated = t(key);
    if (translated != null) el.placeholder = translated;
  });
}

function populateLanguageSelect() {
  const select = document.getElementById("languageSelect");
  if (!select) return;

  select.innerHTML = "";

  // ordered: en first
  const ordered = ["en", ...availableLangs.filter(l => l !== "en")];

  // currentLang が TSV に存在しない場合は en に戻す
  if (!availableLangs.includes(currentLang)) currentLang = "en";

  ordered.forEach(code => {
    if (!availableLangs.includes(code)) return;
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = LANGUAGE_LABELS[code] || code;
    if (code === currentLang) opt.selected = true;
    select.appendChild(opt);
  });

  select.addEventListener("change", () => applyLanguage(select.value));
}

function wireCdnLink() {
  const a = document.getElementById("cdnPdfLink");
  if (a) a.href = CDN_PDF_URL;
}

function setSubmitEnabled(enabled) {
  const btn = document.getElementById("submitBtn");
  if (btn) btn.disabled = !enabled;
}

async function loadTranslations() {
  try {
    wireCdnLink();

    const res = await fetch(TRANSLATION_FILE, { cache: "no-store" });
    if (!res.ok) {
      console.error("Failed to load translations.tsv");
      setSubmitEnabled(false);
      return;
    }

    const text = await res.text();
    parseTSV(text);
    populateLanguageSelect();
    applyLanguage(currentLang);

    isAppReady = true;
    setSubmitEnabled(true);
  } catch (e) {
    console.error("Error loading translations:", e);
    setSubmitEnabled(false);
  }
}

function scrollToBottomSmooth() {
  requestAnimationFrame(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  });
}

function getRadioValue(name) {
  const node = document.querySelector(`input[name="${name}"]:checked`);
  return node ? node.value : "";
}

function setError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  if (msg) {
    el.textContent = msg;
    el.style.display = "block";
  } else {
    el.textContent = "";
    el.style.display = "none";
  }
}

function setFormDisabled(disabled) {
  const form = document.getElementById("surveyForm");
  if (!form) return;
  Array.from(form.elements).forEach(el => {
    if (["BUTTON","INPUT","SELECT","TEXTAREA"].includes(el.tagName)) el.disabled = disabled;
  });
}

function encodeCsvRow(rowObj) {
  const headers = ["timestamp", "language", "player_name", "Q2_time", "Q3_time", "Q4_day"];
  return headers.map(h => {
    const v = rowObj[h] ?? "";
    if (/[",]/.test(v)) return `"${String(v).replace(/"/g, '""')}"`;
    return v;
  }).join(",");
}

function getSelectedLanguageSafe() {
  const sel = document.getElementById("languageSelect");
  const v = (sel && sel.value) ? sel.value : currentLang;
  return (v || "en").toString().trim() || "en";
}

async function readResponseSafe(res) {
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("application/json")) {
    try { return await res.json(); } catch { return null; }
  }
  try { return await res.text(); } catch { return null; }
}

async function handleSubmit(e) {
  e.preventDefault();

  // ★ 翻訳ロード前は送信禁止（language事故の根絶）
  if (!isAppReady) {
    setError("form-error", "Loading languages... Please wait a moment and try again.");
    return;
  }

  scrollToBottomSmooth();

  setError("form-error", "");
  setError("error-playerName", "");
  setError("error-q02", "");
  setError("error-q03", "");
  setError("error-q04", "");

  const playerName = document.getElementById("playerName")?.value?.trim() || "";
  const q02 = getRadioValue("q02");
  const q03 = getRadioValue("q03");
  const q04 = getRadioValue("q04");

  let hasError = false;
  if (!playerName) { setError("error-playerName", "Required / 必須です"); hasError = true; }
  if (!q02) { setError("error-q02", "Please select one option."); hasError = true; }
  if (!q03) { setError("error-q03", "Please select one option."); hasError = true; }
  if (!q04) { setError("error-q04", "Please select one option."); hasError = true; }
  if (hasError) return;

  const timestamp = new Date().toISOString();

  // ★ language は currentLang ではなく select から必ず取る（ズレを潰す）
  const language = getSelectedLanguageSafe();
  applyLanguage(language);

  const row = {
    timestamp,
    language,
    player_name: playerName,
    Q2_time: q02,
    Q3_time: q03,
    Q4_day: q04
  };

  // 任意：デバッグ用CSV行（HTMLに無くてもOK）
  const csvRow = encodeCsvRow(row);
  const output = document.getElementById("csvOutput");
  if (output) output.value = csvRow;

  setFormDisabled(true);

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row)
    });

    if (!res.ok) {
      const detail = await readResponseSafe(res);
      console.error("API error:", res.status, detail);

      // Functions 側が {stage, githubStatus, githubBody} を返すので見える化
      if (detail && typeof detail === "object") {
        const msg =
          `Server error (${res.status}). ` +
          (detail.stage ? `[${detail.stage}] ` : "") +
          (detail.githubStatus ? `GitHub:${detail.githubStatus} ` : "") +
          (detail.error ? `- ${detail.error}` : "");
        setError("form-error", msg.trim());
      } else {
        setError("form-error", `Server error (${res.status}). Please try again later.`);
      }

      setFormDisabled(false);
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (!data.ok) {
      setError("form-error", "API error. Please try again.");
      setFormDisabled(false);
      return;
    }

    const resultBox = document.getElementById("result");
    if (resultBox) resultBox.style.display = "block";

    scrollToBottomSmooth();
    document.getElementById("surveyForm")?.reset();

  } catch (err) {
    console.error("Network error:", err);
    setError("form-error", "Network error. Please try again.");
  } finally {
    setFormDisabled(false);
    setSubmitEnabled(true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("surveyForm");
  if (form) form.addEventListener("submit", handleSubmit);

  setSubmitEnabled(false);
  loadTranslations();
  wireCdnLink();
});
