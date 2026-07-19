# Google Classroom MVP Checklist

This checklist turns the real Google Classroom architecture plan into a practical build order for Student Hub.

Real Google Classroom is not active yet. This document is planning only.

## MVP Direction

Use Vercel serverless functions first, not full Firebase or cloud sync.

Why:

- Student Hub is already deployed on Vercel.
- The first real goal is read-only Classroom import.
- Full accounts and cloud sync can come later.
- Google tokens should not be casually stored in localStorage.
- A small serverless layer can keep client secrets and token exchange away from the browser.

## 1. Pre-Build Decisions

Confirm these before writing auth code:

- [ ] Google Cloud project selected or created.
- [ ] OAuth consent screen configured.
- [ ] App name and support email are correct.
- [ ] Local development callback URL confirmed.
- [ ] Vercel production callback URL confirmed.
- [ ] Minimum read-only Google Classroom scopes confirmed.
- [ ] Token handling approach confirmed.
- [ ] Environment variable names confirmed.
- [ ] No Google secrets planned for browser-exposed Vite variables.

Likely environment variables:

- [ ] `GOOGLE_CLASSROOM_CLIENT_ID`
- [ ] `GOOGLE_CLASSROOM_CLIENT_SECRET`
- [ ] `GOOGLE_CLASSROOM_REDIRECT_URI`
- [ ] `GOOGLE_CLASSROOM_SCOPES`
- [ ] Optional server-side session or token encryption secret if needed.

Current readiness note:

- Placeholder Vercel endpoints now check whether the future required Google Classroom OAuth variables are present.
- The connect endpoint can now start the first safe authorization redirect to Google's permission screen when configuration exists.
- The callback can confirm that Google returned a code, but it still does not exchange or store tokens.
- These checks do not activate Classroom API calls, assignment import, token exchange, or token storage.
- Real values must never be committed to the repo.
- Add the values through Vercel environment variables later, after the auth approach is reviewed.

Recommended first scopes:

- [ ] Read Classroom courses.
- [ ] Read Classroom coursework.

Keep scopes narrow. Do not request write permissions for the MVP.

Stop and review before:

- adding OAuth code
- storing tokens
- pushing Vercel environment variables
- requesting broad Google scopes

## 2. Phase 1: Serverless OAuth Skeleton

Goal: prove that the app can start and complete the Google OAuth flow safely, without importing tasks yet.

Implementation checklist:

- [ ] Create a serverless connect endpoint.
- [ ] Create a serverless callback endpoint.
- [ ] Generate the Google authorization URL server-side.
- [ ] Redirect the student to Google's permission screen.
- [ ] Handle the returned authorization code in the callback endpoint.
- [ ] Exchange the auth code for tokens server-side.
- [ ] Do not expose `GOOGLE_CLIENT_SECRET` to the browser.
- [ ] Do not store Google tokens in localStorage.
- [ ] Return a simple connected state to the app.
- [ ] Show honest UI wording: Google Classroom connected for read-only import.
- [ ] Do not import assignments yet.

Manual tests:

- [ ] Connect button opens Google permission screen.
- [ ] Callback returns to Student Hub.
- [ ] Browser console has no token leaks.
- [ ] Network responses do not expose client secret.
- [ ] Refreshing the app does not pretend to be connected unless connection state is actually available.
- [ ] Unauthorised or cancelled sign-in shows a calm error state.

Stop and review before:

- persisting refresh tokens
- adding any task import logic
- adding broad account/session behavior

## 3. Phase 2: Read Courses Only

Goal: read Classroom courses/classes and show them in Integrations.

Implementation checklist:

- [ ] Add serverless endpoint for reading Classroom courses.
- [ ] Fetch courses using server-side token handling.
- [ ] Normalise course data into Student Hub course objects.
- [ ] Keep real Classroom data separate from Sample Classroom data.
- [ ] Show connected status in Integrations.
- [ ] List real Classroom courses in Integrations.
- [ ] Show last fetched time if available.
- [ ] Show clear empty state if no courses are returned.
- [ ] Do not import assignments yet.

Course fields to keep:

- [ ] `source: "classroom"`
- [ ] `externalId`
- [ ] `classroomCourseId`
- [ ] `name`
- [ ] `section`
- [ ] `description`
- [ ] `sourceUpdatedAt`
- [ ] `lastSyncedAt`

Manual tests:

- [ ] Connected Classroom courses appear.
- [ ] Sample Classroom courses still work separately.
- [ ] Refreshing the Integrations page does not duplicate course rows.
- [ ] Course names with extra spaces still display cleanly.
- [ ] No tasks are created in this phase.

