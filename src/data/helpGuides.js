export const helpTopics = [
  {
    id: "getting-started",
    title: "Getting started",
    summary: "Set up your school work and build a useful plan for today.",
    tourId: "getting-started",
    sections: [
      {
        title: "Set up your workspace",
        bullets: [
          "Add assignments yourself or import selected work from Google Classroom.",
          "Set current and target grades in each Subject profile.",
          "Connect Google Calendar if you want plans to work around lessons, meetings or activities.",
        ],
      },
      {
        title: "Create today’s plan",
        bullets: [
          "Open Plan to review today’s study recommendations.",
          "Use task deadlines and your study routine to decide what to work on.",
          "Adjust your plan as your day changes.",
        ],
      },
      {
        title: "Keep it useful",
        paragraphs: [
          "Complete work and update tasks as your day changes. Accurate deadlines, effort and plan information lead to better suggestions.",
        ],
      },
      {
        title: "Optional connections",
        paragraphs: [
          "Classroom and Calendar are optional. DayLo’s task and planning tools remain available without either connection.",
        ],
      },
    ],
  },
  {
    id: "todo-assignments",
    title: "To-do and assignments",
    summary: "Add, organise and complete school work in one place.",
    tourId: "todo",
    sections: [
      {
        title: "Add work",
        paragraphs: [
          "Add tasks manually or import selected Google Classroom assignments. Classroom imports keep a source badge so you can see where they came from.",
        ],
      },
      {
        title: "Organise the list",
        paragraphs: [
          "Use Priority, Effort, Due date and Subject views to scan active work. Keep effort and deadlines accurate because planning quality depends on them.",
        ],
      },
      {
        title: "Understand signals",
        paragraphs: [
          "Due and overdue labels show timing. Assessments such as tests, essays and projects remain distinct from ordinary tasks.",
        ],
      },
      {
        title: "Update tasks",
        paragraphs: [
          "You can edit, complete or delete tasks. Overdue work is not silently removed just because its due date has passed.",
        ],
      },
      {
        title: "Completed work",
        paragraphs: [
          "Recently completed work appears in completed views and Subject history according to DayLo’s existing retention behaviour.",
        ],
      },
    ],
  },
  {
    id: "google-classroom-setup",
    title: "Google Classroom setup",
    summary: "Connect Classroom, choose classes and import selected assignments.",
    tourId: "google-classroom-setup",
    sections: [
      {
        title: "Connect and choose classes",
        paragraphs: [
          "Connect your Google account, load active classes, then include only the classes you want DayLo to use.",
        ],
      },
      {
        title: "Link Subjects",
        paragraphs: [
          "Link each included class to an existing DayLo Subject or create one from the class name.",
        ],
      },
      {
        title: "Review before import",
        paragraphs: [
          "Preview assignments and select the work you want. Only selected assignments become tasks.",
        ],
      },
    ],
  },
  {
    id: "subjects-grades",
    title: "Subjects and grade targets",
    summary: "Organise classes and give planning useful academic context.",
    tourId: "subjects",
    sections: [
      {
        title: "Subject profiles",
        paragraphs: [
          "A Subject represents one class or course. Profiles can include a course system, level, colour, current grade and target grade.",
        ],
      },
      {
        title: "Manage Subjects",
        paragraphs: [
          "Add or edit Subject profiles in Settings. Tasks appear under a Subject when their assigned Subject matches that profile.",
        ],
      },
      {
        title: "How grades affect planning",
        paragraphs: [
          "Current and target grades are a secondary planning signal. Urgent deadlines, overdue work, assessments and Calendar commitments still come first.",
        ],
      },
      {
        title: "Use grades carefully",
        paragraphs: [
          "Being at your target does not make a Subject disappear from planning. Grades should reflect your own current understanding and do not guarantee an outcome.",
        ],
      },
    ],
  },
  {
    id: "calendar-busy-time",
    title: "Calendar and busy time",
    summary: "See deadlines beside real events and protect time you are already using.",
    tourId: "calendar",
    sections: [
      {
        title: "DayLo tasks",
        paragraphs: [
          "Tasks are work with deadlines. They appear as assignment indicators and can be used in To-do and planning.",
        ],
      },
      {
        title: "Google Calendar events",
        paragraphs: [
          "Events are lessons, meetings, activities and other commitments. They appear alongside deadlines but are not treated as DayLo tasks.",
        ],
      },
      {
        title: "Show and block",
        paragraphs: [
          "Show in DayLo controls whether a calendar’s events appear here. Block study time marks event intervals that planning should avoid.",
        ],
      },
      {
        title: "Your Google calendars",
        paragraphs: [
          "Hidden calendars remain unchanged in Google, and removing a calendar from DayLo does not delete it. Switching accounts should load only the currently connected account’s data.",
        ],
      },
    ],
  },
  {
    id: "todays-plan",
    title: "Today’s Plan",
    summary: "Follow, edit and update the study blocks planned for today.",
    tourId: "todays-plan",
    sections: [
      {
        title: "Create the plan",
        paragraphs: [
          "Use DayLo’s recommendations and your preferences to create a practical plan for today.",
        ],
      },
      {
        title: "Read each block",
        paragraphs: [
          "Blocks can show start and end times, a Goal and Why this is in your plan so the next action is clear.",
        ],
      },
      {
        title: "Adjust the schedule",
        paragraphs: [
          "Edit unlocked blocks, move or reorder them where supported, lock important blocks, or add a manual study or break block.",
        ],
      },
      {
        title: "Complete work",
        paragraphs: [
          "Mark work done as you progress. Completed blocks remain understandable in the timeline using the existing completion behaviour.",
        ],
      },
      {
        title: "Save and replace",
        paragraphs: [
          "You can clear or replace the plan. Refreshing preserves the current-day plan, while a plan from an earlier day may become stale.",
        ],
      },
    ],
  },
];

export function getHelpTopic(topicId) {
  return helpTopics.find((topic) => topic.id === topicId) || null;
}
