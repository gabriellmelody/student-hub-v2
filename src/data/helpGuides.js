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
          "Open Smart Planner or choose Basic Planner.",
          "Review the preview before accepting it.",
          "Accepting the preview creates Today’s Plan for the current day.",
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
          "Classroom and Calendar are optional. Basic Planner remains available without AI, accounts or cloud sync.",
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
          "Being at your target does not make a Subject disappear from planning. Smart Planner cannot guarantee grade improvement, so grades should reflect your own current understanding.",
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
          "Show in DayLo controls whether a calendar’s events appear here. Block study time lets Smart Planner avoid those event intervals when Calendar consideration is enabled.",
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
    id: "smart-planner",
    title: "Smart Planner",
    summary: "Create and review an AI-assisted plan for the current day.",
    tourId: "smart-planner",
    sections: [
      {
        title: "Choose the study window",
        paragraphs: [
          "Smart Planner plans today only. Start time rounds forward to the next half hour by default, while start and finish remain editable.",
        ],
      },
      {
        title: "Choose a style",
        bullets: [
          "Balanced aims for realistic progress with breaks.",
          "Lighter leaves more breathing room.",
          "Maximum progress uses the available window more fully.",
        ],
      },
      {
        title: "Add useful context",
        paragraphs: [
          "Calendar busy time can be considered when available. Temporary Planner context can describe progress or priorities, while Subject grades remain secondary signals.",
        ],
      },
      {
        title: "Review before saving",
        paragraphs: [
          "The preview shows scheduled blocks, Not scheduled today and Plan notes. Nothing changes until you accept the preview.",
        ],
      },
      {
        title: "AI allowance and Basic Planner",
        paragraphs: [
          "A successful Smart Planner result uses one daily allowance. Failed AI requests and Basic Planner do not use an allowance. Basic Planner is unlimited.",
          "The Smart Planner card in Settings → Integrations shows current availability and reset time.",
        ],
      },
      {
        title: "AI disclosure",
        paragraphs: [
          "Smart Planner uses AI to suggest a study plan. Review the preview and adjust anything that does not fit your situation.",
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
          "Accepting a Smart or Basic Planner preview creates Today’s Plan with study blocks and breaks.",
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