Stop and review before:

- saving course data permanently
- changing the task model
- mixing real and sample course mappings

## 4. Phase 3: Course-To-Subject Mapping For Real Classroom

Goal: reuse the Sample Classroom mapping idea for real Classroom courses.

Implementation checklist:

- [ ] Add real Classroom course mapping records.
- [ ] Keep mapping source separate from sample: `source: "classroom"`.
- [ ] Auto-match obvious subjects by normalised name.
- [ ] Allow choosing an existing Student Hub subject.
- [ ] Include Unassigned / No subject.
- [ ] Optionally allow creating a subject from a real Classroom course.
- [ ] Do not overwrite existing subjects.
- [ ] Keep Sample Classroom mapping unchanged.

Mapping fields:

- [ ] `classroomCourseId`
- [ ] `classroomCourseName`
- [ ] `subjectId`
- [ ] `subjectName`
- [ ] `source: "classroom"`
- [ ] `linkedAt`

Manual tests:

- [ ] Course can link to an existing subject.
- [ ] Course can be changed to a different subject.
- [ ] Course can be set to Unassigned / No subject.
- [ ] Sample Classroom mappings are not changed.
- [ ] Subjects page still works.

Stop and review before:

- updating imported task subjects automatically
- creating subjects from real Classroom courses
- changing existing Sample Classroom mapping storage

## 5. Phase 4: Read Coursework / Assignments

Goal: fetch assignments and convert them into task-shaped preview objects.

Implementation checklist:

- [ ] Add serverless endpoint for reading coursework.
- [ ] Fetch coursework by course.
- [ ] Normalise due dates safely.
- [ ] Preserve missing due dates without crashing.
- [ ] Preserve descriptions if useful.
- [ ] Preserve update timestamps.
- [ ] Convert assignments into Student Hub task-shaped preview objects.
- [ ] Show preview in Integrations.
- [ ] Do not automatically import until preview output is correct.

Assignment preview fields:

- [ ] `source: "classroom"`
- [ ] `externalId`
- [ ] `classroomCourseId`
- [ ] `classroomCourseName`
- [ ] `title`
- [ ] `description`
- [ ] `dueAt`
- [ ] `dueDate`
- [ ] `sourceUpdatedAt`
- [ ] `linkedSubjectId`

Manual tests:

- [ ] Assignments appear grouped by course.
- [ ] Due dates display correctly.
- [ ] Assignments without due dates do not break the UI.
- [ ] Assessment words are visible in titles/descriptions for later detection.
- [ ] No tasks are created until import is intentionally enabled.

Stop and review before:

- creating real Student Hub tasks
- auto-importing all assignments
- modifying assessment detection

## 6. Phase 5: Import Assignments As Student Hub Tasks

Goal: convert real Classroom assignments into normal Student Hub tasks.

Implementation checklist:

- [ ] Use `source: "classroom"`.
- [ ] Use `source + externalId` duplicate prevention.
- [ ] Create new tasks only when no matching imported task exists.
- [ ] Preserve manual tasks.
- [ ] Apply course-to-subject mapping.
- [ ] Run existing assessment and importance detection.
- [ ] Preserve Classroom metadata on imported tasks.
- [ ] Add source badge for real Classroom tasks if not already covered.

Task fields:

- [ ] `source: "classroom"`
- [ ] `externalId`
- [ ] `classroomCourseId`
- [ ] `classroomCourseName`
- [ ] `subject`
- [ ] `title`
- [ ] `description`
- [ ] `dueDate`
- [ ] `effort`
- [ ] `taskType`
- [ ] `importance`
- [ ] `detectedTags`
- [ ] `importanceSource`
- [ ] `importedAt`
- [ ] `sourceUpdatedAt`
- [ ] `lastSyncedAt`

Manual tests:

- [ ] Imported Classroom tasks appear in To-do.
- [ ] Imported Classroom due dates appear in Calendar.
- [ ] Linked subjects show imported tasks in Subjects.
- [ ] Imported assessment tasks show assessment badges.
- [ ] Today's Plan can include imported Classroom tasks.
- [ ] Running import twice does not create duplicates.
- [ ] Manual tasks are unchanged.

Stop and review before:

- updating existing imported tasks
- changing duplicate detection
- changing task sorting or planner behavior

## 7. Phase 6: Sync Now And Update Rules

Goal: safely sync new and changed Classroom assignments.

Implementation checklist:

- [ ] Add Sync now for real Classroom.
- [ ] Import new assignments.
- [ ] Update safe fields for existing imported tasks.
- [ ] Protect manual edits where sensible.
- [ ] Update `lastSyncedAt`.
- [ ] Update imported assignment counts.
- [ ] Show success/error feedback.
- [ ] Never delete manual tasks.
- [ ] Do not automatically delete imported tasks just because Classroom data is missing.

Safe fields to consider updating:

- [ ] `classroomCourseId`
- [ ] `classroomCourseName`
- [ ] `sourceUpdatedAt`
- [ ] `lastSyncedAt`
- [ ] due date, if the student has not manually changed it
- [ ] title/description, if the student has not manually edited them

Manual tests:

- [ ] Sync imports new assignments.
- [ ] Sync skips unchanged assignments.
- [ ] Sync updates a changed due date safely.
- [ ] Sync does not overwrite manual tasks.
- [ ] Sync does not duplicate tasks after title changes.
- [ ] Sync handles Google API errors calmly.

Stop and review before:

- adding automatic deletion
- overwriting student-edited task fields
- running sync automatically in the background

## 8. Phase 7: Unlink And Cleanup

Goal: disconnect real Classroom safely.

Implementation checklist:

- [ ] Add Unlink Google Classroom action.
- [ ] Use a confirmation modal.
- [ ] Explain that manual tasks will be kept.
- [ ] Keep imported Classroom tasks by default.
- [ ] Add a separate Remove imported Classroom tasks action.
- [ ] Only remove tasks with `source: "classroom"`.
- [ ] Do not remove Sample Classroom tasks unless the Sample cleanup action is used.
- [ ] Do not remove manual tasks.
- [ ] Clear only real Classroom connection state.
- [ ] Clear or preserve course mappings based on clear wording.

Manual tests:

- [ ] Unlink disconnects the real Classroom connection.
- [ ] Imported tasks remain by default.
- [ ] Remove imported Classroom tasks removes only `source: "classroom"` tasks.
- [ ] Manual tasks remain.
- [ ] Sample Classroom tasks remain unless using sample cleanup.
- [ ] To-do, Calendar, Subjects, and Today's Plan do not crash after cleanup.

Stop and review before:

- removing imported tasks automatically during unlink
- clearing all integration data
- touching Data & reset behavior

## Risks And Stop Signs

Stop and ask for review before:

- [ ] adding OAuth implementation code
- [ ] storing Google tokens anywhere
- [ ] adding or changing backend/serverless auth behavior
- [ ] changing the Student Hub task data model
- [ ] changing duplicate detection beyond `source + externalId`
- [ ] adding automatic task deletion
- [ ] overwriting manual task edits during sync
- [ ] pushing environment variables to Vercel
- [ ] requesting broader Google API scopes
- [ ] adding account/cloud sync behavior

High-risk areas:

- token storage
- Google consent screen wording
- callback URL mismatch between local and production
- accidental duplicate imports
- accidental deletion of manual tasks
- mixing Sample Classroom and real Classroom sources
- overwriting student-edited task details

## Full Manual Test Checklist

Before calling the MVP stable, test:

- [ ] App loads with no Classroom connection.
- [ ] Existing manual tasks still appear.
- [ ] Sample Classroom still links and syncs separately.
- [ ] Real Classroom connect starts the auth flow.
- [ ] Cancelled auth shows a calm error.
- [ ] Connected status appears only after a real successful callback.
- [ ] Courses load read-only.
- [ ] Course-to-subject mapping works.
- [ ] Assignment preview loads read-only.
- [ ] Import creates normal Student Hub tasks.
- [ ] Imported tasks have `source: "classroom"`.
- [ ] Duplicate import is prevented by `source + externalId`.
- [ ] Imported tasks appear in To-do.
- [ ] Imported due dates appear in Calendar.
- [ ] Imported linked-subject tasks appear in Subjects.
- [ ] Assessment detection works for imported tests, quizzes, exams, summatives, and formatives.
- [ ] Today's Plan can include imported tasks.
- [ ] Sync now imports new assignments.
- [ ] Sync now updates safe fields.
- [ ] Sync now preserves manual edits where intended.
- [ ] Unlink keeps imported tasks by default.
- [ ] Remove imported Classroom tasks removes only real Classroom imported tasks.
- [ ] Manual tasks are never deleted.
- [ ] Sample Classroom imported tasks are not removed by real Classroom cleanup.
- [ ] Data & reset still works.
- [ ] Help / FAQ remains honest that Google Classroom is only active after real integration work is complete.
