import test from "node:test";
import assert from "node:assert/strict";
import {
  LEGACY_SUBJECT_COLOUR,
  SUBJECT_COLOUR_PALETTE,
  getSubjectColourGroup,
  isValidSubjectColour,
  migrateLegacySubjectColours,
  suggestSubjectColour,
  suggestSubjectDraftColour,
} from "./subjectColourUtils.js";

test("Maths and Math use the same colour family", () => {
  assert.equal(getSubjectColourGroup("Maths")?.id, "maths");
  assert.equal(getSubjectColourGroup("Math")?.id, "maths");
  assert.equal(suggestSubjectColour("Maths"), suggestSubjectColour("Math"));
});

test("common science names use the science family", () => {
  ["Biology", "Bio", "Chemistry", "Chem", "Physics"].forEach((name) => {
    assert.equal(getSubjectColourGroup(name)?.id, "science");
  });
});

test("English uses the English family", () => {
  assert.equal(getSubjectColourGroup("English")?.id, "english");
});

test("matching ignores case, extra spaces, and punctuation", () => {
  assert.equal(getSubjectColourGroup("  GLOBAL--Politics!! ")?.id, "humanities");
  assert.equal(getSubjectColourGroup("computer...SCIENCE")?.id, "technology");
});

test("unknown Subjects receive a valid curated colour", () => {
  const colour = suggestSubjectColour("Theory of Knowledge");

  assert.equal(isValidSubjectColour(colour), true);
  assert.equal(SUBJECT_COLOUR_PALETTE.includes(colour), true);
});

test("unknown Subjects prefer a least-used colour", () => {
  const heavilyUsedColour = SUBJECT_COLOUR_PALETTE[0];
  const existingSubjects = Array.from({ length: 5 }, (_, index) => ({
    id: `subject-${index}`,
    colour: heavilyUsedColour,
  }));

  assert.notEqual(
    suggestSubjectColour("Theory of Knowledge", existingSubjects),
    heavilyUsedColour
  );
});

test("fallback selection is deterministic", () => {
  const subjects = [{ colour: SUBJECT_COLOUR_PALETTE[2] }];
  const first = suggestSubjectColour("Media Studies", subjects, "course-42");
  const second = suggestSubjectColour("Media Studies", subjects, "course-42");

  assert.equal(first, second);
});

test("manual draft colours remain unchanged while the name changes", () => {
  const customColour = "#123456";

  assert.equal(
    suggestSubjectDraftColour({
      subjectName: "Biology",
      currentColour: customColour,
      manuallySelected: true,
    }),
    customColour
  );
});

test("editing a Subject name preserves its saved colour", () => {
  const savedColour = "#765432";

  assert.equal(
    suggestSubjectDraftColour({
      subjectName: "Renamed Subject",
      currentColour: savedColour,
      manuallySelected: true,
    }),
    savedColour
  );
});

test("only missing, invalid, or exact legacy-blue colours migrate", () => {
  const customColour = "#123456";
  const migrated = migrateLegacySubjectColours([
    { id: "missing", name: "English" },
    { id: "invalid", name: "History", colour: "blue" },
    { id: "legacy", name: "Maths", colour: LEGACY_SUBJECT_COLOUR },
    { id: "custom", name: "Art", colour: customColour },
  ]);

  assert.notEqual(migrated[0].colour, undefined);
  assert.notEqual(migrated[1].colour, "blue");
  assert.notEqual(migrated[2].colour.toLowerCase(), LEGACY_SUBJECT_COLOUR);
  assert.equal(migrated[3].colour, customColour);
});

test("existing custom colours are never migrated", () => {
  const subject = { id: "custom", name: "Biology", colour: "#abcdef" };
  const [migrated] = migrateLegacySubjectColours([subject]);

  assert.equal(migrated, subject);
  assert.equal(migrated.colour, "#abcdef");
});

test("multiple legacy-blue Subjects receive varied colours where possible", () => {
  const migrated = migrateLegacySubjectColours(
    ["Bio", "Chem", "English", "Maths", "History"].map((name, index) => ({
      id: `subject-${index}`,
      name,
      colour: LEGACY_SUBJECT_COLOUR,
    }))
  );
  const colours = new Set(migrated.map((subject) => subject.colour));

  assert.ok(colours.size >= 4);
  assert.equal(
    migrated.some(
      (subject) => subject.colour.toLowerCase() === LEGACY_SUBJECT_COLOUR
    ),
    false
  );
});
