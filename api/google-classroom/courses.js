import { readClassroomSession } from "./_session.js";

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
  const sessionResult = readClassroomSession(request);

  if (sessionResult.status === "no_classroom_session") {
    response.status(401).json({
      ok: false,
      status: "no_classroom_session",
      connected: false,
      message: "No Google Classroom session is available yet.",
    });
    return;
  }

  if (!sessionResult.ok) {
    response.status(401).json({
      ok: false,
      status: "classroom_session_invalid_or_expired",
      connected: false,
      message: "Google Classroom session is invalid or expired. Connect again.",
    });
    return;
  }

  try {
    const coursesResponse = await fetch(
      "https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE",
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${sessionResult.session.access_token}`,
        },
      }
    );
    const coursesJson = await readSafeJson(coursesResponse);

    if (!coursesResponse.ok) {
      response.status(502).json({
        ok: false,
        status: "courses_fetch_failed",
        connected: true,
        message: "DayLo could not read Classroom courses.",
        googleError: getSafeGoogleError(
          coursesJson,
          "Google Classroom courses endpoint returned an unexpected response."
        ),
      });
      return;
    }

    const lastSyncedAt = new Date().toISOString();
    const courses = Array.isArray(coursesJson?.courses)
      ? coursesJson.courses.map((course) =>
          normalizeClassroomCourse(course, lastSyncedAt)
        )
      : [];

    response.status(200).json({
      ok: true,
      status: "courses_read_from_session",
      connected: true,
      message:
        courses.length > 0
          ? "Google Classroom active courses were read from the secure session."
          : "Google Classroom connected, but no active courses were found for this account.",
      courseSummary: {
        count: courses.length,
        returnedCourseStates: ["ACTIVE"],
      },
      courses,
    });
  } catch {
    response.status(502).json({
      ok: false,
      status: "courses_fetch_failed",
      connected: true,
      message: "DayLo could not read Classroom courses.",
      googleError: "Classroom courses request failed.",
    });
  }
}
