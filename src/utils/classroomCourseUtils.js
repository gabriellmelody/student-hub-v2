import {
  createSubjectDraft,
  findSubjectProfile,
  normalizeSubjectName,
} from "./appUtils.js";
import {
  isValidSubjectColour,
  suggestSubjectColour,
} from "./subjectColourUtils.js";

export const REAL_CLASSROOM_SOURCE = "classroom";

const COMMON_CLASSROOM_SUBJECTS = [
  ["world studies", "World Studies"],
  ["computer science", "Computer Science"],
  ["biology", "Biology"],
  ["chemistry", "Chemistry"],
  ["physics", "Physics"],
  ["english", "English"],
  ["spanish", "Spanish"],
  ["history", "History"],
  ["geography", "Geography"],
  ["economics", "Economics"],
  ["maths", "Maths"],
  ["math", "Maths"],
  ["science", "Science"],
  ["art", "Art"],
  ["music", "Music"],
  ["drama", "Drama"],
  ["design", "Design"],
];

export function getRealClassroomCourseId(course) {
  return course?.classroomCourseId || course?.externalId || "";
}

function normalizeClassroomMatchText(value) {
  return normalizeSubjectName(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function hasClassroomSubjectPhrase(courseName, subjectName) {
  const courseText = ` ${normalizeClassroomMatchText(courseName)} `;
  const subjectText = normalizeClassroomMatchText(subjectName);

  if (!courseText.trim() || !subjectText) return false;

  const aliases =
    subjectText === "maths"
      ? ["maths", "math"]
      : subjectText === "math"
        ? ["math", "maths"]
        : [subjectText];

  return aliases.some((alias) => courseText.includes(` ${alias} `));
}

export function findBestSubjectForClassroomCourse(subjects, course) {
  const exactSubject = findSubjectProfile(subjects, course?.name);

  if (exactSubject) return exactSubject;

  return (
    subjects.find((subject) =>
      hasClassroomSubjectPhrase(course?.name, subject.name)
    ) || null
  );
}

export function getSuggestedClassroomSubjectName(course) {
  const courseName = course?.name || "";
  const matchedCommonSubject = COMMON_CLASSROOM_SUBJECTS.find(([keyword]) =>
    hasClassroomSubjectPhrase(courseName, keyword)
  );

  if (matchedCommonSubject) return matchedCommonSubject[1];

  return courseName.trim() || "Untitled Subject";
}

export function createRealClassroomCourseLink(course, subject, now = new Date()) {
  return {
    classroomCourseId: getRealClassroomCourseId(course),
    classroomCourseName: course?.name || "Untitled class",
    subjectId: subject.id,
    subjectName: subject.name,
    source: REAL_CLASSROOM_SOURCE,
    linkedAt: now.toISOString(),
  };
}

export function createSubjectFromRealClassroomCourse(
  course,
  existingSubjects,
  now = new Date()
) {
  const courseId = getRealClassroomCourseId(course);
  const subjectName = getSuggestedClassroomSubjectName(course);
  const explicitCourseColour = course?.colour || course?.color;

  return {
    id: `subject-${REAL_CLASSROOM_SOURCE}-${courseId}`,
    ...createSubjectDraft("Other", existingSubjects, subjectName),
    name: subjectName,
    courseSystem: "Other",
    level: "Other",
    colour: isValidSubjectColour(explicitCourseColour)
      ? explicitCourseColour
      : suggestSubjectColour(subjectName, existingSubjects, courseId),
    source: REAL_CLASSROOM_SOURCE,
    classroomCourseId: courseId,
    externalId: courseId,
    importedAt: now.toISOString(),
    lastSyncedAt: null,
  };
}
