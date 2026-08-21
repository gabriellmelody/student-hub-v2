import { getGoogleCalendarOAuthConfigStatus } from "./_config.js";
import {
  clearCalendarSessionCookie,
  createCalendarSessionCookie,
  createCalendarSessionCookieFromTokenResponse,
  readCalendarSession,
} from "./_session.js";
import {
  exchangeGoogleAuthorizationCode,
  getGoogleAccountIdentity,
  validatePopupCodeExchangeRequest,
} from "../google-integrations/oauth-popup.js";
import { isGoogleIntegrationVaultError, loadGoogleIntegration, requireDayloUser, saveGoogleIntegration, verifyGoogleOAuthState } from "../google-integration-vault.js";

function getCallbackParam(request, name) {
  if (request.query && typeof request.query[name] === "string") {
    return request.query[name];
  }

  const callbackUrl = new URL(request.url || "", "https://student-hub.local");

  return callbackUrl.searchParams.get(name);
}

function isDebugCallback(request) {
  return getCallbackParam(request, "debug") === "1";
}

function getCallbackRedirectLocation(calendarStatus, detailStatus = "") {
  const redirectParams = new URLSearchParams({
    tab: "integrations",
    googleCalendar: calendarStatus,
  });

  if (detailStatus) {
    redirectParams.set("googleCalendarStatus", detailStatus);
  }

  return `/?${redirectParams.toString()}`;
}

function sendCallbackResult(request, response, statusCode, payload) {
  if (isDebugCallback(request)) {
    response.status(statusCode).json(payload);
    return;
  }

  response.writeHead(302, {
    Location: getCallbackRedirectLocation(
      payload.ok === true ? "connected" : "error",
      payload.status
    ),
  });
  response.end();
}

async function readSafeJson(fetchResponse) {
  try {
    return await fetchResponse.json();
  } catch {
    return null;
  }
}

async function handlePopupCodeExchange(request, response, config) {
  const validation = await validatePopupCodeExchangeRequest(request);

  if (!validation.ok) {
    response.status(validation.statusCode).json({
      ...validation.payload,
      provider: "google-calendar",
      configured: config.configured,
      connected: false,
    });
    return;
  }
  const auth = await requireDayloUser(request);
  const state = verifyGoogleOAuthState(validation.oauthState, "calendar");
  if (!auth.ok || !state || state.userId !== auth.userId) {
    response.status(401).json({ ok: false, status: "oauth_state_invalid", provider: "google-calendar", connected: false });
    return;
  }

  try {
    const tokenResult = await exchangeGoogleAuthorizationCode({
      code: validation.code,
      clientId: process.env.GOOGLE_CLASSROOM_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLASSROOM_CLIENT_SECRET,
      redirectUri: validation.redirectUri,
    });

    if (!tokenResult.ok) {
      response.status(400).json({
        ok: false,
        status: "token_exchange_failed",
        provider: "google-calendar",
        configured: true,
        connected: false,
        message: "Google Calendar connection could not be completed.",
      });
      return;
    }

    if (typeof tokenResult.json?.access_token !== "string") {
      response.status(502).json({
        ok: false,
        status: "token_exchange_failed",
        provider: "google-calendar",
        configured: true,
        connected: false,
        message: "Google Calendar connection returned an unexpected response.",
      });
      return;
    }

    const accountIdentity = await getGoogleAccountIdentity(tokenResult.json);

    if (!accountIdentity) {
      response.status(502).json({
        ok: false,
        status: "account_identity_unavailable",
        provider: "google-calendar",
        configured: true,
        connected: false,
        message:
          "Google did not share the account identity DayLo needs. Reconnect and allow the requested account information.",
      });
      return;
    }

    const existingVault = await loadGoogleIntegration(auth.userId, "calendar");
    const sessionCookie = createCalendarSessionCookieFromTokenResponse(
      tokenResult.json,
      existingVault?.session || null,
      accountIdentity
    );
    await saveGoogleIntegration(auth.userId, "calendar", sessionCookie.session);
    response.setHeader("Set-Cookie", clearCalendarSessionCookie());
    response.status(200).json({
      ok: true,
      status: "calendar_popup_session_created",
      provider: "google-calendar",
      configured: true,
      connected: true,
      message: "Google Calendar connected to your DayLo account.",
      accountChanged: sessionCookie.accountChanged,
      account: {
        id: sessionCookie.accountId,
        email: sessionCookie.accountEmail,
      },
      session: {
        storedIn: "server_account_vault",
        expiresAt: sessionCookie.expiresAt,
        sessionExpiresAt: sessionCookie.sessionExpiresAt,
        hasRefreshToken: sessionCookie.hasRefreshToken,
        reconnectMayBeRequired: !sessionCookie.hasRefreshToken,
      },
    });
  } catch (error) {
    if (isGoogleIntegrationVaultError(error)) {
      response.status(502).json({
        ok: false,
        status: error.code,
        provider: "google-calendar",
        configured: true,
        connected: false,
        message: "Google OAuth worked, but DayLo could not store the Calendar connection.",
      });
      return;
    }
    response.status(error?.message === "missing_session_secret" ? 501 : 502).json({
      ok: false,
      status:
        error?.message === "missing_session_secret"
          ? "calendar_session_not_configured"
          : "token_exchange_failed",
      provider: "google-calendar",
      configured: true,
      connected: false,
      message:
        error?.message === "missing_session_secret"
          ? "Google OAuth worked, but DayLo session encryption is not configured."
          : "Google Calendar connection could not be completed.",
    });
  }
}

