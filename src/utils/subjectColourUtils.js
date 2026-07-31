export const LEGACY_SUBJECT_COLOUR = "#2563eb";

export const SUBJECT_COLOUR_GROUPS = [
  {
    id: "technology",
    colour: "#5f7fc4",
    keywords: [
      "computer science",
      "information technology",
      "computing",
      "ict",
    ],
  },
  {
    id: "sport",
    colour: "#4f969d",
    keywords: [
      "physical education",
      "sports science",
      "sport science",
      "sports",
      "sport",
      "pe",
    ],
  },
  {
    id: "maths",
    colour: "#bd7075",
    keywords: [
      "mathematics",
      "statistics",
      "statistic",
      "geometry",
      "calculus",
      "algebra",
      "maths",
      "math",
    ],
  },
  {
    id: "english",
    colour: "#6699ce",
    keywords: ["language arts", "literature", "english"],
  },
  {
    id: "science",
    colour: "#579174",
    keywords: [
      "biology",
      "chemistry",
      "physics",
      "science",
      "bio",
      "chem",
    ],
  },
  {
    id: "business",
    colour: "#b78d45",
    keywords: ["economics", "accounting", "business", "econ"],
  },
  {
    id: "humanities",
    colour: "#8876bd",
    keywords: [
      "global politics",
      "government",
      "geography",
      "history",
      "politics",
    ],
  },
  {
    id: "creative",
    colour: "#b97898",
    keywords: ["theatre", "design", "drama", "music", "art"],
  },
];

export const SUBJECT_COLOUR_PALETTE = SUBJECT_COLOUR_GROUPS.map(
  (group) => group.colour
);

export function normalizeSubjectColourName(subjectName) {
  return typeof subjectName === "string"
    ? subjectName
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ")
    : "";
}

export function isValidSubjectColour(colour) {
  return /^#[0-9a-f]{6}$/i.test(String(colour || "").trim());
}

function includesKeyword(normalizedName, keyword) {
  return ` ${normalizedName} `.includes(` ${keyword} `);
}

export function getSubjectColourGroup(subjectName) {
  const normalizedName = normalizeSubjectColourName(subjectName);

  if (!normalizedName) return null;

  return (
    SUBJECT_COLOUR_GROUPS.find((group) =>
      group.keywords.some((keyword) => includesKeyword(normalizedName, keyword))
    ) || null
  );
}

function stableHash(value) {
  return Array.from(String(value || "")).reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    2166136261
  );
}

export function suggestSubjectColour(
  subjectName,
  existingSubjects = [],
  stableKey = ""
) {
  const matchedGroup = getSubjectColourGroup(subjectName);

  if (matchedGroup) return matchedGroup.colour;

  const usage = new Map(
    SUBJECT_COLOUR_PALETTE.map((colour) => [colour.toLowerCase(), 0])
  );

  existingSubjects.forEach((subject) => {
    const colour = String(subject?.colour || "").toLowerCase();

    if (usage.has(colour)) usage.set(colour, usage.get(colour) + 1);
  });

  const leastUsedCount = Math.min(...usage.values());
  const leastUsedColours = SUBJECT_COLOUR_PALETTE.filter(
    (colour) => usage.get(colour.toLowerCase()) === leastUsedCount
  );
  const tieBreakValue = `${normalizeSubjectColourName(subjectName)}|${stableKey}`;

  return leastUsedColours[stableHash(tieBreakValue) % leastUsedColours.length];
}

export function suggestSubjectDraftColour({
  subjectName,
  currentColour,
  existingSubjects = [],
  manuallySelected = false,
  stableKey = "new-subject",
}) {
  if (manuallySelected) return currentColour;

  if (getSubjectColourGroup(subjectName)) {
    return suggestSubjectColour(subjectName, existingSubjects, stableKey);
  }

  return isValidSubjectColour(currentColour)
    ? currentColour
    : suggestSubjectColour(subjectName, existingSubjects, stableKey);
}

export function shouldMigrateSubjectColour(colour) {
  const normalizedColour = String(colour || "").trim().toLowerCase();

  return (
    !isValidSubjectColour(normalizedColour) ||
    normalizedColour === LEGACY_SUBJECT_COLOUR
  );
}

export function migrateLegacySubjectColours(subjects = []) {
  const preservedSubjects = subjects.filter(
    (subject) => !shouldMigrateSubjectColour(subject?.colour)
  );
  const assignedSubjects = [...preservedSubjects];

  return subjects.map((subject, index) => {
    if (!shouldMigrateSubjectColour(subject?.colour)) return subject;

    const colour = suggestSubjectColour(
      subject?.name,
      assignedSubjects,
      subject?.id || `subject-${index}`
    );
    const migratedSubject = { ...subject, colour };

    assignedSubjects.push(migratedSubject);
    return migratedSubject;
  });
}
