/**
 * BiblioTech Scout — Worker gratuito de Telemetría (Cloudflare Workers Free Plan)
 * -----------------------------------------------------------------------------
 * 100% gratuito (hasta 100,000 peticiones diarias en Cloudflare Workers Free,
 * sin necesidad de tarjeta de crédito).
 *
 * Cómo usarlo:
 * 1. Crea una cuenta gratuita en https://dash.cloudflare.com
 * 2. Ve a Workers & Pages -> Create Worker -> pega este código y haz clic en Deploy.
 * 3. (Opcional) En Settings -> Variables and Secrets añade:
 *    - DISCORD_WEBHOOK_URL o TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (para recibir avisos al instante gratis)
 *    - o vincula un KV Namespace llamado TELEMETRY_KV (también gratis) para acumular conteos diarios.
 * 4. Copia la URL *.workers.dev y pégala en BT_TELEMETRY_CONFIG.workerEndpoint dentro de src/app.js.
 */

const ALLOWED_ORIGINS = new Set([
  "https://ey-liam.github.io",
  "capacitor://localhost",
  "http://localhost",
  "https://localhost",
]);

function corsHeaders(origin) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://ey-liam.github.io";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "Method Not Allowed" }), {
        status: 405,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    let payload;
    try {
      const text = await request.text();
      if (!text || text.length > 65536) {
        return new Response(JSON.stringify({ ok: false, error: "Invalid payload size" }), {
          status: 400,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }
      payload = JSON.parse(text);
    } catch (_) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // Guardar conteos diarios opcionales en KV gratuito si está enlazado (con protección si rebasa 1,000 escrituras/día)
    if (env && env.TELEMETRY_KV) {
      try {
        const day = new Date().toISOString().slice(0, 10);
        const logKey = `log:${day}:${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await env.TELEMETRY_KV.put(logKey, JSON.stringify(payload), { expirationTtl: 60 * 60 * 24 * 30 });
      } catch (_) {}
    }

    // Reenvío opcional gratis a Discord Webhook (alertas y resumen de uso)
    if (env && env.DISCORD_WEBHOOK_URL) {
      const content = [
        `**${payload._subject || "BiblioTech Scout Telemetría"}**`,
        `Plataforma: ${payload.plataforma || "Desconocida"} | ${payload.navegador_y_tema || ""}`,
        payload.alertas_bugs_o_sin_coincidencia ? `Alertas: ${String(payload.alertas_bugs_o_sin_coincidencia).slice(0, 400)}` : "",
        payload.resumen_mas_usado ? `Top uso: ${String(payload.resumen_mas_usado).slice(0, 500)}` : "",
        payload.actividad_completa ? `\`\`\`\n${String(payload.actividad_completa).slice(0, 900)}\n\`\`\`` : "",
      ]
        .filter(Boolean)
        .join("\n");

      await fetch(env.DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.slice(0, 1950) }),
      }).catch(() => {});
    }

    // Reenvío opcional gratis a Telegram Bot API
    if (env && env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
      const msg = `${payload._subject || "BiblioTech Scout"}\n${payload.plataforma || ""}\n${String(payload.actividad_completa || "").slice(0, 3200)}`;
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: msg,
        }),
      }).catch(() => {});
    }

    console.log("BT_TELEMETRY", JSON.stringify(payload));
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  },
};
