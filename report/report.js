// ===============================
// TSC Survey Report - report.js
// OPTION ③: Horizontal bars (indexAxis:'y')
// CSV columns:
// timestamp,language,player_name,Q2_time,Q3_time,Q4_day
// ===============================

const CSV_URL = new URL("../data/survey.csv", location.href).toString();
let charts = [];

const Q2_TIME_LABELS = {
  A: "A. Server Time 04:00 - 05:00",
  B: "B. Server Time 13:00 - 14:00",
  C: "C. Server Time 21:00 - 22:00",
  D: "D. Anytime",
};

const Q3_TIME_LABELS = {
  A: "A. Server Time around 04:00 - 05:00",
  B: "B. Server Time around 13:00 - 14:00",
  C: "C. Server Time around 21:00 - 22:00",
  D: "D. Anytime",
  E: "E. N/A",
};

const Q4_DAY_LABELS = {
  A: "A. Monday",
  B: "B. Tuesday",
  C: "C. Wednesday",
  D: "D. Thursday",
  E: "E. Friday",
  F: "F. Saturday",
  G: "G. Sunday",
  H: "H. Any day",
};

const LANGUAGE_LABELS = {
  "en": "English",
  "de": "Deutsch",
  "nl": "Nederlands",
  "fr": "Français",
  "ru": "Русский",
  "es": "Español",
  "pt": "Português",
  "it": "Italiano",
  "zh-hans": "简体中文",
  "ja": "日本語",
  "ko": "한국어",
  "zh-hant": "繁體中文",
  "ar": "العربية",
  "th": "ไทย",
  "vi": "Tiếng Việt",
  "tr": "Türkçe",
  "pl": "Polski",
  "ms": "Bahasa Melayu",
  "id": "Bahasa Indonesia",
};

const LANGUAGE_ORDER = [
  "en","de","nl","fr","ru","es","pt","it","zh-hans","ja","ko","zh-hant","ar","th","vi","tr","pl","ms","id"
];

const elLastUpdated = document.getElementById("lastUpdated");
const elRespondentCount = document.getElementById("respondentCount");
const elBtnRefresh = document.getElementById("btnRefresh");

const tblRespondentsBody = document.querySelector("#tblRespondents tbody");
const tblQ2FirstBody = document.querySelector("#tblQ2First tbody");
const tblQ3TimeBody  = document.querySelector("#tblQ3Time tbody");
const tblQ4DayBody   = document.querySelector("#tblQ4Day tbody");
const tblLangBody    = document.querySelector("#tblLang tbody");

const elQ2FirstTotal = document.getElementById("q2FirstTotal");
const elQ3TimeTotal  = document.getElementById("q3TimeTotal");
const elQ4DayTotal   = document.getElementById("q4DayTotal");
const elLangTotal    = document.getElementById("langTotal");

function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}
function safeTrim(s){ return String(s ?? "").trim(); }
function parseTimestamp(ts){
  const t = Date.parse(ts);
  return Number.isFinite(t) ? t : 0;
}

// ★ ドット前(または先頭の英字)を抽出して A/B/C... に統一
function extractLeadingLetter(value){
  const s = safeTrim(value);
  if (!s) return "";
  const m = s.match(/^([A-Za-z])(?:[\.\s]|$)/);
  return m ? m[1].toUpperCase() : "";
}
function displayAnswerCode(value){
  const code = extractLeadingLetter(value);
  return code || "-";
}

function canonicalizeAnswer(value, labelMap){
  const s = safeTrim(value);
  if (!s) return "";
  const letter = extractLeadingLetter(s);
  if (letter && labelMap[letter]) return labelMap[letter];

  const normalized = s.replace(/\s+/g, " ").trim();
  const mapValues = Object.values(labelMap);
  const found = mapValues.find(v => v.replace(/\s+/g, " ").trim() === normalized);
  if (found) return found;

  return normalized;
}

function langDisplay(langCodeRaw){
  const code = safeTrim(langCodeRaw).toLowerCase();
  const label = LANGUAGE_LABELS[code] || (code ? code : "—");
  return { code: code || "—", label };
}

