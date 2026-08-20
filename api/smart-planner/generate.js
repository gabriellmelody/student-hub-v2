/* global process */

import {
  requestAnthropicPlan,
  validateSmartPlannerOutput,
  validateSmartPlannerRequest,
} from "../../server/smart-planner/planner.js";
import {
  consumeSmartPlannerQuota,
  readSmartPlannerQuota,
} from "../../server/smart-planner/quota.js";

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
    dailyLimit: quota.limit,
    resetAt: quota.resetAt,
  };
}

function getSmartPlannerStatus({ env, quota }) {
  if (!String(env.ANTHROPIC_API_KEY || "").trim()) {
    return {
      ok: true,
      configured: false,
      status: "unavailable",
      remainingGenerations: quota.remainingGenerations,
      dailyLimit: quota.limit,
      resetAt: quota.resetAt,
      basicPlannerAvailable: true,
    };
  }

  if (!quota.configured || quota.invalidCookie) {
    return {
      ok: true,
      configured: false,
      status: "configuration_error",
      remainingGenerations: quota.remainingGenerations,
      dailyLimit: quota.limit,
      resetAt: quota.resetAt,
      basicPlannerAvailable: true,
    };
  }

  return {
    ok: true,
    configured: true,
    status: quota.allowed ? "ready" : "daily_limit_reached",
    remainingGenerations: quota.remainingGenerations,
    dailyLimit: quota.limit,
    resetAt: quota.resetAt,
    basicPlannerAvailable: true,
  };
}

export function createSmartPlannerHandler({
  requestPlan,
  env = process.env,
  now = () => Date.now(),
  ipBuckets = ipAttemptBuckets,
  log = console,
} = {}) {
  return async function handler(request, response) {
    const startedAt = now();
    const providerRequest = requestPlan || ((input) => requestAnthropicPlan(input, { env, log }));
    log.info("smart-planner: request accepted", { action: request.body?.action === "status" ? "status" : "generate" });
    const validation = await validateSmartPlannerRequest(request, {
      allowStatus: true,
    });

    if (!validation.ok) {
      log.warn("smart-planner: input rejected", { status: validation.status, elapsedMs: now() - startedAt });
      return sendJson(response, validation.statusCode, {
        ok: false,
        configured: Boolean(String(env.ANTHROPIC_API_KEY || "").trim()),
        status: validation.status,
        message: validation.message,
      });
    }

    if (validation.action === "status") {
      const quotaSnapshot = readSmartPlannerQuota({
        cookieHeader: request.headers?.cookie || "",
        env,
        now: now(),
      });

      return sendJson(
        response,
        200,
        getSmartPlannerStatus({ env, quota: quotaSnapshot })
      );
    }

    const providerKeyConfigured = Boolean(String(env.ANTHROPIC_API_KEY || "").trim());
    if (!providerKeyConfigured) {
      log.warn("smart-planner: configuration missing", { variable: "ANTHROPIC_API_KEY", elapsedMs: now() - startedAt });
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

    // Reserve against the signed snapshot, but commit the cookie only after a
    // provider response passes Student Hub's strict validation.
    const quotaReservation = consumeSmartPlannerQuota({
      cookieHeader: request.headers?.cookie || "",
      env,
      now: requestTime,
    });

    if (!quotaReservation.allowed) {
      if (quotaReservation.setCookie) {
        response.setHeader("Set-Cookie", quotaReservation.setCookie);
      }
      const isDailyLimit = quotaReservation.status === "daily_limit_reached";
      return sendJson(response, 429, {
        ok: false,
        configured: true,
        status: isDailyLimit ? "daily_limit_reached" : "quota_cookie_invalid",
        message: isDailyLimit
          ? "Today’s Smart Planner limit has been reached. The Basic planner is still available."
          : "Smart Planner usage could not be verified. The Basic planner is still available.",
        ...quotaFields(quotaReservation),
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

    // Count only requests that are about to reach Anthropic.
    recordIpAttempt(ipSafeguard);
    log.info("smart-planner: input and usage validated", { elapsedMs: now() - startedAt });
    const providerResult = await providerRequest(validation.input);

    if (!providerResult.ok) {
      const statusCode = providerResult.status === "provider_timeout" ? 504 : 502;
      log.warn("smart-planner: provider stage failed", { status: providerResult.status, elapsedMs: now() - startedAt });
      return sendJson(response, statusCode, {
        ok: false,
        configured: true,
        status: providerResult.status,
        message: providerResult.message,
        ...quotaFields(quotaSnapshot),
      });
    }

    const planResult = validateSmartPlannerOutput(
      providerResult.output,
      validation.input
    );

    if (!planResult.ok) {
      log.warn("smart-planner: plan validation rejected", {
        category: /outside|referenced|overlapping|explain every/.test(planResult.message) ? "safety_validation_rejected" : "schema_invalid",
        reason: planResult.message,
        elapsedMs: now() - startedAt,
      });
      return sendJson(response, 502, {
        ok: false,
        configured: true,
        status: "ai_invalid",
        message: "Smart Planner could not build a safe plan this time.",
        ...quotaFields(quotaSnapshot),
      });
    }

    if (quotaReservation.setCookie) {
      response.setHeader("Set-Cookie", quotaReservation.setCookie);
    }

    log.info("smart-planner: success", { elapsedMs: now() - startedAt });

    return sendJson(response, 200, {
      ok: true,
      configured: true,
      status: "plan_ready",
      plan: planResult.plan,
      ...quotaFields(quotaReservation),
    });
  };
}

export default createSmartPlannerHandler();
