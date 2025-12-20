// =====================
// /functions/api/submit.js (FULL REPLACE)  [ARY VERSION]
// =====================

const FIXED_OWNER = "aoz-jcf-1165";
const FIXED_REPO  = "Ary-event-survey-web-2025.12";
const SURVEY_LABEL = "survey";

export async function onRequestOptions({ request }) {
  // CORS preflight
  return json(204, null, corsHeaders());
}

export async function onRequestGet({ request }) {
  // ルート存在確認用（ブラウザで開くとここに来る）
  const ray = request.headers.get("cf-ray") || "";
  const requestId = crypto.randomUUID();
  const now = new Date().toISOString();

  return json(
    405,
    {
      ok: false,
      error: "Use POST only.",
      hint: {
        url: "/api/submit",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body_example: {
          language: "en",
          player_name: "YourName",
          Q2_time: "A",
          Q3_time: "B",
          Q4_day: "H",
        },
      },
      time: now,
      requestId,
      ray,
    },
    corsHeaders()
  );
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const ray = request.headers.get("cf-ray") || "";
  const requestId = crypto.randomUUID();
  const now = new Date().toISOString();

  const token = (env?.GITHUB_TOKEN || "").trim();
  if (!token) {
    return json(
      500,
      {
        ok: false,
        message: "Missing GITHUB_TOKEN in Pages project variables (secret).",
        time: now,
        requestId,
        ray,
      },
      corsHeaders()
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json(
      400,
      { ok: false, message: "Invalid JSON body.", time: now, requestId, ray },
      corsHeaders()
    );
  }

  const body = normalizePayload(payload);

  const missing = [];
  if (!body.player_name) missing.push("player_name");
  if (!body.language) missing.push("language");
  if (!body.Q2_time) missing.push("Q2_time");
  if (!body.Q3_time) missing.push("Q3_time");
  if (!body.Q4_day) missing.push("Q4_day");

  if (missing.length) {
    return json(
      400,
      { ok: false, missing, time: now, requestId, ray },
      corsHeaders()
    );
  }

  const issueTitle = `Survey Response: ${body.player_name}`;
  const issueBodyJson = {
    timestamp: now,
    ...body,
    source: "pages_function",
    requestId,
    ray,
  };

  const issueBodyText =
    `<!-- survey_response -->\n\n` +
    "```json\n" +
    JSON.stringify(issueBodyJson, null, 2) +
    "\n```\n";

  try {
    const created = await createIssue({
      token,
      owner: FIXED_OWNER,
      repo: FIXED_REPO,
      title: issueTitle,
      body: issueBodyText,
      labels: [SURVEY_LABEL],
    });

    return json(
      200,
      {
        ok: true,
        message: "Submitted.",
        time: now,
        requestId,
        ray,
        issue: { number: created.number, url: created.html_url },
      },
      corsHeaders()
    );
  } catch (err) {
    const msg = String(err?.message || err || "Unknown error");
    const status = err?.status || 502;

    return json(
      status,
      { ok: false, message: "Server error.", detail: msg, time: now, requestId, ray },
      corsHeaders()
    );
  }
}

function normalizePayload(p) {
  const obj = (p && typeof p === "object") ? p : {};
  return {
    language: safeStr(obj.language),
    player_name: safeStr(obj.player_name),
    Q2_time: safeStr(obj.Q2_time),
    Q3_time: safeStr(obj.Q3_time),
    Q4_day: safeStr(obj.Q4_day),
  };
}

function safeStr(v) {
  if (v == null) return "";
  return String(v).trim();
}

async function createIssue({ token, owner, repo, title, body, labels }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/issues`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "survey-pages-function",
    },
    body: JSON.stringify({
      title,
      body,
      labels: Array.isArray(labels) ? labels : undefined,
    }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const e = new Error(
      `GitHub API error: ${res.status} ${res.statusText} ` +
      (data?.message ? `- ${data.message}` : "")
    );
    e.status = res.status;
    throw e;
  }

  return data;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(status, data, extraHeaders = {}) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
  };
  return new Response(data == null ? null : JSON.stringify(data, null, 2), { status, headers });
}
