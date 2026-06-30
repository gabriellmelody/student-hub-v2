# Student Hub Prototype 3 Plan

## Status

Planning document only. Prototype 3 functionality is not active yet.

Prototype 2 is the stable baseline. New work must be introduced in small,
testable stages without changing or deleting existing local data.

## Prototype 3 Goal

Add a smart school layer that can bring assignments into the existing task,
subject, calendar, and planning flows. Start with deterministic local mock data,
then add AI-assisted planning, and only connect real external services after the
local contracts, migrations, duplicate handling, and recovery paths are proven.

Prototype 3 should help a student answer:

- What school work has arrived?
- Which subject and deadline does it belong to?
- What should I work on next, and why?
- Is the suggested plan using my workload and grade goals sensibly?

## Features Included

### Classroom import foundation

- A local mock Classroom source with clearly marked sample classes and
  assignments.
- A review step before imported assignments become tasks.
- Imported classes matched or linked to existing Subject Profiles.
- Imported assignment due dates shown through the existing local Calendar.
- Deterministic duplicate detection and repeat-import safety.
- Clear source metadata so manual, demo, and imported records remain distinct.

### AI planner v1

- Suggestions based only on data already stored in Student Hub.
- Inputs may include due date, effort, task importance, assessment type,
  subject, available time, current grade, and target grade.
- Explanations for why a task was prioritised.
- User review before a suggestion changes Today's Plan.
- Existing manual edits, custom blocks, locks, and drag ordering remain in the
  user's control.

### School calendar and subject insights

- A unified local event shape that can represent tasks now and imported school
  items later.
- Clear source labels and links back to the original task or assignment.
- Subject-level workload and assessment summaries using local data.
- Grade-aware planning that is understandable and bounded, not a hidden score.

## Features Not Included Yet

- Real Google Classroom authentication or API access.
- Real Google Calendar connection or calendar write-back.
- Gmail or email import.
- Accounts, authentication, cloud sync, or multi-device storage.
- A backend, database, server-side jobs, or notifications.
- Automatic task or plan changes without user review.
- Fully autonomous AI, chat, generated grades, or claims about learning outcomes.
- A separate Grades page.

No API keys, OAuth credentials, connection buttons, or fake AI responses should
be added during the local foundation stages.

## Data Contracts

Extend existing records instead of creating a second task, subject, calendar,
or plan system. New fields must be optional and normalised when data is loaded.

### Imported assignment

Recommended source record before conversion to a task:

```js
{
  id: "mock-assignment-id",
  externalId: "stable-source-id",
  source: "classroom-mock",
  courseId: "mock-course-id",
  title: "Cell biology assessment",
  description: "",
  dueAt: "2026-07-10T15:00:00.000Z",
  updatedAt: "2026-07-01T10:00:00.000Z",
  state: "published"
}
```

### Imported task metadata

Imported assignments should become normal Student Hub tasks with additional,
optional provenance fields:

```js
{
  source: "classroom-mock",
  externalId: "stable-source-id",
  classroomCourseId: "mock-course-id",
  importedAt: 1782900000000,
  sourceUpdatedAt: "2026-07-01T10:00:00.000Z"
}
```

The existing task fields remain authoritative for task display, completion,
sorting, assessment detection, and planning. A later real connector may use
`source: "classroom"`, but mock records must never pretend to be real imports.

### Calendar event

Calendar adapters should output one local display shape:

```js
{
  id: "task:task-id",
  source: "task",
  sourceId: "task-id",
  subjectId: null,
  title: "Cell biology assessment",
  startsAt: null,
  dueAt: "2026-07-10T15:00:00.000Z",
  allDay: true
}
```

Calendar data should be derived from tasks and source records. Do not store a
second editable copy of the same deadline.

## Recommended Build Order

Each stage should ship behind local-only data and pass its checklist before the
next stage begins.

### 1. Mock Classroom import using local/sample data

- Add a small fixture set with stable source IDs.
- Clearly label all records as mock data.
- Add parsing and normalisation utilities with unit-testable inputs and outputs.
- Keep imported records separate until the user reviews them.

### 2. Imported assignments become tasks

- Convert approved mock assignments through the existing task creation path.
- Preserve task defaults, assessment detection, manual overrides, and source
  metadata.
- Confirm imported tasks work everywhere a manual task works.

### 3. Imported classes connect to subjects

- Match exact normalised names first.
- Let the user confirm uncertain matches or create a new Subject Profile.
- Store a stable course-to-subject link without renaming existing subjects.

### 4. Imported due dates appear in Calendar

- Reuse the current task-to-calendar adapter.
- Preserve timezone information at the import boundary.
- Keep local task due dates as the displayed source of truth.

### 5. Duplicate detection for imported assignments

- Primary key: source plus external assignment ID.
- Secondary warning: same normalised title, subject/course, and due date.
- Re-imports update safe source fields instead of creating another task.
- Never overwrite a user's manual title, importance, completion, or plan edits
  without a review step.

### 6. AI planner v1 using local task/subject data

- Define a versioned, deterministic planner input object.
- Start with recommendation output, not automatic plan replacement.
- Show the factors behind each recommendation.
- Validate missing subjects, missing grades, no deadlines, and empty workspaces.

