// =====================
// /functions/api/submit.js (ARY / FULL)
// =====================
export async function onRequest(context) {
  const { request, env } = context;

  const ray = request.headers.get("cf-ray") || "";
  const requestId = crypto.randomUUID();
  const now = new Date().toISOString();

  // --- CORS / preflight ---
  if (request.method === "OPTIONS") {
    return json(204, null, corsHeaders());
  }

  // --- POST only ---
  if (request.method !== "POST") {
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
            player_name: "TEST",
            Q2_time: "A",
            Q3_time: "B",
            Q4_day: "C",
          },
        },
        requestId,
        time: now,
        ray,
      },
      { ...corsHeaders(), "Cache-Control": "no-store" }
    );
  }

  // --- ENV ---
  const token = (env.GITHUB_TOKEN || "").trim();
  const owner = (env.GITHUB_OWNER || "aoz-jcf-1165").trim();
  // ★ Ary repo 名を既定に（必要なら Pages の env で上書き）
  const repo  = (env.GITHUB_REPO  || "Ary-event-survey-web-2025.12").trim();

  if (!token) {
    return json(
      500,
      {
        ok: false,
        error: "Missing GITHUB_TOKEN in Pages project variables (secret).",
        requestId,
        time: now,
        ray,
      },
      { ...corsHeaders(), "Cache-Control": "no-store" }
    );
  }

  // --- Read JSON ---
  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return json(
      400,
      {
        ok: false,
        error: "Invalid JSON body.",
        detail: safeErr(e),
        requestId,
        time: now,
        ray,
      },
      { ...corsHeaders(), "Cache-Control": "no-store" }
    );
  }

  // --- Validate ---
  const language = str(payload.language);
  const player_name = str(payload.player_name);
  const Q2_time = str(payload.Q2_time);
  const Q3_time = str(payload.Q3_time);
  const Q4_day = str(payload.Q4_day);

  const missing = [];
  if (!player_name) missing.push("player_name");
  if (!language) missing.push("language");
  if (!Q2_time) missing.push("Q2_time");
  if (!Q3_time) missing.push("Q3_time");
  if (!Q4_day) missing.push("Q4_day");

  if (missing.length) {
    return json(
      400,
      {
        ok: false,
        error: "Missing required fields.",
        missing,
        received: { language, player_name, Q2_time, Q3_time, Q4_day },
        requestId,
        time: now,
        ray,
      },
      { ...corsHeaders(), "Cache-Control": "no-store" }
    );
  }

  // --- Prepare Issue ---
  const stamp = now;
  const issueTitle = `survey:${player_name}`;
  const issueBody = [
    `timestamp: ${stamp}`,
    `language: ${language}`,
    `player_name: ${player_name}`,
    `Q2_time: ${Q2_time}`,
    `Q3_time: ${Q3_time}`,
    `Q4_day: ${Q4_day}`,
    "",
    "```json",
    JSON.stringify({ timestamp: stamp, language, player_name, Q2_time, Q3_time, Q4_day }, null, 2),
    "```",
  ].join("\n");

  const ghUrl = `https://api.github.com/repos/${owner}/${repo}/issues`;

  // --- GitHub request with timeout ---
  const controller = new AbortController();
  const timeoutMs = 15000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let ghRes, ghText;
  try {
    ghRes = await fetch(ghUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "cf-pages-functions-survey",
      },
      body: JSON.stringify({
        title: issueTitle,
        body: issueBody,
        labels: ["survey"],
      }),
    });

    ghText = await ghRes.text();
  } catch (e) {
    clearTimeout(timer);
    return json(
      503,
      {
        ok: false,
        stage: "fetch_github",
        error: "Upstream request failed (fetch/GitHub).",
        detail: safeErr(e),
        timeoutMs,
        ghUrl,
        requestId,
        time: now,
        ray,
      },
      { ...corsHeaders(), "Cache-Control": "no-store" }
    );
  } finally {
    clearTimeout(timer);
  }

  if (!ghRes.ok) {
    return json(
      502,
      {
        ok: false,
        stage: "github_non_2xx",
        error: "GitHub API returned error.",
        githubStatus: ghRes.status,
        githubStatusText: ghRes.statusText,
        githubBody: limitText(ghText, 4000),
        hint: [
          "1) PagesのGITHUB_TOKENが repo / issues 作成権限を持つか確認",
          "2) owner/repo 名が正しいか確認（Ary repo名）",
          "3) GitHub側のレート制限・障害の可能性",
        ],
        requestId,
        time: now,
        ray,
      },
      { ...corsHeaders(), "Cache-Control": "no-store" }
    );
  }

  let ghJson = null;
  try { ghJson = JSON.parse(ghText); } catch (_) {}

  return json(
    200,
    {
      ok: true,
      message: "Submitted.",
      requestId,
      time: now,
      ray,
      issue: ghJson ? { number: ghJson.number, url: ghJson.html_url } : null,
    },
    { ...corsHeaders(), "Cache-Control": "no-store" }
  );
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(status, obj, headers = {}) {
  // 204の時はbody無し
  if (status === 204) return new Response(null, { status, headers });

  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

function str(v) {
  return (v == null ? "" : String(v)).trim();
}

function safeErr(e) {
  if (!e) return null;
  return { name: e.name, message: e.message };
}

function limitText(s, max = 2000) {
  const t = (s == null ? "" : String(s));
  if (t.length <= max) return t;
  return t.slice(0, max) + ` ...[truncated ${t.length - max} chars]`;
}