function parseCSV(text){
  const rows = [];
  let row = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  while (i < text.length){
    const c = text[i];

    if (inQuotes){
      if (c === '"'){
        const next = text[i+1];
        if (next === '"'){
          field += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        field += c;
        i++;
        continue;
      }
    } else {
      if (c === '"'){ inQuotes = true; i++; continue; }
      if (c === ","){ row.push(field); field=""; i++; continue; }
      if (c === "\r"){ i++; continue; }
      if (c === "\n"){ row.push(field); field=""; rows.push(row); row=[]; i++; continue; }
      field += c; i++;
    }
  }
  row.push(field);
  rows.push(row);

  while (rows.length && rows[rows.length-1].every(x => safeTrim(x) === "")) rows.pop();
  if (!rows.length) return [];

  const headers = rows[0].map(h => safeTrim(h));
  const data = [];
  for (let r=1; r<rows.length; r++){
    const cols = rows[r];
    if (cols.every(x => safeTrim(x) === "")) continue;
    const obj = {};
    for (let c=0; c<headers.length; c++){
      obj[headers[c]] = cols[c] ?? "";
    }
    data.push(obj);
  }
  return data;
}

function destroyCharts(){
  charts.forEach(c => c.destroy());
  charts = [];
}

// ===== OPTION ③: Horizontal bar =====
function makeBar(canvasId, labels, values){
  const ctx = document.getElementById(canvasId);
  const c = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ label: "Total", data: values }] },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0 } },
        y: { ticks: { autoSkip: false } }
      }
    }
  });
  charts.push(c);
  return c;
}

function fillRespondents(respondents){
  tblRespondentsBody.innerHTML = "";
  respondents.forEach((r, idx) => {
    const { code, label } = langDisplay(r.language);

    const q2Code = displayAnswerCode(r.Q2_time);
    const q3Code = displayAnswerCode(r.Q3_time);
    const q4Code = displayAnswerCode(r.Q4_day);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="num">${idx + 1}</td>
      <td>${escapeHtml(r.player_name)}</td>
      <td class="num" title="${escapeHtml(label)}">${escapeHtml(code)}</td>

      <td class="num" title="${escapeHtml(safeTrim(r.Q2_time) || "-")}">${escapeHtml(q2Code)}</td>
      <td class="num" title="${escapeHtml(safeTrim(r.Q3_time) || "-")}">${escapeHtml(q3Code)}</td>
      <td class="num" title="${escapeHtml(safeTrim(r.Q4_day) || "-")}">${escapeHtml(q4Code)}</td>
    `;
    tblRespondentsBody.appendChild(tr);
  });
  elRespondentCount.textContent = String(respondents.length);
}

function fillTableGeneric(tbodyEl, rows, totalEl){
  tbodyEl.innerHTML = "";
  let total = 0;
  rows.forEach(([k,v]) => {
    total += Number(v || 0);
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${escapeHtml(k)}</td><td class="num">${v}</td>`;
    tbodyEl.appendChild(tr);
  });
  totalEl.textContent = String(total);
}

function setUpdatedByLatestTimestamp(latestTs){
  if (!latestTs){
    elLastUpdated.textContent = "Last updated: –";
    return;
  }
  elLastUpdated.textContent = "Last updated: " + new Date(latestTs).toLocaleString();
}

