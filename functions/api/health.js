// /functions/api/health.js
// =========================================================
// Health endpoint: GET /api/health
// - Returns ok:true so you can verify Pages Functions is alive
// - Also indicates whether required env vars exist (hasToken etc.)
// =========================================================

function json(obj) {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export async function onRequestGet({ request, env }) {
  return json({
    ok: true,
    message: "Pages Functions is alive (Ary)",
    method: request.method,
    path: new URL(request.url).pathname,
    hasToken: !!(env.GITHUB_TOKEN && String(env.GITHUB_TOKEN).trim()),
    hasOwner: !!(env.GITHUB_OWNER && String(env.GITHUB_OWNER).trim()),
    hasRepo: !!(env.GITHUB_REPO && String(env.GITHUB_REPO).trim()),
    time: new Date().toISOString(),
  });
}
