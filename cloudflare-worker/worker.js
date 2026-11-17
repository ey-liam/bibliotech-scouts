// ============================================================================
// BiblioTech Scout — Cloudflare Worker (Telemetría, Moderación y La Fogata)
// - Pega este código en https://dash.cloudflare.com -> Workers -> bibliotech-telemetry
// - Opcional (recomendado para persistencia global permanente entre todos los usuarios):
//   En Settings -> Bindings -> Add KV Namespace con Variable name: FORUM_KV
// - Sin KV sigue funcionando con Cloudflare Cache API + Logs en Observability.
// ============================================================================

const FORUM_CACHE_KEY = "https://bibliotech-forum-cache.internal/v1/posts.json";
const KV_POSTS_KEY = "fogata_posts_v1";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

function sanitizePublicPost(raw) {
  if (!raw || typeof raw !== "object") return null;
  // Nunca guardar ni devolver datos privados de seguridad en el feed público
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

async function readStoredPosts(env) {
  try {
    if (env && env.FORUM_KV) {
      const json = await env.FORUM_KV.get(KV_POSTS_KEY);
      if (json) {
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch (_) {}

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

async function applyForumEvent(env, payload) {
  const posts = await readStoredPosts(env);

  if ((payload.actionType === "foro_post" || payload.actionType === "foro_edicion") && payload.publicPost) {
    const clean = sanitizePublicPost(payload.publicPost);
    if (clean && clean.id && clean.title) {
      const idx = posts.findIndex((p) => p.id === clean.id);
      if (idx >= 0) {
        posts[idx] = { ...posts[idx], ...clean, comments: clean.comments.length ? clean.comments : posts[idx].comments || [] };
      } else {
        posts.unshift(clean);
      }
      await writeStoredPosts(env, posts);
    }
    return;
  }

  if (payload.actionType === "foro_comentario" && payload.publicComment && payload.publicComment.comment) {
    const pid = String(payload.publicComment.postId || "");
    const cleanComment = sanitizePublicComment(payload.publicComment.comment);
    if (!cleanComment || !pid) return;
    let target = posts.find((p) => p.id === pid);
    if (!target) {
      target = { id: pid, isSeedDelta: true, likes: 0, comments: [] };
      posts.push(target);
    }
    if (!Array.isArray(target.comments)) target.comments = [];
    if (!target.comments.some((c) => c.id === cleanComment.id)) {
      target.comments.push(cleanComment);
      await writeStoredPosts(env, posts);
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

    if (request.method === "GET") {
      if (url.searchParams.get("channel") === "forum") {
        const posts = await readStoredPosts(env);
        return new Response(JSON.stringify({ ok: true, posts, storage: env && env.FORUM_KV ? "kv" : "edge_cache" }), {
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

    let payload = {};
    try {
      payload = await request.json();
    } catch (_) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Log completo en Cloudflare Observability (incluye registro privado de seguridad)
    console.log("BT_TELEMETRY", JSON.stringify(payload));

    if (payload && payload.canal_foro === "La Fogata") {
      await applyForumEvent(env, payload);
    }

    // Reenvío opcional a Discord Webhook
    if (env && env.DISCORD_WEBHOOK_URL && payload.actionType !== "foro_like") {
      const content = `**${payload._subject || "BiblioTech Scout"}**\n${payload.plataforma || ""}\n\`\`\`\n${String(payload.actividad_completa || "").slice(0, 1750)}\n\`\`\``;
      await fetch(env.DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.slice(0, 1950) }),
      }).catch(() => {});
    }

    // Reenvío opcional gratis a Telegram Bot API
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
