/* global process */

import {
  requestAnthropicPlan,
  validateSmartPlannerOutput,
  validateSmartPlannerRequest,
} from "./_planner.js";
import {
  consumeSmartPlannerQuota,
  readSmartPlannerQuota,
} from "./_quota.js";

const BURST_WINDOW_MS = 60 * 1000;
const BURST_MAX_ATTEMPTS = 6;
const DAILY_IP_WINDOW_MS = 24 * 60 * 60 * 1000;
const DAILY_IP_MAX_ATTEMPTS = 60;
const IP_PRUNE_INTERVAL_MS = 5 * 60 * 1000;
const ipAttemptBuckets = new Map();
let lastIpPruneAt = 0;

function sendJson(response, statusCode, payload) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  return response.status(statusCode).json(payload);
}

function getRequestIp(request) {
  return String(
    request.headers?.["x-forwarded-for"] ||
      request.socket?.remoteAddress ||
      "unknown"
  )
    .split(",")[0]
    .trim()
    .slice(0, 80);
}

function pruneIpBuckets(now, buckets) {
  if (now - lastIpPruneAt < IP_PRUNE_INTERVAL_MS) return;

  for (const [requestIp, bucket] of buckets.entries()) {
    if (now - bucket.lastSeenAt >= DAILY_IP_WINDOW_MS) {
      buckets.delete(requestIp);
    }
  }
  lastIpPruneAt = now;
}

function getCurrentIpBucket(requestIp, now, buckets) {
  const current = buckets.get(requestIp);
  const bucket = current || {
    burstStartedAt: now,
    burstAttempts: 0,
    dailyStartedAt: now,
    dailyAttempts: 0,
    lastSeenAt: now,
  };

  if (now - bucket.burstStartedAt >= BURST_WINDOW_MS) {
    bucket.burstStartedAt = now;
    bucket.burstAttempts = 0;
  }
  if (now - bucket.dailyStartedAt >= DAILY_IP_WINDOW_MS) {
    bucket.dailyStartedAt = now;
    bucket.dailyAttempts = 0;
  }
  bucket.lastSeenAt = now;
  buckets.set(requestIp, bucket);
  return bucket;
}

function checkIpSafeguard(request, now, buckets) {
  pruneIpBuckets(now, buckets);
  const requestIp = getRequestIp(request);
  const bucket = getCurrentIpBucket(requestIp, now, buckets);

  if (bucket.burstAttempts >= BURST_MAX_ATTEMPTS) {
    return { allowed: false, status: "rate_limited" };
  }
  if (bucket.dailyAttempts >= DAILY_IP_MAX_ATTEMPTS) {
    return { allowed: false, status: "daily_network_limit_reached" };
  }
  return { allowed: true, requestIp, bucket };
}

function recordIpAttempt(safeguard) {
  safeguard.bucket.burstAttempts += 1;
  safeguard.bucket.dailyAttempts += 1;
}

function quotaFields(quota) {
  return {
    remainingGenerations: quota.remainingGenerations,
    resetAt: quota.resetAt,
  };
}

export function createSmartPlannerHandler({
  requestPlan = requestAnthropicPlan,
  env = process.env,
  now = () => Date.now(),
  ipBuckets = ipAttemptBuckets,
} = {}) {
  return async function handler(request, response) {
    const validation = await validateSmartPlannerRequest(request);

    if (!validation.ok) {
      return sendJson(response, validation.statusCode, {
        ok: false,
        configured: Boolean(env.ANTHROPIC_API_KEY),
        status: validation.status,
        message: validation.message,
      });
    }

    if (!env.ANTHROPIC_API_KEY) {
      return sendJson(response, 503, {
        ok: false,
        configured: false,
        status: "not_configured",
        message:
          "Smart Planner is not configured yet. You can still use the Basic planner.",
      });
    }

    const requestTime = now();
    const quotaSnapshot = readSmartPlannerQuota({
      cookieHeader: request.headers?.cookie || "",
      env,
      now: requestTime,
    });

    if (!quotaSnapshot.configured) {
      return sendJson(response, 503, {
        ok: false,
        configured: false,
        status: "quota_not_configured",
        message:
          "Smart Planner usage controls are not configured. The Basic planner is still available.",
        ...quotaFields(quotaSnapshot),
      });
    }

    const ipSafeguard = checkIpSafeguard(
      request,
      requestTime,
      ipBuckets
    );
    if (!ipSafeguard.allowed) {
      return sendJson(response, 429, {
        ok: false,
        configured: true,
        status: ipSafeguard.status,
        message:
          "Smart Planner is busy on this network. Try again later or use the Basic planner.",
        ...quotaFields(quotaSnapshot),
      });
    }

    const quota = consumeSmartPlannerQuota({
      cookieHeader: request.headers?.cookie || "",
      env,
      now: requestTime,
    });

    if (quota.setCookie) response.setHeader("Set-Cookie", quota.setCookie);

    if (!quota.allowed) {
      const isDailyLimit = quota.status === "daily_limit_reached";
      return sendJson(response, 429, {
        ok: false,
        configured: true,
        status: isDailyLimit ? "daily_limit_reached" : "quota_cookie_invalid",
        message: isDailyLimit
          ? "Today’s Smart Planner limit has been reached. The Basic planner is still available."
          : "Smart Planner usage could not be verified. The Basic planner is still available.",
        ...quotaFields(quota),
      });
    }

    // Count only requests that are about to reach Anthropic.
    recordIpAttempt(ipSafeguard);
    const providerResult = await requestPlan(validation.input);

    if (!providerResult.ok) {
      return sendJson(response, 503, {
        ok: false,
        configured: true,
        status: providerResult.status,
        message: providerResult.message,
        ...quotaFields(quota),
      });
    }

    const planResult = validateSmartPlannerOutput(
      providerResult.output,
      validation.input
    );

    if (!planResult.ok) {
      return sendJson(response, 502, {
        ok: false,
        configured: true,
        status: "ai_invalid",
        message: "Smart Planner could not build a safe plan this time.",
        ...quotaFields(quota),
      });
    }

    return sendJson(response, 200, {
      ok: true,
      configured: true,
      status: "plan_ready",
      plan: planResult.plan,
      ...quotaFields(quota),
    });
  };
}

export default createSmartPlannerHandler();
