// ============================================================================
// BiblioTech Scout — Cloudflare Worker v2.0 (Telemetría, Moderación y La Fogata)
// - Worker en Cloudflare: bibliotech-telemetry
// - Binding KV: FORUM_KV -> bibliotech_fogata_kv
// - Opcional para moderación remota: Variable secreta ADMIN_TOKEN
// - Observabilidad: Workers Logs + Traces habilitados
// ============================================================================

const WORKER_VERSION = "2.0";
const FORUM_CACHE_KEY = "https://bibliotech-forum-cache.internal/v1/posts.json";
const KV_POSTS_KEY = "fogata_posts_v1";
const KV_DELETED_KEY = "fogata_deleted_v1";
const KV_REPORTS_KEY = "fogata_reports_v1";
const KV_AUDIT_KEY = "fogata_audit_v1";
const KV_QUESTIONS_KEY = "bt_questions_log_v1";
const KV_BUGS_KEY = "bt_bugs_log_v1";
const MAX_BODY_BYTES = 48 * 1024;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_WRITES = 12;
const ipWriteBuckets = new Map();

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, X-Admin-Token",
  "X-Content-Type-Options": "nosniff",
};

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

async function hashShort(input) {
  if (!input) return "";
  try {
    const data = new TextEncoder().encode(`bt-v2:${input}`);
    const digest = await crypto.subtle.digest("SHA-256", data);
    const bytes = new Uint8Array(digest);
    let hex = "";
    for (let i = 0; i < 6; i++) {
      hex += bytes[i].toString(16).padStart(2, "0");
    }
    return hex;
  } catch (_) {
    return "";
  }
}

function timingSafeMatch(a, b) {
  if (!a || !b || typeof a !== "string" || typeof b !== "string") return false;
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  if (ba.byteLength !== bb.byteLength) return false;
  try {
    return crypto.subtle.timingSafeEqual(ba, bb);
  } catch (_) {
    let diff = 0;
    for (let i = 0; i < ba.length; i++) diff |= ba[i] ^ bb[i];
    return diff === 0;
  }
}

function checkRateLimit(ip, actionType) {
  if (!ip || actionType === "foro_like") return true;
  const now = Date.now();
  const prev = ipWriteBuckets.get(ip) || [];
  const recent = prev.filter((ts) => now - ts < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX_WRITES) {
    ipWriteBuckets.set(ip, recent);
    return false;
  }
  recent.push(now);
  ipWriteBuckets.set(ip, recent);
  if (ipWriteBuckets.size > 500) {
    for (const [k, arr] of ipWriteBuckets.entries()) {
      if (!arr.length || now - arr[arr.length - 1] > RATE_WINDOW_MS) {
        ipWriteBuckets.delete(k);
      }
    }
  }
  return true;
}

function sanitizePublicPost(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    id: String(raw.id || "").slice(0, 64),
    channel: raw.channel === "adultos" ? "adultos" : "jovenes",
    visibility: ["full", "group_only", "anonymous"].includes(raw.visibility) ? raw.visibility : "full",
    role: String(raw.role || "Miembro Scout").slice(0, 60),
    group: raw.visibility === "anonymous" ? "" : String(raw.group || "").slice(0, 50),
    province: raw.visibility === "anonymous" ? "" : String(raw.province || "").slice(0, 60),
    author: String(raw.author || "Scout").slice(0, 60),
    displaySub: String(raw.displaySub || "").slice(0, 120),
    initials: String(raw.initials || "SC").slice(0, 4),
    authorId: String(raw.authorId || "remote").slice(0, 40),
    title: String(raw.title || "").slice(0, 140),
    body: String(raw.body || "").slice(0, 1800),
    tags: Array.isArray(raw.tags) ? raw.tags.slice(0, 6).map((t) => String(t).slice(0, 32)) : [],
    docRef: String(raw.docRef || "").slice(0, 120),
    likes: Math.max(0, Number(raw.likes || 0)),
    createdAt: Number(raw.createdAt || Date.now()),
    editedAt: raw.editedAt ? Number(raw.editedAt) : undefined,
    comments: Array.isArray(raw.comments)
      ? raw.comments.slice(0, 80).map((c) => sanitizePublicComment(c)).filter(Boolean)
      : [],
  };
}

