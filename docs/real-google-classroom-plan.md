# Real Google Classroom Integration Plan

## Prototype 3 Goal

Student Hub should eventually connect to a student's real Google Classroom account, read school classes and assignments, and turn them into normal Student Hub tasks. The real integration should build on the current Sample Classroom foundation without changing the core task, calendar, subject, or planning model.

This document is planning only. Real Google Classroom is not connected yet.

## 1. Current Mock System

Student Hub currently has a local Sample Classroom flow that proves the shape of the future integration:

- A Sample Classroom connection can be linked in local demo mode.
- Sample assignments can sync into normal Student Hub tasks.
- Imported sample tasks use source badges so students can see where they came from.
- Imported sample tasks can be safely removed without deleting manual tasks.
- Sample courses can be mapped to existing Student Hub Subject Profiles.
- Future synced/imported tasks from a mapped sample course use the linked subject.

The task model already has future-ready fields:

- `source`
- `externalId`
- `classroomCourseId`
- `classroomCourseName`
- `importedAt`
- `sourceUpdatedAt`
- `lastSyncedAt`

Duplicate prevention already follows the right idea: imported Classroom-style tasks are identified by `source + externalId`. For Sample Classroom, `source` is currently `classroom-mock`. For real Classroom, the app should use a separate source such as `classroom`.

Course-to-subject mapping is also future-ready. A Classroom course can be linked to a Student Hub Subject Profile, then imported assignments from that course can inherit the subject name. This prepares the Subjects page, Calendar, To-do list, and Today's Plan to organise imported schoolwork without needing a separate Classroom-only task system.

## 2. Future Real Google Classroom Flow

The intended real flow should feel simple:

1. The student opens Settings > Integrations.
2. They choose Connect Google Classroom.
3. Google shows a sign-in and permission screen.
4. Student Hub reads the student's Classroom courses/classes.
5. Student Hub reads assignments/coursework from those courses.
6. Assignments are converted into normal Student Hub tasks.
7. Student Hub syncs updates later through a clear Sync now action or scheduled sync if accounts/cloud sync are added.

The main experience should not be manual assignment picking. Once connected, Classroom assignments should flow into the normal Student Hub workspace:

- To-do list
- Calendar
- Subjects
- Today's Plan
- Home widgets
- Side Panel widgets

Manual tasks and imported tasks should coexist.

## 3. Authentication Approach

Student Hub should not casually store Google access tokens in localStorage. Browser localStorage is convenient for Prototype 2 local data, but it is not the right place for long-lived Google credentials.

Safer future options:

- Firebase Auth with Google sign-in, if Student Hub adopts Firebase for accounts and cloud sync.
- A small backend or serverless layer that handles OAuth securely and stores refresh tokens server-side.
- Short-lived browser tokens only when needed, with careful expiry handling.

Recommended direction:

Use a small serverless/backend layer or Firebase Auth before connecting real Google Classroom. This keeps OAuth secrets, refresh tokens, and token refresh logic out of the client app.

This plan does not add auth, OAuth, Firebase, API keys, or backend code.

## 4. Data Model

### Classroom Courses

Future course records should include:

- `source: "classroom"`
- `externalId`
- `classroomCourseId`
- `name`
- `section`
- `description`
- `teacherName` if available and useful
- `sourceUpdatedAt`
- `lastSyncedAt`

Student Hub should keep course-to-subject links separate from imported tasks:

- `classroomCourseId`
- `classroomCourseName`
- `subjectId`
- `subjectName`
- `source: "classroom"`
- `linkedAt`

### Classroom Assignments

Future assignment display/import objects should include:

- `source: "classroom"`
- `externalId`
- `classroomCourseId`
- `classroomCourseName`
- `title`
- `description`
- `dueAt`
- `dueDate`
- `sourceUpdatedAt`
- `alternateLink` if useful later
- `linkedSubjectId` if a course mapping exists

### Student Hub Task Output

Imported assignments should become normal tasks with:

- `source: "classroom"`
- `externalId: assignment.id`
- `classroomCourseId`
- `classroomCourseName`
- `subject` from linked Student Hub subject if available
- `title`
- `description`
- `dueDate`
- `effort`
- `taskType`
- `importance`
- `detectedTags`
- `importanceSource`
- `importedAt`
- `sourceUpdatedAt`
- `lastSyncedAt`

Assessment detection should still run on imported assignments so words like test, quiz, exam, summative, and formative can influence badges, sorting, and planning.

## 5. Sync Rules

Sync should be conservative and protect student work.

### Import New Assignments

- If no existing task has the same `source + externalId`, create a new task.
- Use course-to-subject mapping to set the task subject.
- Preserve Classroom metadata for future updates.

### Update Changed Assignments

- If an imported Classroom task exists and Classroom `sourceUpdatedAt` is newer, update safe fields.
- Safe fields may include Classroom title, description, due date, course metadata, and source update time.
- Avoid overwriting student-controlled fields after manual edits where sensible.

Fields that may need manual-edit protection:

- task title if the student renamed it
- effort
- task type
- importance
- subject if the student manually changed it outside course mapping
- notes/custom planning fields

The app may need an `editedFields` or `manualOverrides` structure later.

