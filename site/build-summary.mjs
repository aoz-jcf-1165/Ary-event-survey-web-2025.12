import fs from "node:fs";
import path from "node:path";

const input = "data/answers.csv";
const outDir = "site/out";
const outFile = path.join(outDir, "summary.json");

if (!fs.existsSync(input)) {
  console.log("No data/answers.csv");
  process.exit(0);
}

const raw = fs.readFileSync(input, "utf8").trim();
if (!raw) process.exit(0);

const lines = raw.split(/\r?\n/).filter(Boolean);
if (lines.length <= 1) process.exit(0);

const header = parseCsvLine(lines[0]);
const rows = lines.slice(1).map(line => toObj(parseCsvLine(line), header));

/** Sort newest first by ISO timestamp (fallback to empty) */
rows.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));

/** Latest-by-player */
const latestMap = new Map();
for (const r of rows) {
  const pn = (r.player_name || "").trim();
  if (!pn) continue;
  if (!latestMap.has(pn)) latestMap.set(pn, r);
}
const latest = [...latestMap.values()];

const countBy = (arr, key) => {
  const m = {};
  for (const r of arr) {
    const v = (r[key] || "").trim();
    if (!v) continue;
    m[v] = (m[v] || 0) + 1;
  }
  return m;
};

const summary = {
  generated_at: new Date().toISOString(),
  total_rows: rows.length,
  unique_players: latest.length,
  latest_by_player: latest,
  counts: {
    Q2_time:  countBy(latest, "Q2_time"),
    Q3_time:  countBy(latest, "Q3_time"),
    Q4_day:   countBy(latest, "Q4_day"),
    language: countBy(latest, "language"),
  },
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(summary, null, 2), "utf8");
console.log("Wrote:", outFile);

function toObj(cols, header) {
  const obj = {};
  for (let i = 0; i < header.length; i++) obj[header[i]] = (cols[i] ?? "");
  return obj;
}

/**
 * CSV line parser (quotes supported)
 * - Handles commas inside quotes
 * - Handles escaped quotes ("")
 */
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQ = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}
