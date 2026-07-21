import { getGoogleClassroomOAuthConfigStatus } from "./_config.js";
import { createClassroomSessionCookie } from "./_session.js";

function getCallbackParam(request, name) {
  if (request.query && typeof request.query[name] === "string") {
    return request.query[name];
  }

  const callbackUrl = new URL(
    request.url || "",
    "https://student-hub.local"
  );

  return callbackUrl.searchParams.get(name);
}

function isDebugCallback(request) {
  return getCallbackParam(request, "debug") === "1";
}

function getCallbackRedirectLocation(classroomStatus, detailStatus = "") {
  const redirectParams = new URLSearchParams({
    settings: "integrations",
    classroom: classroomStatus,
  });

  if (detailStatus) {
    redirectParams.set("classroomStatus", detailStatus);
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
      payload.ok === true || payload.status === "courses_fetch_failed"
        ? "connected"
        : "error",
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

function getSafeGoogleError(googleResponse, fallbackMessage) {
  if (!googleResponse || typeof googleResponse !== "object") {
    return fallbackMessage;
  }

  return (
    googleResponse.error_description ||
    googleResponse.error?.message ||
    (typeof googleResponse.error === "string" ? googleResponse.error : "") ||
    fallbackMessage
  );
}

function normalizeClassroomCourse(course, lastSyncedAt) {
  return {
    source: "classroom",
    externalId: String(course?.id || ""),
    classroomCourseId: String(course?.id || ""),
    name: String(course?.name || "Untitled course"),
    section: String(course?.section || ""),
    description: String(course?.descriptionHeading || course?.description || ""),
    courseState: String(course?.courseState || ""),
    alternateLink: String(course?.alternateLink || ""),
    sourceUpdatedAt: String(course?.updateTime || ""),
    lastSyncedAt,
  };
}

export default async function handler(request, response) {
  // Safe OAuth proof only: exchange server-side, read courses once, discard tokens.
  const config = getGoogleClassroomOAuthConfigStatus();

  if (!config.configured) {
    sendCallbackResult(request, response, 501, {
      ok: false,
      status: "not_configured",
      configured: false,
      missingEnv: config.missingEnv,
      requiredEnv: config.requiredEnv,
      message: "Google Classroom OAuth callback is not configured yet.",
      nextStep:
        "Add the required environment variables in Vercel before implementing the callback.",
    });
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
      nextStep:
        "Review the Google OAuth response and try the authorization step again.",
    });
    return;
  }

  const authorizationCode = getCallbackParam(request, "code");

  if (authorizationCode) {
    let requestStage = "token_exchange";

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
          redirect_uri: process.env.GOOGLE_CLASSROOM_REDIRECT_URI,
          grant_type: "authorization_code",
        }),
      });
      const tokenJson = await readSafeJson(tokenResponse);

      if (!tokenResponse.ok) {
        sendCallbackResult(request, response, 400, {
          ok: false,
          status: "token_exchange_failed",
          configured: true,
          message: "Google OAuth token exchange failed.",
          googleError: getSafeGoogleError(
            tokenJson,
            "Google token endpoint rejected the authorization code."
          ),
          nextStep:
            "Start the authorization flow again or review the OAuth configuration.",
        });
        return;
      }

      if (typeof tokenJson?.access_token !== "string") {
        sendCallbackResult(request, response, 502, {
          ok: false,
          status: "token_exchange_failed",
          configured: true,
          message: "Google OAuth token exchange did not return an access token.",
          googleError: "Token endpoint returned an unexpected response.",
          nextStep:
            "Try the authorization flow again after checking the OAuth configuration.",
        });
        return;
      }

      requestStage = "session_create";

      const sessionCookie = createClassroomSessionCookie(tokenJson);

      response.setHeader("Set-Cookie", sessionCookie.cookie);

      requestStage = "courses_fetch";

      const coursesResponse = await fetch(
        "https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE",
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${tokenJson.access_token}`,
          },
        }
      );
      const coursesJson = await readSafeJson(coursesResponse);

      if (!coursesResponse.ok) {
        sendCallbackResult(request, response, 502, {
          ok: false,
          status: "courses_fetch_failed",
          configured: true,
          message:
            "Google OAuth worked, but Student Hub could not read Classroom courses.",
          googleError: getSafeGoogleError(
            coursesJson,
            "Google Classroom courses endpoint returned an unexpected response."
          ),
          nextStep:
            "Check Classroom permissions, scopes, and whether the selected Google account has Classroom access.",
        });
        return;
      }

      const lastSyncedAt = new Date().toISOString();
      const courses = Array.isArray(coursesJson?.courses)
        ? coursesJson.courses.map((course) =>
            normalizeClassroomCourse(course, lastSyncedAt)
          )
        : [];

      sendCallbackResult(request, response, 200, {
        ok: true,
        status: "classroom_session_created",
        configured: true,
        message:
          courses.length > 0
            ? "Google Classroom connection session was created securely for MVP testing."
            : "Google Classroom session was created, but no active courses were found for this account.",
        session: {
          storedIn: "encrypted_http_only_cookie",
          expiresAt: sessionCookie.expiresAt,
          hasRefreshToken: sessionCookie.hasRefreshToken,
        },
        courseSummary: {
          count: courses.length,
          returnedCourseStates: ["ACTIVE"],
        },
        courses,
        nextStep:
          "Store connection securely before showing courses inside the app.",
      });
    } catch {
      if (requestStage === "token_exchange") {
        sendCallbackResult(request, response, 502, {
          ok: false,
          status: "token_exchange_failed",
          configured: true,
          message: "Google OAuth token exchange could not be completed.",
          googleError: "Token endpoint request failed.",
          nextStep:
            "Try the authorization flow again after checking the serverless runtime.",
        });
      } else if (requestStage === "session_create") {
        sendCallbackResult(request, response, 501, {
          ok: false,
          status: "classroom_session_not_configured",
          configured: true,
          message:
            "Google OAuth worked, but Student Hub session encryption is not configured.",
          nextStep:
            "Add STUDENT_HUB_SESSION_SECRET in Vercel before creating Classroom sessions.",
        });
      } else {
        sendCallbackResult(request, response, 502, {
          ok: false,
          status: "courses_fetch_failed",
          configured: true,
          message:
            "Google OAuth worked, but Student Hub could not read Classroom courses.",
          googleError: "Classroom courses request failed.",
          nextStep:
            "Check Classroom permissions, scopes, and whether the selected Google account has Classroom access.",
        });
      }
    }
    return;
  }

  sendCallbackResult(request, response, 400, {
    ok: false,
    status: "missing_code",
    configured: true,
    message: "Google Classroom OAuth callback did not include a code.",
    nextStep: "Start the authorization redirect again from Student Hub.",
  });
}