### Avoid Duplicates

- Use `source + externalId` as the primary duplicate key.
- Never use title alone as the duplicate key.
- If a Classroom assignment changes title, it should update the existing imported task rather than create a second task.

### Preserve Manual Tasks

- Never delete or overwrite tasks with `source: "manual"`.
- Never delete demo tasks unless a specific demo cleanup action is used.
- Never delete Sample Classroom tasks when syncing real Classroom unless explicitly part of a sample cleanup action.

### Removed or Missing Classroom Assignments

If an assignment disappears from Classroom:

- Do not immediately delete the Student Hub task.
- Mark it as missing/archived from source if needed.
- Consider showing a gentle status like "No longer found in Classroom" later.
- Let the student decide whether to remove it.

## 6. UI Flow

The Integrations page should stay the control centre.

Google Classroom card should eventually support:

- Connect
- Connected status
- Change account
- Sync now
- Last synced
- Imported assignment count
- Linked course count
- Unlink

Subject mapping should remain compact:

- Show each Classroom course.
- Show whether it is linked to a Student Hub subject.
- Allow choosing an existing subject.
- Allow Unassigned / No subject.
- Optionally allow creating a subject from a course.

The main Classroom integration should not become a huge assignment selection page. Student Hub should import assignments into the normal workspace and let students manage them in To-do, Calendar, Subjects, and Today's Plan.

Unlink should be safe:

- Explain that disconnecting Google Classroom does not delete manual tasks.
- Default to keeping imported tasks unless the student intentionally removes them.
- If a remove-imported-Classroom-tasks action exists, it must only target tasks with `source: "classroom"`.

## 7. Risks And Decisions Still Needed

Important decisions before implementation:

- Auth provider: Firebase Auth, custom OAuth backend, or another secure provider.
- Backend/serverless layer: whether Vercel functions or another backend will handle Google token exchange and refresh.
- Google API scopes: use the narrowest scopes possible for reading courses and coursework.
- Token storage: avoid storing refresh tokens in localStorage.
- Privacy and data handling: explain clearly what Classroom data is read and where it is stored.
- Deployment environment variables: store client IDs, secrets, and callback URLs securely.
- User accounts/cloud sync: decide whether tasks remain device-local or sync to an account.
- Sync conflicts: decide how to protect manual edits when Classroom data changes.
- Rate limits and error states: handle Google API failures calmly.

## 8. Suggested Implementation Phases

### Phase 1: Architecture And Environment Setup Plan

- Finalise auth approach.
- Choose backend/serverless strategy.
- Decide Google API scopes.
- Define environment variables and deployment requirements.
- Confirm data model for real Classroom source records.

### Phase 2: Auth Proof Of Concept

- Add a development-only Google sign-in proof of concept.
- Request only the minimum scopes needed.
- Confirm token handling is not done casually in localStorage.
- Keep this behind a clear prototype flag until safe.

### Phase 3: Read-Only Courses

- Fetch Google Classroom courses.
- Display them in the Integrations page.
- Keep them separate from Sample Classroom.
- Add real course-to-subject mapping using the same pattern as Sample Classroom.

### Phase 4: Read-Only Assignments Import

- Fetch coursework/assignments for connected courses.
- Convert assignments into Student Hub task-shaped objects.
- Import new assignments as normal tasks with `source: "classroom"`.
- Preserve `source + externalId` duplicate prevention.

### Phase 5: Sync And Update Rules

- Add Sync now for real Classroom.
- Update changed imported assignments carefully.
- Preserve manual edits where sensible.
- Handle missing/removed Classroom assignments without surprise deletion.
- Add clear status and error messages.

### Phase 6: Polish UI And Error Handling

- Polish connection, account, sync, and unlink states.
- Add friendly messages for permission errors and sync failures.
- Make source badges and Classroom status feel consistent.
- Update Help / FAQ so it clearly separates available features from coming-soon and planned-later features.

## Prototype 2 And 3 Features That Must Stay Stable

Real Classroom work must not break:

- manual tasks
- assessment and importance detection
- task sorting
- completed task history
- local task Calendar
- Subjects and subject colours
- Today's Plan
- saved, custom, lockable, editable, and draggable plan blocks
- Home widgets
- Side Panel widgets
- Sample Classroom link/sync
- Sample Classroom source badges
- Sample Classroom course-to-subject mapping
- safe removal of Sample Classroom imported tasks
- demo workspace
- Data & reset
- appearance settings
- sidebar account menu
- responsive layout
## Recommended First Implementation Choice

For the first real Google Classroom prototype, Student Hub should use a small Vercel serverless backend rather than adding full Firebase/cloud sync immediately.

Reason:
- Student Hub is already deployed on Vercel.
- The first goal is read-only Classroom import, not full accounts or cloud sync.
- Serverless functions can handle OAuth callback/token exchange more safely than the browser alone.
- This avoids storing Google refresh tokens casually in localStorage.
- Firebase/Auth can still be added later if Student Hub needs full accounts, multi-device sync, or persistent user profiles.

Initial real integration should remain read-only:
- read Classroom courses
- read coursework/assignments
- convert them into Student Hub tasks
- sync updates manually through “Sync now”
