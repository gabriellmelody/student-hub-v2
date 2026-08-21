import {
  getSupabaseServerUrl,
  getSupabaseServiceHeaders,
  requireDayloUser,
} from "../supabase-server.js";

const MAX_ENDPOINT_LENGTH = 4096;
const MAX_KEY_LENGTH = 512;

function clean(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

async function readRequestJson(request) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      return null;
    }
  }
  return null;
}

export function normalizePushSubscription(value) {
  const endpointValue = typeof value?.endpoint === "string" ? value.endpoint.trim() : "";
  const p256dhValue = value?.keys?.p256dh ?? value?.p256dh;
  const authValue = value?.keys?.auth ?? value?.auth;
  const p256dh = typeof p256dhValue === "string" ? p256dhValue.trim() : "";
  const auth = typeof authValue === "string" ? authValue.trim() : "";
  if (
    !endpointValue ||
    endpointValue.length > MAX_ENDPOINT_LENGTH ||
    !p256dh ||
    p256dh.length > MAX_KEY_LENGTH ||
    !auth ||
    auth.length > MAX_KEY_LENGTH
  ) {
    return null;
  }
  const endpoint = endpointValue;
  let endpointUrl;
  try {
    endpointUrl = new URL(endpoint);
  } catch {
    return null;
  }
  if (endpointUrl.protocol !== "https:" || !p256dh || !auth) return null;
  return { endpoint, p256dh, auth };
}

function subscriptionsUrl(env, query = "") {
  return `${getSupabaseServerUrl(env, "/rest/v1/push_subscriptions")}${query}`;
}

async function readSafeJson(response) {
  return response.json().catch(() => null);
}

async function findEndpoint(endpoint, { env, fetchImpl }) {
  const query = `?endpoint=eq.${encodeURIComponent(endpoint)}&select=id,user_id`;
  const response = await fetchImpl(subscriptionsUrl(env, query), {
    headers: getSupabaseServiceHeaders(env),
  });
  const body = await readSafeJson(response);
  if (!response.ok || !Array.isArray(body)) throw new Error("subscription_query_failed");
  return body[0] || null;
}

function safeMetadata(body) {
  return {
    device_label: clean(body?.deviceLabel, 80) || null,
    platform: clean(body?.platform, 40) || null,
    timezone: clean(body?.timezone, 80) || null,
  };
}

export async function handleSubscribe(request, response, options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || fetch;
  const auth = await requireDayloUser(request, { env, fetchImpl });
  if (!auth.ok) return response.status(auth.statusCode).json({ ok: false, status: auth.status });
  const body = await readRequestJson(request);
  const subscription = normalizePushSubscription(body?.subscription);
  if (!subscription) {
    return response.status(400).json({ ok: false, status: "subscription_invalid" });
  }

  try {
    const existing = await findEndpoint(subscription.endpoint, { env, fetchImpl });
    if (existing && existing.user_id !== auth.userId) {
      return response.status(409).json({ ok: false, status: "subscription_owner_conflict" });
    }
    const payload = {
      user_id: auth.userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      ...safeMetadata(body),
      last_seen_at: new Date().toISOString(),
    };
    const writeUrl = existing
      ? subscriptionsUrl(
          env,
          `?user_id=eq.${encodeURIComponent(auth.userId)}&endpoint=eq.${encodeURIComponent(subscription.endpoint)}`
        )
      : subscriptionsUrl(env);
    const writeResponse = await fetchImpl(writeUrl, {
      method: existing ? "PATCH" : "POST",
      headers: getSupabaseServiceHeaders(env, {
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      }),
      body: JSON.stringify(payload),
    });
    if (!writeResponse.ok) {
      if (!existing && writeResponse.status === 409) {
        const winner = await findEndpoint(subscription.endpoint, { env, fetchImpl });
        if (winner?.user_id !== auth.userId) {
          return response.status(409).json({ ok: false, status: "subscription_owner_conflict" });
        }
        const retryResponse = await fetchImpl(
          subscriptionsUrl(env, `?user_id=eq.${encodeURIComponent(auth.userId)}&endpoint=eq.${encodeURIComponent(subscription.endpoint)}`),
          {
            method: "PATCH",
            headers: getSupabaseServiceHeaders(env, { "Content-Type": "application/json", Prefer: "return=minimal" }),
            body: JSON.stringify(payload),
          }
        );
        if (!retryResponse.ok) throw new Error("subscription_write_failed");
      } else {
        throw new Error("subscription_write_failed");
      }
    }
    return response.status(200).json({ ok: true, status: "subscribed" });
  } catch {
    return response.status(503).json({ ok: false, status: "subscription_service_unavailable" });
  }
}

export async function handleUnsubscribe(request, response, options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || fetch;
  const auth = await requireDayloUser(request, { env, fetchImpl });
  if (!auth.ok) return response.status(auth.statusCode).json({ ok: false, status: auth.status });
  const body = await readRequestJson(request);
  const endpoint = clean(body?.endpoint, MAX_ENDPOINT_LENGTH);
  if (!endpoint) return response.status(400).json({ ok: false, status: "endpoint_required" });
  const query = `?user_id=eq.${encodeURIComponent(auth.userId)}&endpoint=eq.${encodeURIComponent(endpoint)}`;
  try {
    const deleteResponse = await fetchImpl(subscriptionsUrl(env, query), {
      method: "DELETE",
      headers: getSupabaseServiceHeaders(env),
    });
    if (!deleteResponse.ok) throw new Error("subscription_delete_failed");
    return response.status(200).json({ ok: true, status: "unsubscribed" });
  } catch {
    return response.status(503).json({ ok: false, status: "subscription_service_unavailable" });
  }
}

export async function handleStatus(request, response, options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || fetch;
  const auth = await requireDayloUser(request, { env, fetchImpl });
  if (!auth.ok) return response.status(auth.statusCode).json({ ok: false, status: auth.status });
  const body = await readRequestJson(request);
  const endpoint = clean(body?.endpoint, MAX_ENDPOINT_LENGTH);
  if (!endpoint) return response.status(200).json({ ok: true, status: "not_subscribed", registered: false });
  try {
    const query = `?user_id=eq.${encodeURIComponent(auth.userId)}&endpoint=eq.${encodeURIComponent(endpoint)}&select=id`;
    const statusResponse = await fetchImpl(subscriptionsUrl(env, query), {
      headers: getSupabaseServiceHeaders(env),
    });
    const rows = await readSafeJson(statusResponse);
    if (!statusResponse.ok || !Array.isArray(rows)) throw new Error("subscription_query_failed");
    const registered = Boolean(rows[0]?.id);
    return response.status(200).json({
      ok: true,
      status: registered ? "subscribed" : "not_subscribed",
      registered,
    });
  } catch {
    return response.status(503).json({ ok: false, status: "subscription_service_unavailable" });
  }
}
