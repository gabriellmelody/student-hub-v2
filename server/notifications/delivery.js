import crypto from "node:crypto";
import webPush from "web-push";
import { getSupabaseServerUrl, getSupabaseServiceHeaders, readBearerToken, requiredServerEnv } from "../supabase-server.js";
import { MAX_DELIVERY_ATTEMPTS, normalizeDeliveryPayload, resolveDeliveryCandidates } from "./delivery-utils.js";
import { getZonedDateTimeParts } from "../../src/utils/notificationSchedulingUtils.js";

const PAGE_SIZE = 1000;
const RETRY_DELAY_MINUTES = [5, 15, 30];

function safeEqual(left, right) {
  const a = Buffer.from(String(left || "")); const b = Buffer.from(String(right || ""));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

export function authorizeDeliveryRequest(request, env = process.env) {
  const expected = String(env.DAYLO_NOTIFICATION_CRON_SECRET || "").trim();
  return Boolean(expected && safeEqual(readBearerToken(request), expected));
}

export function validateVapidConfig(env = process.env) {
  const publicKey = requiredServerEnv(env, "VITE_DAYLO_VAPID_PUBLIC_KEY");
  const privateKey = requiredServerEnv(env, "DAYLO_VAPID_PRIVATE_KEY");
  const subject = requiredServerEnv(env, "DAYLO_VAPID_SUBJECT");
  if (!/^mailto:|^https:\/\//i.test(subject)) throw new Error("invalid_daylo_vapid_subject");
  if (publicKey.length < 40 || privateKey.length < 20) throw new Error("invalid_daylo_vapid_keys");
  return { publicKey, privateKey, subject };
}

function serviceHeaders(env, extras = {}) { return getSupabaseServiceHeaders(env, { Accept: "application/json", ...extras }); }
async function readJson(response) { return response.json().catch(() => null); }

async function fetchRows(path, { env, fetchImpl }) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const response = await fetchImpl(getSupabaseServerUrl(env, `/rest/v1/${path}`), {
      headers: serviceHeaders(env, { Range: `${offset}-${offset + PAGE_SIZE - 1}` }),
    });
    const page = await readJson(response);
    if (!response.ok || !Array.isArray(page)) throw new Error("notification_query_failed");
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function postRpc(name, payload, { env, fetchImpl }) {
  const response = await fetchImpl(getSupabaseServerUrl(env, `/rest/v1/rpc/${name}`), {
    method: "POST", headers: serviceHeaders(env, { "Content-Type": "application/json" }), body: JSON.stringify(payload),
  });
  const body = await readJson(response);
  if (!response.ok) throw new Error("notification_claim_failed");
  return Array.isArray(body) ? body[0] || null : body;
}

async function updateDelivery(id, userId, payload, { env, fetchImpl }) {
  const query = `notification_deliveries?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`;
  const response = await fetchImpl(getSupabaseServerUrl(env, `/rest/v1/${query}`), {
    method: "PATCH", headers: serviceHeaders(env, { "Content-Type": "application/json", Prefer: "return=minimal" }), body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("notification_delivery_update_failed");
}

async function deleteSubscription(subscription, { env, fetchImpl }) {
  const query = `push_subscriptions?id=eq.${encodeURIComponent(subscription.id)}&user_id=eq.${encodeURIComponent(subscription.user_id)}`;
  const response = await fetchImpl(getSupabaseServerUrl(env, `/rest/v1/${query}`), { method: "DELETE", headers: serviceHeaders(env) });
  if (!response.ok) throw new Error("notification_subscription_delete_failed");
}

export async function resolveDueDeliveryData({ env = process.env, fetchImpl = fetch, now = new Date() } = {}) {
  const preferences = await fetchRows("notification_preferences?master_enabled=eq.true&select=*", { env, fetchImpl });
  if (!preferences.length) return { preferences, subscriptions: [], tasks: [], plans: [], candidates: [] };
  const userIds = preferences.map((row) => row.user_id);
  const userFilter = `in.(${userIds.join(",")})`;
  const localDates = preferences.map((row) => getZonedDateTimeParts(now, row.timezone || "UTC").date);
  const minDate = [...localDates].sort()[0];
  const maxDate = new Date(`${[...localDates].sort().at(-1)}T00:00:00Z`); maxDate.setUTCDate(maxDate.getUTCDate() + 1);
  const maxDateKey = maxDate.toISOString().slice(0, 10);
  const [subscriptions, tasks, plans, retryDeliveries] = await Promise.all([
    fetchRows(`push_subscriptions?user_id=${userFilter}&select=id,user_id,endpoint,p256dh,auth`, { env, fetchImpl }),
    fetchRows(`tasks?user_id=${userFilter}&completed=eq.false&archived=eq.false&due_date=gte.${minDate}&due_date=lte.${maxDateKey}&select=id,user_id,subject_name,title,due_date,due_time,completed,archived`, { env, fetchImpl }),
    fetchRows(`daily_plans?user_id=${userFilter}&plan_date=gte.${minDate}&plan_date=lte.${maxDateKey}&select=id,user_id,plan_date,plan_data`, { env, fetchImpl }),
    fetchRows(`notification_deliveries?user_id=${userFilter}&status=eq.failed&attempt_count=lt.${MAX_DELIVERY_ATTEMPTS}&next_attempt_at=lte.${now.toISOString()}&select=occurrence_key`, { env, fetchImpl }),
  ]);
  return { preferences, subscriptions, tasks, plans, candidates: resolveDeliveryCandidates({ preferences, tasks, plans,
    retryOccurrenceKeys: retryDeliveries.map((row) => row.occurrence_key), now }) };
}

export async function deliverDueNotifications(options = {}) {
  const env = options.env || process.env; const fetchImpl = options.fetchImpl || fetch; const now = options.now || new Date();
  const push = options.webPushImpl || webPush; const started = Date.now();
  const vapid = validateVapidConfig(env); push.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  console.info("notifications: delivery run started");
  const data = options.data || await resolveDueDeliveryData({ env, fetchImpl, now });
  const subscriptionsByUser = new Map();
  data.subscriptions.forEach((subscription) => subscriptionsByUser.set(subscription.user_id, [...(subscriptionsByUser.get(subscription.user_id) || []), subscription]));
  const summary = { ok: true, candidates: data.candidates.length, claimed: 0, sent: 0, failed: 0, staleRemoved: 0 };
  console.info("notifications: candidates resolved", { candidates: summary.candidates });
  for (const candidate of data.candidates) for (const subscription of subscriptionsByUser.get(candidate.userId) || []) {
    const claim = await postRpc("daylo_claim_notification_delivery", { claim_user_id: candidate.userId, claim_subscription_id: subscription.id,
      claim_occurrence_key: candidate.occurrenceKey, claim_notification_type: candidate.type, claim_entity_id: candidate.entityId,
      claim_scheduled_for: now.toISOString() }, { env, fetchImpl });
    if (!claim?.id) continue;
    summary.claimed += 1;
    try {
      await push.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify(normalizeDeliveryPayload(candidate)), { TTL: 300, urgency: "normal" });
      await updateDelivery(claim.id, candidate.userId, { status: "sent", sent_at: new Date().toISOString(), next_attempt_at: null }, { env, fetchImpl });
      summary.sent += 1; console.info("notifications: delivery sent", { notificationType: candidate.type });
    } catch (error) {
      const statusCode = Number(error?.statusCode || error?.status || 0);
      if (statusCode === 404 || statusCode === 410) {
        await deleteSubscription(subscription, { env, fetchImpl });
        await updateDelivery(claim.id, candidate.userId, { status: "skipped", last_error_category: "subscription_stale", next_attempt_at: null }, { env, fetchImpl });
        summary.staleRemoved += 1; console.info("notifications: stale subscription removed", { responseClass: "4xx" });
      } else {
        const attempt = Number(claim.attempt_count) || 1; const exhausted = attempt >= MAX_DELIVERY_ATTEMPTS;
        const nextAttempt = exhausted ? null : new Date(now.getTime() + RETRY_DELAY_MINUTES[attempt - 1] * 60000).toISOString();
        await updateDelivery(claim.id, candidate.userId, { status: "failed", last_error_category: statusCode >= 500 ? "push_provider_unavailable" : "push_delivery_failed", next_attempt_at: nextAttempt }, { env, fetchImpl });
        summary.failed += 1; console.info("notifications: transient delivery failure", { responseClass: statusCode ? `${Math.floor(statusCode / 100)}xx` : "network", exhausted });
      }
    }
  }
  console.info("notifications: delivery run completed", { ...summary, elapsedMs: Date.now() - started });
  return summary;
}

export async function handleDeliverDue(request, response, options = {}) {
  const env = options.env || process.env;
  if (!authorizeDeliveryRequest(request, env)) return response.status(401).json({ ok: false, status: "scheduler_unauthorized" });
  try { return response.status(200).json(await deliverDueNotifications({ ...options, env })); }
  catch (error) {
    const status = String(error?.message || "notification_delivery_failed");
    const configuration = status.startsWith("missing_") || status.startsWith("invalid_");
    console.error("notifications: delivery run failed", { category: configuration ? "configuration" : "delivery_service", elapsedMs: 0 });
    return response.status(configuration ? 503 : 500).json({ ok: false, status: configuration ? "notification_delivery_not_configured" : "notification_delivery_failed" });
  }
}
