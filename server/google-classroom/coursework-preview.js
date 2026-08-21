import { getValidClassroomSession } from "./_session.js";

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

function getClassroomStatusCategory({ dueDate, submission }) {
  const submissionState = safeString(submission?.state).toUpperCase();
  const late = submission?.late === true;

  if (submissionState === "TURNED_IN") return "done";
  if (submissionState === "RETURNED") return "returned";
  if (late) return "missing";
  if (!dueDate) return "no_due_date";
  if (
    ["NEW", "CREATED", "RECLAIMED_BY_STUDENT", ""].includes(submissionState)
  ) {
    return "active";
  }

  return "unknown";
}

function safeReturnedGrade(value, submissionState) {
  const numericValue = Number(value);

  return submissionState === "RETURNED" && Number.isFinite(numericValue)
    ? numericValue
    : null;
}

function normalizeCourseworkItem(course, coursework, submission = null) {
  const courseworkId = safeString(coursework?.id);
  const dueDate = formatGoogleDate(coursework?.dueDate);
  const submissionState = safeString(submission?.state).toUpperCase();
  const classroomStatusCategory = getClassroomStatusCategory({
    dueDate,
    submission,
  });

  return {
    source: "classroom",
    externalId: `${course.classroomCourseId}:${courseworkId}`,
    classroomCourseId: course.classroomCourseId,
    classroomCourseName: course.classroomCourseName,
    linkedSubjectId: course.linkedSubjectId,
    linkedSubjectName: course.linkedSubjectName,
    title: safeString(coursework?.title, "Untitled assignment"),
    description: safeString(coursework?.description),
    dueDate,
    dueTime: formatGoogleTime(coursework?.dueTime),
    alternateLink: safeString(coursework?.alternateLink),
    state: safeString(coursework?.state),
    workType: safeString(coursework?.workType),
    creationTime: safeString(coursework?.creationTime),
    updateTime: safeString(coursework?.updateTime),
    submissionId: safeString(submission?.id),
    submissionState,
    late: submission?.late === true,
    assignedGrade: safeReturnedGrade(submission?.assignedGrade, submissionState),
    draftGrade: safeReturnedGrade(submission?.draftGrade, submissionState),
    submissionUpdatedAt: safeString(submission?.updateTime),
    classroomStatusCategory,
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
            ? "DayLo does not have permission to read Classroom coursework. Reconnect Google Classroom and approve coursework access."
            : `DayLo could not read coursework for ${course.classroomCourseName || "one class"}.`,
        googleError: getSafeGoogleError(
          courseworkJson,
          "Google Classroom coursework endpoint returned an unexpected response."
        ),
      };
    }

    if (Array.isArray(courseworkJson?.courseWork)) {
      coursework.push(...courseworkJson.courseWork);
    }

    pageToken = safeString(courseworkJson?.nextPageToken);
  } while (pageToken);

  return {
    ok: true,
    coursework,
  };
}

async function fetchStudentSubmissionsForCourse(course, accessToken) {
  const submissions = [];
  let pageToken = "";

  do {
    const submissionsUrl = new URL(
      `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(
        course.classroomCourseId
      )}/courseWork/-/studentSubmissions`
    );

    submissionsUrl.searchParams.set("userId", "me");
    submissionsUrl.searchParams.set("pageSize", "100");
    if (pageToken) submissionsUrl.searchParams.set("pageToken", pageToken);

    const submissionsResponse = await fetch(submissionsUrl.toString(), {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const submissionsJson = await readSafeJson(submissionsResponse);

    if (!submissionsResponse.ok) {
      return {
        ok: false,
        status:
          submissionsResponse.status === 403
            ? "classroom_submission_status_permission_error"
            : "student_submissions_fetch_failed",
        message:
          submissionsResponse.status === 403
            ? "DayLo can read assignments but not submission status yet. Reconnect Google Classroom or check school permissions."
            : `DayLo could not read submission status for ${course.classroomCourseName || "one class"}.`,
        googleError: getSafeGoogleError(
          submissionsJson,
          "Google Classroom student submissions endpoint returned an unexpected response."
        ),
      };
    }

    if (Array.isArray(submissionsJson?.studentSubmissions)) {
      submissions.push(...submissionsJson.studentSubmissions);
    }

    pageToken = safeString(submissionsJson?.nextPageToken);
  } while (pageToken);

  return {
    ok: true,
    submissions,
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

  const sessionResult = await getValidClassroomSession(request);

  if (sessionResult.status === "no_classroom_session") {
    response.status(sessionResult.connected ? 503 : 401).json({
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
      status: sessionResult.status || "classroom_session_invalid_or_expired",
      connected: sessionResult.connected === true,
      message: sessionResult.connected ? "Google Classroom is temporarily unavailable." : "Reconnect Google Classroom.",
    });
    return;
  }

  if (sessionResult.cookie) response.setHeader("Set-Cookie", sessionResult.cookie);

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

      const submissionsResult = await fetchStudentSubmissionsForCourse(
        course,
        sessionResult.session.access_token
      );

      if (!submissionsResult.ok) {
        response
          .status(
            submissionsResult.status === "classroom_submission_status_permission_error"
              ? 403
              : 502
          )
          .json({
            ok: false,
            status: submissionsResult.status,
            connected: true,
            message: submissionsResult.message,
            googleError: submissionsResult.googleError,
          });
        return;
      }

      const submissionByCourseworkId = new Map(
        submissionsResult.submissions
          .filter((submission) => safeString(submission?.courseWorkId))
          .map((submission) => [safeString(submission.courseWorkId), submission])
      );

      previewItems.push(
        ...courseResult.coursework.map((coursework) =>
          normalizeCourseworkItem(
            course,
            coursework,
            submissionByCourseworkId.get(safeString(coursework?.id)) || null
          )
        )
      );
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
          ? "Google Classroom assignments were loaded as a read-only preview. No DayLo tasks were created."
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
      message: "DayLo could not preview Classroom assignments.",
      googleError: "Classroom coursework request failed.",
    });
  }
}
