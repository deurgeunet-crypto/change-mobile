const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const sendJson = (data, status, corsHeaders) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, ...jsonHeaders },
  });

const corsForRequest = (request, env) => {
  const origin = request.headers.get("Origin");
  const allowedOrigins = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!origin || !allowedOrigins.includes(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
};

const isE164Phone = (phone) =>
  typeof phone === "string" && /^\+[1-9]\d{7,14}$/.test(phone);

const hashPhone = async (phone) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(phone),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
};

const enforceRateLimit = async (limiter, keys) => {
  for (const key of keys) {
    const result = await limiter.limit({ key });
    if (!result.success) return false;
  }
  return true;
};

const callTwilio = async (env, resource, fields) => {
  const serviceSid = env.TWILIO_VERIFY_SERVICE_SID;
  const apiKeySid = env.TWILIO_API_KEY_SID;
  const apiKeySecret = env.TWILIO_API_KEY_SECRET;
  if (
    !/^VA[0-9a-fA-F]{32}$/.test(serviceSid || "") ||
    !/^SK[0-9a-fA-F]{32}$/.test(apiKeySid || "") ||
    !apiKeySecret
  ) {
    return { ok: false, status: 503, error: "Le service de vérification n’est pas encore configuré." };
  }

  const url =
    `https://verify.twilio.com/v2/Services/${serviceSid}/${resource}`;
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${apiKeySid}:${apiKeySecret}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(fields),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return {
      ok: false,
      status: 502,
      error: "Le service d’envoi n’a pas répondu. Réessayez plus tard.",
    };
  }

  let result;
  try {
    result = await response.json();
  } catch {
    return {
      ok: false,
      status: 502,
      error: "Le service d’envoi a renvoyé une réponse invalide.",
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status === 429 ? 429 : 502,
      error:
        response.status === 429
          ? "Trop de demandes de code. Attendez un peu avant de réessayer."
          : "L’envoi ou la vérification a échoué. Vérifiez les paramètres du service et réessayez.",
    };
  }
  return { ok: true, result };
};

const handleRequest = async (request, env) => {
  const corsHeaders = corsForRequest(request, env);
  if (!corsHeaders) {
    return sendJson({ error: "Origine non autorisée." }, 403, {});
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return sendJson({ error: "Méthode non autorisée." }, 405, corsHeaders);
  }
  if (!request.headers.get("Content-Type")?.startsWith("application/json")) {
    return sendJson({ error: "Le corps doit être au format JSON." }, 415, corsHeaders);
  }
  const { pathname } = new URL(request.url);
  if (pathname !== "/auth/start" && pathname !== "/auth/check") {
    return sendJson({ error: "Route introuvable." }, 404, corsHeaders);
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return sendJson({ error: "Corps de requête manquant." }, 400, corsHeaders);
  }
  const chunks = [];
  let bodySize = 0;
  while (true) {
    let chunk;
    try {
      chunk = await reader.read();
    } catch {
      return sendJson({ error: "Impossible de lire la requête." }, 400, corsHeaders);
    }
    if (chunk.done) break;
    bodySize += chunk.value.byteLength;
    if (bodySize > 2048) {
      await reader.cancel();
      return sendJson({ error: "La requête est trop volumineuse." }, 413, corsHeaders);
    }
    chunks.push(chunk.value);
  }

  const bodyBytes = new Uint8Array(bodySize);
  let bodyOffset = 0;
  for (const chunk of chunks) {
    bodyBytes.set(chunk, bodyOffset);
    bodyOffset += chunk.byteLength;
  }

  let body;
  try {
    body = JSON.parse(new TextDecoder().decode(bodyBytes));
  } catch {
    return sendJson({ error: "Requête JSON invalide." }, 400, corsHeaders);
  }
  const phone = body?.phone;
  if (!isE164Phone(phone)) {
    return sendJson(
      { error: "Saisissez un numéro au format international, par exemple +221770000000." },
      400,
      corsHeaders,
    );
  }

  const isStart = pathname === "/auth/start";
  const channel = body?.channel;
  const code = body?.code;
  if (isStart && channel !== "sms" && channel !== "whatsapp") {
    return sendJson({ error: "Choisissez SMS ou WhatsApp." }, 400, corsHeaders);
  }
  if (!isStart && (typeof code !== "string" || !/^\d{4,10}$/.test(code))) {
    return sendJson({ error: "Saisissez un code de 4 à 10 chiffres." }, 400, corsHeaders);
  }

  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
  let withinLimit;
  try {
    const limiter = isStart ? env.SEND_RATE_LIMITER : env.CHECK_RATE_LIMITER;
    withinLimit = await enforceRateLimit(limiter, [
      `ip:${clientIp}`,
      `phone:${await hashPhone(phone)}`,
    ]);
  } catch {
    return sendJson(
      { error: "La protection anti-abus est indisponible. Réessayez plus tard." },
      503,
      corsHeaders,
    );
  }
  if (!withinLimit) {
    return sendJson(
      { error: "Trop de tentatives. Attendez une minute avant de réessayer." },
      429,
      corsHeaders,
    );
  }

  if (isStart) {
    const result = await callTwilio(env, "Verifications", {
      To: phone,
      Channel: channel,
    });
    if (!result.ok) {
      return sendJson({ error: result.error }, result.status, corsHeaders);
    }
    if (result.result.status !== "pending") {
      return sendJson(
        { error: "Le code n’a pas pu être envoyé. Réessayez plus tard." },
        502,
        corsHeaders,
      );
    }
    return sendJson({ sent: true }, 200, corsHeaders);
  }

  const result = await callTwilio(env, "VerificationCheck", {
    To: phone,
    Code: code,
  });
  if (!result.ok) {
    return sendJson({ error: result.error }, result.status, corsHeaders);
  }
  if (result.result.status !== "approved") {
    return sendJson(
      { error: "Code incorrect ou expiré." },
      400,
      corsHeaders,
    );
  }
  return sendJson({ verified: true }, 200, corsHeaders);
};

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },
};