function sanitizePublicComment(raw) {
  if (!raw || typeof raw !== "object" || !raw.id || !raw.body) return null;
  return {
    id: String(raw.id).slice(0, 64),
    author: String(raw.author || "Scout").slice(0, 60),
    displaySub: String(raw.displaySub || "").slice(0, 120),
    visibility: ["full", "group_only", "anonymous"].includes(raw.visibility) ? raw.visibility : "full",
    role: String(raw.role || "Miembro Scout").slice(0, 60),
    group: raw.visibility === "anonymous" ? "" : String(raw.group || "").slice(0, 50),
    province: raw.visibility === "anonymous" ? "" : String(raw.province || "").slice(0, 60),
    authorId: String(raw.authorId || "remote").slice(0, 40),
    body: String(raw.body).slice(0, 600),
    likes: Math.max(0, Number(raw.likes || 0)),
    createdAt: Number(raw.createdAt || Date.now()),
    editedAt: raw.editedAt ? Number(raw.editedAt) : undefined,
  };
}

async function readKvArray(env, key) {
  try {
    if (env && env.FORUM_KV) {
      const json = await env.FORUM_KV.get(key);
      if (json) {
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch (_) {}
  return [];
}

async function writeKvArray(env, key, arr, limit = 250) {
  try {
    if (env && env.FORUM_KV) {
      await env.FORUM_KV.put(key, JSON.stringify((arr || []).slice(0, limit)));
    }
  } catch (_) {}
}

async function readStoredPosts(env) {
  const kvPosts = await readKvArray(env, KV_POSTS_KEY);
  if (kvPosts.length) return kvPosts;

  try {
    const cacheRes = await caches.default.match(FORUM_CACHE_KEY);
    if (cacheRes) {
      const parsed = await cacheRes.json();
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) {}

  return [];
}

async function writeStoredPosts(env, posts) {
  const trimmed = (posts || []).slice(0, 200);
  const body = JSON.stringify(trimmed);

  try {
    if (env && env.FORUM_KV) {
      await env.FORUM_KV.put(KV_POSTS_KEY, body);
    }
  } catch (_) {}

  try {
    await caches.default.put(
      FORUM_CACHE_KEY,
      new Response(body, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=2592000",
        },
      })
    );
  } catch (_) {}
}

function extractQuestionsFromActivity(activityText, platform, nowIso) {
  if (!activityText || typeof activityText !== "string") return [];
  const lines = activityText.split(/\r?\n/);
  const extracted = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.includes("PREGUNTA (") && !line.toUpperCase().includes("SIN COINCIDENCIA")) continue;
    let q = "";
    let sources = "";
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const nl = lines[j].trim();
      if (/^\d+\.\s*\[/.test(nl)) break;
      if (nl.startsWith("P:")) q = nl.slice(2).trim();
      else if (nl.startsWith("Fuentes:")) sources = nl.slice(8).trim();
    }
    if (!q) continue;
    const lowerMeta = line.toLowerCase();
    const matched = !lowerMeta.includes("sin coincidencia") && !lowerMeta.includes("0 fuentes");
    const mode = lowerMeta.includes("(manual") ? "manual" : "sugerencia";
    extracted.push({
      at: nowIso,
      q: q.slice(0, 280),
      matched,
      mode,
      sources: sources.slice(0, 280),
      platform: String(platform || "").slice(0, 60),
    });
  }
  return extracted;
}

async function recordPrivateAudit(env, payload, ip) {
  if (!env || !env.FORUM_KV || !payload || payload.actionType === "foro_like") return;
  try {
    const nowIso = new Date().toISOString();
    const ipHash = await hashShort(ip);
    const subject = String(payload._subject || "").slice(0, 160);
    const platform = String(payload.plataforma || "").slice(0, 80);
    const alerts = String(payload.alertas_bugs_o_sin_coincidencia || "").slice(0, 800);
    const summary = String(payload.resumen_mas_usado || "").slice(0, 1500);
    const activity = String(payload.actividad_completa || "");

    const entry = {
      at: nowIso,
      actionType: String(payload.actionType || "evento").slice(0, 40),
      subject,
      platform,
      alerts: alerts && !alerts.includes("Ninguna falla") ? alerts : "",
      securityRecord: payload.securityRecord || null,
      summary,
      ipHash,
    };

    const audits = await readKvArray(env, KV_AUDIT_KEY);
    audits.unshift(entry);
    await writeKvArray(env, KV_AUDIT_KEY, audits, 400);

    // Log persistente de preguntas reales (evita pérdida al expirar logs de 7 días)
    const parsedQs = extractQuestionsFromActivity(activity, platform, nowIso);
    if (parsedQs.length) {
      const qLog = await readKvArray(env, KV_QUESTIONS_KEY);
      for (let i = parsedQs.length - 1; i >= 0; i--) {
        qLog.unshift(parsedQs[i]);
      }
      await writeKvArray(env, KV_QUESTIONS_KEY, qLog, 600);
    }

    // Log persistente de alertas, bugs JS y consultas sin coincidencia
    const isAlertOrBug =
      subject.toUpperCase().includes("ALERTA") ||
      subject.toUpperCase().includes("BUG") ||
      (alerts && !alerts.includes("Ninguna falla")) ||
      parsedQs.some((x) => !x.matched);

    if (isAlertOrBug) {
      const bugs = await readKvArray(env, KV_BUGS_KEY);
      bugs.unshift({
        at: nowIso,
        subject,
        platform,
        alerts,
        activityExcerpt: activity.slice(0, 1200),
        ipHash,
      });
      await writeKvArray(env, KV_BUGS_KEY, bugs, 300);
    }

    if (
      payload.actionType === "foro_reporte" ||
      subject.toLowerCase().includes("reporte")
    ) {
      const reports = await readKvArray(env, KV_REPORTS_KEY);
      reports.unshift(entry);
      await writeKvArray(env, KV_REPORTS_KEY, reports, 250);
    }
  } catch (_) {}
}

