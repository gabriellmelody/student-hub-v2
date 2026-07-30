/* global Buffer, process */

import { createHmac, timingSafeEqual } from "node:crypto";

export const SMART_PLANNER_QUOTA_COOKIE = "student_hub_smart_planner_quota";
export const SMART_PLANNER_QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_SMART_PLANNER_DAILY_LIMIT = 3;

function isProductionRuntime(env = process.env) {
  return env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
}

export function getSmartPlannerDailyLimit(env = process.env) {
  const configuredLimit = Number.parseInt(env.SMART_PLANNER_DAILY_LIMIT || "", 10);
  const limit = Number.isFinite(configuredLimit)
    ? configuredLimit
    : DEFAULT_SMART_PLANNER_DAILY_LIMIT;

  return Math.min(10, Math.max(1, limit));
}

export function getSmartPlannerUsageSecret(env = process.env) {
  const configuredSecret = String(env.SMART_PLANNER_USAGE_SECRET || "").trim();

  if (configuredSecret) return configuredSecret;
  if (isProductionRuntime(env)) return "";
  return "student-hub-smart-planner-local-development-only";
}

function parseCookies(cookieHeader = "") {
  return String(cookieHeader)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex <= 0) return cookies;
      const name = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      cookies[name] = value;
      return cookies;
    }, {});
}

function signPayload(encodedPayload, secret) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function signaturesMatch(receivedSignature, expectedSignature) {
  try {
    const received = Buffer.from(receivedSignature, "base64url");
    const expected = Buffer.from(expectedSignature, "base64url");
    return received.length === expected.length && timingSafeEqual(received, expected);
  } catch {
    return false;
  }
}

function encodeQuotaState(state, secret) {
  const encodedPayload = Buffer.from(JSON.stringify(state), "utf8").toString(
    "base64url"
  );
  return `${encodedPayload}.${signPayload(encodedPayload, secret)}`;
}

function createFreshState(now) {
  return {
    version: 1,
    windowStartedAt: now,
    attemptsUsed: 0,
  };
}

function decodeQuotaState(cookieValue, secret, now, limit) {
  if (!cookieValue) {
    return { valid: true, state: createFreshState(now), hadCookie: false };
  }

  const parts = String(cookieValue).split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { valid: false, state: null, hadCookie: true };
  }

  const [encodedPayload, receivedSignature] = parts;
  const expectedSignature = signPayload(encodedPayload, secret);
  if (!signaturesMatch(receivedSignature, expectedSignature)) {
    return { valid: false, state: null, hadCookie: true };
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    );
    const validShape =
      parsed &&
      typeof parsed === "object" &&
      parsed.version === 1 &&
      Number.isInteger(parsed.windowStartedAt) &&
      Number.isInteger(parsed.attemptsUsed) &&
      parsed.windowStartedAt > 0 &&
      parsed.windowStartedAt <= now + 5 * 60 * 1000 &&
      parsed.attemptsUsed >= 0 &&
      parsed.attemptsUsed <= limit;

    if (!validShape) return { valid: false, state: null, hadCookie: true };

    if (now - parsed.windowStartedAt >= SMART_PLANNER_QUOTA_WINDOW_MS) {
      return { valid: true, state: createFreshState(now), hadCookie: true };
    }

    return { valid: true, state: parsed, hadCookie: true };
  } catch {
    return { valid: false, state: null, hadCookie: true };
  }
}

function serializeQuotaCookie(state, secret, now, production) {
  const resetAt = state.windowStartedAt + SMART_PLANNER_QUOTA_WINDOW_MS;
  const maxAge = Math.max(1, Math.ceil((resetAt - now) / 1000));
  const attributes = [
    `${SMART_PLANNER_QUOTA_COOKIE}=${encodeQuotaState(state, secret)}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${maxAge}`,
  ];

  if (production) attributes.push("Secure");
  return attributes.join("; ");
}

export function readSmartPlannerQuota({
  cookieHeader = "",
  env = process.env,
  now = Date.now(),
} = {}) {
  const limit = getSmartPlannerDailyLimit(env);
  const secret = getSmartPlannerUsageSecret(env);

  if (!secret) {
    return {
      configured: false,
      allowed: false,
      status: "quota_not_configured",
      limit,
      remainingGenerations: 0,
      resetAt: null,
      state: null,
    };
  }

  const cookieValue = parseCookies(cookieHeader)[SMART_PLANNER_QUOTA_COOKIE] || "";
  const decoded = decodeQuotaState(cookieValue, secret, now, limit);

  if (!decoded.valid) {
    return {
      configured: true,
      allowed: false,
      status: "quota_cookie_invalid",
      limit,
      remainingGenerations: 0,
      resetAt: null,
      state: null,
      invalidCookie: true,
      hasQuotaCookie: true,
    };
  }

  const resetAtMs = decoded.state.windowStartedAt + SMART_PLANNER_QUOTA_WINDOW_MS;
  return {
    configured: true,
    allowed: decoded.state.attemptsUsed < limit,
    status:
      decoded.state.attemptsUsed < limit ? "quota_available" : "daily_limit_reached",
    limit,
    remainingGenerations: Math.max(0, limit - decoded.state.attemptsUsed),
    resetAt: decoded.hadCookie ? new Date(resetAtMs).toISOString() : null,
    state: decoded.state,
    invalidCookie: false,
    hasQuotaCookie: decoded.hadCookie,
  };
}

export function consumeSmartPlannerQuota({
  cookieHeader = "",
  env = process.env,
  now = Date.now(),
} = {}) {
  const quota = readSmartPlannerQuota({ cookieHeader, env, now });
  const secret = getSmartPlannerUsageSecret(env);
  const production = isProductionRuntime(env);

  if (!quota.configured) return quota;

  if (quota.invalidCookie) {
    const exhaustedState = {
      version: 1,
      windowStartedAt: now,
      attemptsUsed: quota.limit,
    };
    return {
      ...quota,
      setCookie: serializeQuotaCookie(
        exhaustedState,
        secret,
        now,
        production
      ),
    };
  }

  if (!quota.allowed) return quota;

  const nextState = {
    ...quota.state,
    attemptsUsed: quota.state.attemptsUsed + 1,
  };
  const resetAtMs = nextState.windowStartedAt + SMART_PLANNER_QUOTA_WINDOW_MS;

  return {
    configured: true,
    allowed: true,
    status: "quota_consumed",
    limit: quota.limit,
    remainingGenerations: Math.max(0, quota.limit - nextState.attemptsUsed),
    resetAt: new Date(resetAtMs).toISOString(),
    state: nextState,
    invalidCookie: false,
    setCookie: serializeQuotaCookie(nextState, secret, now, production),
  };
}