### 7. Grade-aware planning

- Treat current and target grades as optional signals.
- Bound their effect so urgency and due dates still matter.
- Never infer a grade that the user did not enter.
- Explain when a grade gap changes a recommendation.

### 8. Real Google Classroom connection later

- Add OAuth only after mock import, duplicate handling, and migrations are stable.
- Request the minimum scopes required.
- Add disconnect, re-authentication, error, and partial-sync states.
- Keep a review step for imported changes.

### 9. School calendar / Google Calendar connection later

- Begin read-only and school-focused.
- Keep personal calendar events outside Student Hub unless the user explicitly
  opts into a future supported scope.
- Resolve timezone, recurrence, cancellation, and duplicate rules before any
  calendar write-back is considered.

## Risks and Safeguards

| Risk | Safeguard |
| --- | --- |
| Duplicate assignments | Stable external IDs, source-aware keys, and secondary duplicate warnings. |
| Existing local data is overwritten | Optional fields, load-time normalisation, versioned migrations, and fixture-based migration tests. |
| Imported and manual tasks diverge | One task model and one task creation/update path. |
| Subject matching is wrong | Exact matching first and user confirmation for ambiguous links. |
| Due dates shift across timezones | Parse at the boundary, retain source timestamps, and test local-day conversion. |
| AI priorities feel unpredictable | Bounded signals, visible reasons, and review before applying a plan. |
| Grade data dominates planning | Make grades optional and cap their influence below urgent deadline rules. |
| Locked or edited blocks are replaced | Treat locks and user edits as protected constraints. |
| External access is broader than expected | Minimum OAuth scopes, clear consent, and a disconnect path. |
| Prototype 3 appears active too early | Keep mock, coming-soon, and planned-later labels explicit. |

## Testing Checklist

### Data and migrations

- [ ] A fresh workspace starts clean.
- [ ] Existing Prototype 2 localStorage loads without changes or data loss.
- [ ] Older tasks, subjects, history, widgets, and saved plans normalise safely.
- [ ] Mock import does not duplicate records when run twice.
- [ ] Removing mock/imported data does not remove manual or demo data.
- [ ] Data & reset removes every new Student Hub key intentionally.

### Imported task flow

- [ ] An approved assignment becomes exactly one normal task.
- [ ] Source and external IDs survive refresh.
- [ ] Assessment detection and manual importance overrides still work.
- [ ] Editing, sorting, completing, deleting, and 24-hour expiry still work.
- [ ] Completed history does not create duplicate records.

### Subjects and calendar

- [ ] Confirmed course links survive refresh.
- [ ] Existing typed task subjects remain valid.
- [ ] Imported due dates appear on the correct local calendar day.
- [ ] Empty, missing, invalid, and timezone-edge due dates do not crash.
- [ ] Home and Side Panel calendar previews match the full Calendar.

### Planning

- [ ] Imported tasks participate in the existing planner like manual tasks.
- [ ] AI suggestions never apply without user confirmation.
- [ ] Due date, urgency, importance, and effort remain understandable.
- [ ] Missing grades do not block planning.
- [ ] Custom, edited, locked, removed, and dragged blocks remain intact.
- [ ] Saved Today's Plan restores with the same order and links.

### UI and accessibility

- [ ] Unfinished integrations are labelled Coming soon or Planned later.
- [ ] Mock data is clearly marked and never presented as a live connection.
- [ ] Loading, empty, partial, duplicate, offline, and error states are readable.
- [ ] Keyboard use, focus states, reduced motion, and modal dismissal still work.
- [ ] Light/dark themes, both density modes, and custom accents remain legible.
- [ ] Laptop, half-screen, tablet, and phone layouts have no horizontal overflow.
- [ ] Production build, lint, and browser console checks pass.

## Prototype 2 Stability Contract

The following behavior must remain stable throughout Prototype 3:

- First-time onboarding and restart onboarding.
- Manual and demo task add, edit, delete, complete, sort, and expiry behavior.
- Assessment/importance detection and manual overrides.
- Subject Profiles, Subjects Hub, subject colours, and completed history.
- Local task Calendar and adding tasks from a selected calendar date.
- Today's Plan generation, save/restore, clear/start-fresh flow, and time
  recalculation.
- Custom, editable, removable, lockable, and draggable plan blocks.
- Home normal/edit modes and widget visibility, size, and ordering.
- Side Panel normal/edit modes and widget visibility, ordering, and collapse.
- Demo workspace loading/removal and all Data & reset actions.
- Help / FAQ feature statuses and honest future-feature wording.
- LocalStorage keys and safe migrations.
- Light/dark theme, accent colour, density, responsive layout, and animations.

## Definition of Ready for Real Integrations

Real Google work may begin only when:

- The mock import path has stable fixtures and repeatable tests.
- Import preview, subject linking, and duplicate handling are proven locally.
- New storage fields have backward-compatible migrations and reset coverage.
- Calendar timezone behavior is tested.
- AI planner inputs and explanations are versioned and reviewable.
- No Prototype 2 regression remains open.
- The UI still states that external services are not connected until a real,
  authenticated connection succeeds.
