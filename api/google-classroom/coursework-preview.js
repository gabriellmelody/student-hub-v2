import { readClassroomSession } from "./_session.js";

const MAX_PREVIEW_COURSES = 40;

async function readRequestJson(request) {
  if (request.body && typeof request.body === "object") return request.body;

  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      return null;
    }
  }

  if (typeof request.on !== "function") return null;

  return new Promise((resolve) => {
    let body = "";

    request.on?.("data", (chunk) => {
      body += chunk;
    });
    request.on?.("end", () => {
      try {
        resolve(body ? JSON.parse(body) : null);
      } catch {
        resolve(null);
      }
    });
    request.on?.("error", () => resolve(null));
  });
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

function safeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeCourseInput(course) {
  const courseId = safeString(course?.classroomCourseId || course?.externalId);

  if (!courseId) return null;

  return {
    classroomCourseId: courseId,
    classroomCourseName: safeString(course?.classroomCourseName || course?.name),
    linkedSubjectId: safeString(course?.linkedSubjectId),
    linkedSubjectName: safeString(course?.linkedSubjectName),
  };
}

function formatGoogleDate(dateValue) {
  const year = Number(dateValue?.year);
  const month = Number(dateValue?.month);
  const day = Number(dateValue?.day);

  if (!year || !month || !day) return "";

  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function formatGoogleTime(timeValue) {
  if (!timeValue || typeof timeValue !== "object") return "";

  const hours = Number(timeValue.hours || 0);
  const minutes = Number(timeValue.minutes || 0);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return "";

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function normalizeCourseworkItem(course, coursework) {
  const courseworkId = safeString(coursework?.id);

  return {
    source: "classroom",
    externalId: `${course.classroomCourseId}:${courseworkId}`,
    classroomCourseId: course.classroomCourseId,
    classroomCourseName: course.classroomCourseName,
    linkedSubjectId: course.linkedSubjectId,
    linkedSubjectName: course.linkedSubjectName,
    title: safeString(coursework?.title, "Untitled assignment"),
    description: safeString(coursework?.description),
    dueDate: formatGoogleDate(coursework?.dueDate),
    dueTime: formatGoogleTime(coursework?.dueTime),
    alternateLink: safeString(coursework?.alternateLink),
    state: safeString(coursework?.state),
    workType: safeString(coursework?.workType),
    creationTime: safeString(coursework?.creationTime),
    updateTime: safeString(coursework?.updateTime),
  };
}

async function fetchCourseworkForCourse(course, accessToken) {
  const coursework = [];
  let pageToken = "";

  do {
    const courseworkUrl = new URL(
      `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(
        course.classroomCourseId
      )}/courseWork`
    );

    courseworkUrl.searchParams.set("pageSize", "100");
    if (pageToken) courseworkUrl.searchParams.set("pageToken", pageToken);

    const courseworkResponse = await fetch(courseworkUrl.toString(), {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const courseworkJson = await readSafeJson(courseworkResponse);

    if (!courseworkResponse.ok) {
      return {
        ok: false,
        status:
          courseworkResponse.status === 403
            ? "classroom_coursework_permission_error"
            : "coursework_fetch_failed",
        message:
          courseworkResponse.status === 403
            ? "Student Hub does not have permission to read Classroom coursework. Reconnect Google Classroom and approve coursework access."
            : `Student Hub could not read coursework for ${course.classroomCourseName || "one class"}.`,
        googleError: getSafeGoogleError(
          courseworkJson,
          "Google Classroom coursework endpoint returned an unexpected response."
        ),
      };
    }

    if (Array.isArray(courseworkJson?.courseWork)) {
      coursework.push(
        ...courseworkJson.courseWork.map((item) =>
          normalizeCourseworkItem(course, item)
        )
      );
    }

    pageToken = safeString(courseworkJson?.nextPageToken);
  } while (pageToken);

  return {
    ok: true,
    coursework,
  };
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({
      ok: false,
      status: "method_not_allowed",
      message: "Use POST to preview Google Classroom coursework.",
    });
    return;
  }

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

  const requestBody = await readRequestJson(request);
  const includedCourses = Array.isArray(requestBody?.courses)
    ? requestBody.courses
        .map(normalizeCourseInput)
        .filter(Boolean)
        .slice(0, MAX_PREVIEW_COURSES)
    : [];

  if (includedCourses.length === 0) {
    response.status(400).json({
      ok: false,
      status: "no_included_classes",
      connected: true,
      message: "Choose at least one included Classroom class first.",
    });
    return;
  }

  try {
    const previewedAt = new Date().toISOString();
    const previewItems = [];

    for (const course of includedCourses) {
      const courseResult = await fetchCourseworkForCourse(
        course,
        sessionResult.session.access_token
      );

      if (!courseResult.ok) {
        response
          .status(
            courseResult.status === "classroom_coursework_permission_error"
              ? 403
              : 502
          )
          .json({
            ok: false,
            status: courseResult.status,
            connected: true,
            message: courseResult.message,
            googleError: courseResult.googleError,
          });
        return;
      }

      previewItems.push(...courseResult.coursework);
    }

    previewItems.sort((left, right) => {
      if (!left.dueDate) return 1;
      if (!right.dueDate) return -1;
      return `${left.dueDate} ${left.dueTime}`.localeCompare(
        `${right.dueDate} ${right.dueTime}`
      );
    });

    response.status(200).json({
      ok: true,
      status:
        previewItems.length > 0
          ? "coursework_preview_loaded"
          : "no_coursework_found",
      connected: true,
      message:
        previewItems.length > 0
          ? "Google Classroom assignments were loaded as a read-only preview. No Student Hub tasks were created."
          : "No coursework was found for the included Classroom classes.",
      previewSummary: {
        includedCourseCount: includedCourses.length,
        assignmentCount: previewItems.length,
        previewedAt,
      },
      assignments: previewItems,
    });
  } catch {
    response.status(502).json({
      ok: false,
      status: "coursework_fetch_failed",
      connected: true,
      message: "Student Hub could not preview Classroom assignments.",
      googleError: "Classroom coursework request failed.",
    });
  }
}