async function sendExternalWebhooks(env, payload) {
  if (!env || !payload || payload.actionType === "foro_like") return;
  if (env.DISCORD_WEBHOOK_URL) {
    const content = `**${payload._subject || "BiblioTech Scout"}**\n${payload.plataforma || ""}\n\`\`\`\n${String(payload.actividad_completa || "").slice(0, 1750)}\n\`\`\``;
    await fetch(env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.slice(0, 1950) }),
    }).catch(() => {});
  }

  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    const msg = `${payload._subject || "BiblioTech Scout"}\n${payload.plataforma || ""}\n${String(payload.actividad_completa || "").slice(0, 3500)}`;
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: msg }),
    }).catch(() => {});
  }
}

async function applyForumEvent(env, payload, isAdmin) {
  const posts = await readStoredPosts(env);

  if ((payload.actionType === "foro_post" || payload.actionType === "foro_edicion") && payload.publicPost) {
    const clean = sanitizePublicPost(payload.publicPost);
    if (clean && clean.id && clean.title) {
      const idx = posts.findIndex((p) => p.id === clean.id);
      if (idx >= 0) {
        if (isAdmin || !posts[idx].authorId || posts[idx].authorId === clean.authorId) {
          posts[idx] = {
            ...posts[idx],
            ...clean,
            comments: clean.comments.length ? clean.comments : posts[idx].comments || [],
          };
          await writeStoredPosts(env, posts);
        }
      } else {
        posts.unshift(clean);
        await writeStoredPosts(env, posts);
      }
    }
    return;
  }

  if (
    (payload.actionType === "foro_comentario" || payload.actionType === "foro_comentario_edicion") &&
    payload.publicComment &&
    payload.publicComment.comment
  ) {
    const pid = String(payload.publicComment.postId || "");
    const cleanComment = sanitizePublicComment(payload.publicComment.comment);
    if (!cleanComment || !pid) return;
    let target = posts.find((p) => p.id === pid);
    if (!target) {
      target = { id: pid, isSeedDelta: true, likes: 0, comments: [] };
      posts.push(target);
    }
    if (!Array.isArray(target.comments)) target.comments = [];
    const cIdx = target.comments.findIndex((c) => c.id === cleanComment.id);
    if (cIdx >= 0) {
      if (isAdmin || target.comments[cIdx].authorId === cleanComment.authorId) {
        target.comments[cIdx] = { ...target.comments[cIdx], ...cleanComment };
        await writeStoredPosts(env, posts);
      }
    } else {
      target.comments.push(cleanComment);
      await writeStoredPosts(env, posts);
    }
    return;
  }

  if (payload.actionType === "foro_eliminar" && payload.deleteTarget) {
    const pid = String(payload.deleteTarget.postId || "");
    const cid = payload.deleteTarget.commentId ? String(payload.deleteTarget.commentId) : "";
    const reqAuthor = String(payload.deleteTarget.authorId || "");
    if (!pid) return;

    if (cid) {
      const target = posts.find((p) => p.id === pid);
      if (target && Array.isArray(target.comments)) {
        const before = target.comments.length;
        target.comments = target.comments.filter((c) => !(c.id === cid && (isAdmin || c.authorId === reqAuthor)));
        if (target.comments.length !== before) {
          await writeStoredPosts(env, posts);
        }
      }
    } else {
      const idx = posts.findIndex((p) => p.id === pid && (isAdmin || p.authorId === reqAuthor));
      if (idx >= 0) {
        posts.splice(idx, 1);
        await writeStoredPosts(env, posts);
      }
      const deletedIds = await readKvArray(env, KV_DELETED_KEY);
      if (!deletedIds.includes(pid)) {
        deletedIds.unshift(pid);
        await writeKvArray(env, KV_DELETED_KEY, deletedIds, 200);
      }
    }
    return;
  }

  if (payload.actionType === "foro_like" && payload.likeDelta) {
    const pid = String(payload.likeDelta.postId || "");
    const cid = payload.likeDelta.commentId ? String(payload.likeDelta.commentId) : "";
    const delta = Number(payload.likeDelta.delta || 0);
    if (!pid || (delta !== 1 && delta !== -1)) return;
    let target = posts.find((p) => p.id === pid);
    if (!target) {
      const seedLikes = Number(payload.likeDelta.currentLikes || 0);
      target = { id: pid, isSeedDelta: true, likes: cid ? 0 : Math.max(0, seedLikes), comments: [] };
      posts.push(target);
      await writeStoredPosts(env, posts);
      return;
    }
    if (cid) {
      const c = (target.comments || []).find((x) => x.id === cid);
      if (c) {
        c.likes = Math.max(0, Number(c.likes || 0) + delta);
        await writeStoredPosts(env, posts);
      }
    } else {
      target.likes = Math.max(0, Number(target.likes || 0) + delta);
      await writeStoredPosts(env, posts);
    }
  }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const reqAdminToken =
      request.headers.get("X-Admin-Token") || url.searchParams.get("token") || "";
    const isAdmin = Boolean(env && env.ADMIN_TOKEN && timingSafeMatch(reqAdminToken, env.ADMIN_TOKEN));

    if (request.method === "GET") {
      const channel = url.searchParams.get("channel") || "";

      if (channel === "forum") {
        const [posts, deletedIds] = await Promise.all([
          readStoredPosts(env),
          readKvArray(env, KV_DELETED_KEY),
        ]);
        return jsonResponse({
          ok: true,
          posts,
          deletedIds,
          storage: env && env.FORUM_KV ? "kv" : "edge_cache",
        });
      }

      if (channel === "stats") {
        const [posts, qLog, bugs, reports] = await Promise.all([
          readStoredPosts(env),
          readKvArray(env, KV_QUESTIONS_KEY),
          readKvArray(env, KV_BUGS_KEY),
          readKvArray(env, KV_REPORTS_KEY),
        ]);
        const commentCount = posts.reduce((acc, p) => acc + (Array.isArray(p.comments) ? p.comments.length : 0), 0);
        return jsonResponse(
          {
            ok: true,
            service: "bibliotech-telemetry",
            version: WORKER_VERSION,
            storage: env && env.FORUM_KV ? "kv" : "edge_cache",
            forumPosts: posts.filter((p) => !p.isSeedDelta).length,
            forumComments: commentCount,
            questionsLogged: qLog.length,
            bugsLogged: bugs.length,
            reportsLogged: reports.length,
          },
          200,
          { "Cache-Control": "public, max-age=15" }
        );
      }

      if (channel === "admin" && isAdmin) {
        const [reports, bugs, questions, audits] = await Promise.all([
          readKvArray(env, KV_REPORTS_KEY),
          readKvArray(env, KV_BUGS_KEY),
          readKvArray(env, KV_QUESTIONS_KEY),
          readKvArray(env, KV_AUDIT_KEY),
        ]);
        return jsonResponse({ ok: true, version: WORKER_VERSION, reports, bugs, questions, audits });
      }

      return jsonResponse({
        ok: true,
        service: "bibliotech-telemetry",
        version: WORKER_VERSION,
        storage: env && env.FORUM_KV ? "kv" : "edge_cache",
        timestamp: new Date().toISOString(),
      });
    }

    if (request.method !== "POST") {
      return jsonResponse({ ok: false, error: "Method Not Allowed" }, 405);
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return jsonResponse({ ok: false, error: "Payload demasiado grande" }, 413);
    }

    const rawText = await request.text().catch(() => "");
    if (!rawText || rawText.length > MAX_BODY_BYTES) {
      return jsonResponse({ ok: false, error: "Payload invalido o demasiado grande" }, 413);
    }

    let payload = {};
    try {
      payload = JSON.parse(rawText);
    } catch (_) {
      return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
    }

    const clientIp = request.headers.get("CF-Connecting-IP") || "";
    if (!checkRateLimit(clientIp, payload.actionType)) {
      return jsonResponse({ ok: false, error: "Too Many Requests" }, 429);
    }

    console.log("BT_TELEMETRY", JSON.stringify(payload));

    if (payload && payload.canal_foro === "La Fogata") {
      await applyForumEvent(env, payload, isAdmin);
    }

    const bgWork = Promise.all([
      recordPrivateAudit(env, payload, clientIp),
      sendExternalWebhooks(env, payload),
    ]);
    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(bgWork);
    } else {
      await bgWork;
    }

    return jsonResponse({ ok: true, version: WORKER_VERSION });
  },
};