export default async function handler(request, response) {
  const config = getGoogleCalendarOAuthConfigStatus();

  if (!config.configured) {
    sendCallbackResult(request, response, 501, {
      ok: false,
      status: "not_configured",
      configured: false,
      missingEnv: config.missingEnv,
      requiredEnv: config.requiredEnv,
      message: "Google Calendar OAuth callback is not configured yet.",
    });
    return;
  }

  if (request.method === "POST") {
    await handlePopupCodeExchange(request, response, config);
    return;
  }

  const oauthError = getCallbackParam(request, "error");

  if (oauthError) {
    sendCallbackResult(request, response, 400, {
      ok: false,
      status: "oauth_error",
      configured: true,
      error: oauthError,
      message: "Google returned an OAuth error.",
    });
    return;
  }

  const authorizationCode = getCallbackParam(request, "code");
  const state = verifyGoogleOAuthState(getCallbackParam(request, "state"), "calendar");

  if (!state) {
    sendCallbackResult(request, response, 400, { ok: false, status: "oauth_state_invalid", configured: true, message: "Google Calendar connection state expired or was invalid." });
    return;
  }

  if (!authorizationCode) {
    sendCallbackResult(request, response, 400, {
      ok: false,
      status: "missing_code",
      configured: true,
      message: "Google Calendar OAuth callback did not include a code.",
    });
    return;
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        code: authorizationCode,
        client_id: process.env.GOOGLE_CLASSROOM_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLASSROOM_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_CALENDAR_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    const tokenJson = await readSafeJson(tokenResponse);

    if (!tokenResponse.ok) {
      sendCallbackResult(request, response, 400, {
        ok: false,
        status: "token_exchange_failed",
        configured: true,
        message: "Google Calendar token exchange failed.",
        googleError: "Google rejected the authorization code.",
      });
      return;
    }

    if (typeof tokenJson?.access_token !== "string") {
      sendCallbackResult(request, response, 502, {
        ok: false,
        status: "token_exchange_failed",
        configured: true,
        message:
          "Google Calendar token exchange did not return an access token.",
        googleError: "Google returned an unexpected response.",
      });
      return;
    }

    const accountIdentity = await getGoogleAccountIdentity(tokenJson);

    if (!accountIdentity) {
      sendCallbackResult(request, response, 502, {
        ok: false,
        status: "account_identity_unavailable",
        configured: true,
        message:
          "Google did not share the account identity DayLo needs. Reconnect and allow the requested account information.",
      });
      return;
    }

    const existingVault = await loadGoogleIntegration(state.userId, "calendar");
    const sessionCookie = createCalendarSessionCookie(
      tokenJson,
      existingVault?.session || null,
      accountIdentity
    );
    await saveGoogleIntegration(state.userId, "calendar", sessionCookie.session);
    response.setHeader("Set-Cookie", clearCalendarSessionCookie());

    sendCallbackResult(request, response, 200, {
      ok: true,
      status: "calendar_session_created",
      configured: true,
      message: "Google Calendar connected for this browser.",
      accountChanged: sessionCookie.accountChanged,
      account: {
        id: sessionCookie.accountId,
        email: sessionCookie.accountEmail,
      },
      session: {
        storedIn: "server_account_vault",
        expiresAt: sessionCookie.expiresAt,
        hasRefreshToken: sessionCookie.hasRefreshToken,
        reconnectMayBeRequired: !sessionCookie.hasRefreshToken,
      },
    });
  } catch (error) {
    if (isGoogleIntegrationVaultError(error)) {
      sendCallbackResult(request, response, 502, {
        ok: false,
        status: error.code,
        configured: true,
        message: "Google OAuth worked, but DayLo could not store the Calendar connection.",
      });
      return;
    }
    sendCallbackResult(request, response, 502, {
      ok: false,
      status:
        error?.message === "missing_session_secret"
          ? "calendar_session_not_configured"
          : "token_exchange_failed",
      configured: true,
      message:
        error?.message === "missing_session_secret"
          ? "Google OAuth worked, but DayLo session encryption is not configured."
          : "Google Calendar token exchange could not be completed.",
    });
  }
}
