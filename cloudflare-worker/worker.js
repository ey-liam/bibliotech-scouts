// ============================================================================
// BiblioTech Scout — Cloudflare Worker (Telemetría, Moderación y La Fogata)
// - Pega este código en https://dash.cloudflare.com -> Workers -> bibliotech-telemetry
// - Binding KV recomendado: FORUM_KV -> bibliotech_fogata_kv
// - Opcional para moderación remota: Variable secreta ADMIN_TOKEN
// ============================================================================

const FORUM_CACHE_KEY = "https://bibliotech-forum-cache.internal/v1/posts.json";
const KV_POSTS_KEY = "fogata_posts_v1";
const KV_DELETED_KEY = "fogata_deleted_v1";
const KV_REPORTS_KEY = "fogata_reports_v1";
const KV_AUDIT_KEY = "fogata_audit_v1";
const MAX_BODY_BYTES = 48 * 1024;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_WRITES = 10;
const ipWriteBuckets = new Map();

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, X-Admin-Token",
};

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

async function recordPrivateAudit(env, payload, ip) {
  if (!env || !env.FORUM_KV || !payload || payload.actionType === "foro_like") return;
  try {
    const entry = {
      at: new Date().toISOString(),
      actionType: String(payload.actionType || "evento").slice(0, 40),
      subject: String(payload._subject || "").slice(0, 140),
      securityRecord: payload.securityRecord || null,
      summary: String(payload.resumen_mas_usado || "").slice(0, 500),
      ipHash: ip ? String(ip).slice(0, 24) : "",
    };
    const audits = await readKvArray(env, KV_AUDIT_KEY);
    audits.unshift(entry);
    await writeKvArray(env, KV_AUDIT_KEY, audits, 400);

    if (
      payload.actionType === "foro_reporte" ||
      String(payload._subject || "").toLowerCase().includes("reporte")
    ) {
      const reports = await readKvArray(env, KV_REPORTS_KEY);
      reports.unshift(entry);
      await writeKvArray(env, KV_REPORTS_KEY, reports, 250);
    }
  } catch (_) {}
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
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const reqAdminToken =
      request.headers.get("X-Admin-Token") || url.searchParams.get("token") || "";
    const isAdmin = Boolean(env && env.ADMIN_TOKEN && reqAdminToken && reqAdminToken === env.ADMIN_TOKEN);

    if (request.method === "GET") {
      if (url.searchParams.get("channel") === "forum") {
        const [posts, deletedIds] = await Promise.all([
          readStoredPosts(env),
          readKvArray(env, KV_DELETED_KEY),
        ]);
        return new Response(
          JSON.stringify({
            ok: true,
            posts,
            deletedIds,
            storage: env && env.FORUM_KV ? "kv" : "edge_cache",
          }),
          {
            status: 200,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          }
        );
      }
      if (url.searchParams.get("channel") === "admin" && isAdmin) {
        const [reports, audits] = await Promise.all([
          readKvArray(env, KV_REPORTS_KEY),
          readKvArray(env, KV_AUDIT_KEY),
        ]);
        return new Response(JSON.stringify({ ok: true, reports, audits }), {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true, service: "bibliotech-telemetry" }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "Method Not Allowed" }), {
        status: 405,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const rawText = await request.text().catch(() => "");
    if (!rawText || rawText.length > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ ok: false, error: "Payload invalido o demasiado grande" }), {
        status: 413,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    let payload = {};
    try {
      payload = JSON.parse(rawText);
    } catch (_) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const clientIp = request.headers.get("CF-Connecting-IP") || "";
    if (!checkRateLimit(clientIp, payload.actionType)) {
      return new Response(JSON.stringify({ ok: false, error: "Too Many Requests" }), {
        status: 429,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    console.log("BT_TELEMETRY", JSON.stringify(payload));
    await recordPrivateAudit(env, payload, clientIp);

    if (payload && payload.canal_foro === "La Fogata") {
      await applyForumEvent(env, payload, isAdmin);
    }

    if (env && env.DISCORD_WEBHOOK_URL && payload.actionType !== "foro_like") {
      const content = `**${payload._subject || "BiblioTech Scout"}**\n${payload.plataforma || ""}\n\`\`\`\n${String(payload.actividad_completa || "").slice(0, 1750)}\n\`\`\``;
      await fetch(env.DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.slice(0, 1950) }),
      }).catch(() => {});
    }

    if (env && env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID && payload.actionType !== "foro_like") {
      const msg = `${payload._subject || "BiblioTech Scout"}\n${payload.plataforma || ""}\n${String(payload.actividad_completa || "").slice(0, 3500)}`;
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: msg }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  },
};