async function loadCSV(){
  const url = CSV_URL + (CSV_URL.includes("?") ? "&" : "?") + "t=" + Date.now();
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV fetch failed: ${res.status} ${res.statusText}`);
  const text = await res.text();
  const rows = parseCSV(text);

  const required = ["timestamp","language","player_name","Q2_time","Q3_time","Q4_day"];
  const missing = required.filter(k => !(k in (rows[0] || {})));
  if (missing.length) throw new Error("CSV header missing: " + missing.join(", "));
  return rows;
}

function dedupeLatestByPlayer(rows){
  const map = new Map();
  for (const r of rows){
    const name = safeTrim(r.player_name);
    if (!name) continue;
    const ts = parseTimestamp(r.timestamp);
    const prev = map.get(name);
    if (!prev || ts > prev._ts || (ts === prev._ts && prev._seq < r._seq)){
      map.set(name, {
        timestamp: safeTrim(r.timestamp),
        language: safeTrim(r.language),
        player_name: name,
        Q2_time: safeTrim(r.Q2_time),
        Q3_time: safeTrim(r.Q3_time),
        Q4_day: safeTrim(r.Q4_day),
        _ts: ts,
        _seq: r._seq,
      });
    }
  }
  const arr = Array.from(map.values());
  arr.sort((a,b) => (a._ts - b._ts) || (a._seq - b._seq));
  return arr;
}

function countByLabel(items, labelMap, optionsOrder){
  const counts = new Map();
  for (const it of items){
    const canon = canonicalizeAnswer(it, labelMap);
    if (!canon) continue;
    counts.set(canon, (counts.get(canon) || 0) + 1);
  }
  const orderedLabels = optionsOrder.map(k => labelMap[k]).filter(Boolean);
  const out = orderedLabels.map(lbl => [lbl, counts.get(lbl) || 0]);

  let otherCount = 0;
  for (const [k,v] of counts.entries()){
    if (!orderedLabels.includes(k)) otherCount += v;
  }
  if (otherCount > 0) out.push(["Other", otherCount]);
  return out;
}

function countLanguages(respondents){
  const counts = new Map();
  for (const r of respondents){
    const code = safeTrim(r.language).toLowerCase();
    if (!code) continue;
    counts.set(code, (counts.get(code) || 0) + 1);
  }
  const out = [];
  for (const code of LANGUAGE_ORDER){
    const n = counts.get(code) || 0;
    const label = LANGUAGE_LABELS[code] || code;
    out.push([`${code} ${label}`, n]);
  }
  const others = [];
  for (const [code,n] of counts.entries()){
    if (!LANGUAGE_ORDER.includes(code)){
      const label = LANGUAGE_LABELS[code] || code;
      others.push([`${code} ${label}`, n]);
    }
  }
  others.sort((a,b) => b[1]-a[1]);
  out.push(...others);
  return out;
}

function renderReport(respondents){
  destroyCharts();

  const latest = respondents.reduce((m,r) => Math.max(m, r._ts || 0), 0);
  setUpdatedByLatestTimestamp(latest);

  fillRespondents(respondents);

  const q2Rows = countByLabel(respondents.map(r=>r.Q2_time), Q2_TIME_LABELS, ["A","B","C","D"]);
  fillTableGeneric(tblQ2FirstBody, q2Rows, elQ2FirstTotal);
  makeBar("chartQ2First", q2Rows.map(x=>x[0]), q2Rows.map(x=>x[1]));

  const q3Rows = countByLabel(respondents.map(r=>r.Q3_time), Q3_TIME_LABELS, ["A","B","C","D","E"]);
  fillTableGeneric(tblQ3TimeBody, q3Rows, elQ3TimeTotal);
  makeBar("chartQ3Time", q3Rows.map(x=>x[0]), q3Rows.map(x=>x[1]));

  const q4Rows = countByLabel(respondents.map(r=>r.Q4_day), Q4_DAY_LABELS, ["A","B","C","D","E","F","G","H"]);
  fillTableGeneric(tblQ4DayBody, q4Rows, elQ4DayTotal);
  makeBar("chartQ4Day", q4Rows.map(x=>x[0]), q4Rows.map(x=>x[1]));

  const langRows = countLanguages(respondents);
  fillTableGeneric(tblLangBody, langRows, elLangTotal);
  makeBar("chartLang", langRows.map(x=>x[0]), langRows.map(x=>x[1]));
}

function setButtonBusy(isBusy){
  if (!elBtnRefresh) return;
  elBtnRefresh.disabled = isBusy;
  elBtnRefresh.textContent = isBusy ? "Loading..." : "Refresh";
}

async function refresh(){
  try{
    setButtonBusy(true);
    const rows = await loadCSV();
    rows.forEach((r, idx) => { r._seq = idx; });
    const respondents = dedupeLatestByPlayer(rows);
    renderReport(respondents);
  }catch(err){
    console.error(err);
    destroyCharts();
    elLastUpdated.textContent = "Error: " + (err?.message || String(err));

    tblRespondentsBody.innerHTML = "";
    tblQ2FirstBody.innerHTML = "";
    tblQ3TimeBody.innerHTML = "";
    tblQ4DayBody.innerHTML = "";
    tblLangBody.innerHTML = "";

    elRespondentCount.textContent = "0";
    elQ2FirstTotal.textContent = "0";
    elQ3TimeTotal.textContent  = "0";
    elQ4DayTotal.textContent   = "0";
    elLangTotal.textContent    = "0";
  }finally{
    setButtonBusy(false);
  }
}

if (elBtnRefresh) elBtnRefresh.addEventListener("click", refresh);
refresh();
