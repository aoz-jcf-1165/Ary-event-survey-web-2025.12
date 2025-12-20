// =====================
// /functions/api/health.js (FULL REPLACE)
// =====================
export async function onRequest(context) {
  const { request, env } = context;

  const now = new Date().toISOString();
  const ray = request.headers.get("cf-ray") || "";
  const method = request.method;
  const url = new URL(request.url);

  // Secrets/Vars existence check
  const hasToken = !!(env && env.GITHUB_TOKEN && String(env.GITHUB_TOKEN).trim().length > 0);

  // Optional vars (we will also support hardcoded fallback in submit.js)
  const hasOwner = !!(env && env.GITHUB_OWNER && String(env.GITHUB_OWNER).trim().length > 0);
  const hasRepo = !!(env && env.GITHUB_REPO && String(env.GITHUB_REPO).trim().length > 0);

  return json(200, {
    ok: true,
    message: "Pages Functions is alive",
    method,
    path: url.pathname,
    hasToken,
    hasOwner,
    hasRepo,
    time: now,
    ray,
    colo: request.cf?.colo || "",
    country: request.cf?.country || "",
  });
}

function json(status, data, extraHeaders = {}) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
  };
  return new Response(data == null ? null : JSON.stringify(data, null, 2), { status, headers });
}
