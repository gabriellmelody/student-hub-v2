export const helpStatusLabels = {
  available: "Available now",
  comingSoon: "Coming soon",
  plannedLater: "Planned later",
};

export const helpCategories = [
  {
    id: "using-student-hub",
    label: "Using DayLo",
    description: "Tools you can use in the app today.",
  },
  {
    id: "workspace",
    label: "Your workspace",
    description: "Customisation, demo content, and local data.",
  },
  {
    id: "future",
    label: "Future connections",
    description: "Ideas that are not connected or active yet.",
  },
];

export const helpContent = [
  {
    id: "student-hub-overview",
    title: "What is DayLo?",
    status: "available",
    category: "using-student-hub",
    summary:
      "A school workspace for keeping tasks, deadlines, study plans, and quick widgets together.",
  },
  {
    id: "tasks",
    title: "How do tasks work?",
    status: "available",
    category: "using-student-hub",
    summary:
      "Add a subject, title, due date, and effort level. You can edit, sort, complete, or delete tasks.",
    details:
      "Completed tasks stay visible for 24 hours before they are removed automatically.",
  },
  {
    id: "task-importance",
    title: "How does assessment detection work?",
    status: "available",
    category: "using-student-hub",
    summary:
      "DayLo detects assessment words such as test, summative, formative, and exam, then marks the task as high importance.",
    details:
      "You can change the task type or importance yourself at any time. This uses simple local rules, not AI.",
  },
  {
    id: "subjects-hub",
    title: "What is the Subjects Hub?",
    status: "available",
    category: "using-student-hub",
    summary:
      "Open Subjects to see each class, active workload, next due task, grades, and completed work.",
    details:
      "Subject Profiles are still managed in Settings and supply course details, goals, and colours.",
  },
  {
    id: "completed-task-history",
    title: "Where can I see completed task history?",
    status: "available",
    category: "using-student-hub",
    summary:
      "The Subjects Hub keeps a compact history of your latest completed tasks, grouped by subject.",
    details:
      "Completed cards leave the To-do list after 24 hours, but their lightweight history remains.",
  },
  {
    id: "local-calendar",
    title: "What appears in the School calendar?",
    status: "available",
    category: "using-student-hub",
    summary:
      "The calendar currently uses due dates from tasks you create in DayLo.",
    details:
      "Select a day to see its deadlines or add a task with that date already chosen.",
  },
  {
    id: "today-plan",
    title: "How does Today’s Plan work?",
    status: "available",
    category: "using-student-hub",
    summary:
      "Choose your available time and start time, then generate a suggested study schedule from your tasks.",
  },
  {
    id: "custom-plan-blocks",
    title: "How do custom plan blocks work?",
    status: "available",
    category: "using-student-hub",
    summary:
      "Use Add block to create your own study or break block, even when you have no tasks to plan.",
  },
  {
    id: "locked-plan-blocks",
    title: "What does locking a plan block do?",
    status: "available",
    category: "using-student-hub",
    summary:
      "A locked block cannot be edited, removed, completed, or moved until you unlock it.",
    details:
      "Its displayed time can still shift when an earlier unlocked block changes.",
  },
  {
    id: "saved-plan",
    title: "Is Today’s Plan saved?",
    status: "available",
    category: "using-student-hub",
    summary:
      "Yes. Today’s Plan, start time, order, durations, custom blocks, and locks are saved automatically in this browser.",
  },
  {
    id: "plan-reordering",
    title: "Can I reorder plan blocks?",
    status: "available",
    category: "using-student-hub",
    summary:
      "Drag unlocked study and break blocks into a new order. Their times recalculate after you drop them.",
  },
  {
    id: "appearance",
    title: "What can I change in Appearance?",
    status: "available",
    category: "workspace",
    summary:
      "Choose light, dark, or system mode, theme colours, logo appearance, background, and layout density.",
  },
  {
    id: "demo-data",
    title: "What is the Demo workspace?",
    status: "available",
    category: "workspace",
    summary:
      "The Demo workspace is an optional set of sample school tasks for exploring the app.",
    details:
      "Load or remove it from Data & reset without affecting your own work.",
  },
  {
    id: "local-storage",
    title: "Where is my data saved?",
    status: "available",
    category: "workspace",
    summary:
      "DayLo currently saves data in this browser on this device.",
    details:
      "There are no accounts or cloud sync yet, so clearing browser site data may remove your work.",
  },
  {
    id: "mock-classroom-preview",
    title: "What is the Mock Classroom Preview?",
    status: "available",
    category: "workspace",
    summary:
      "Sample mode can sync local mock assignments into DayLo tasks.",
    details:
      "The preview uses local sample data only. No Google account is connected.",
  },
  {
    id: "google-classroom",
    title: "Google Classroom",
    status: "comingSoon",
    category: "future",
    summary: "This is not connected yet.",
    details:
      "The Mock Classroom Preview uses local sample data only. Later, DayLo may import classes, assignments, and due dates from Google Classroom.",
  },
  {
    id: "ai-planning",
    title: "AI planning",
    status: "comingSoon",
    category: "future",
    summary: "This is not active yet.",
    details:
      "Later, AI may help suggest what to work on and how to break down tasks.",
  },
  {
    id: "google-calendar",
    title: "Google Calendar and school events",
    status: "plannedLater",
    category: "future",
    summary: "No external calendar is connected today.",
    details:
      "For now, the calendar uses local task due dates. Later, it may show school events or imported deadlines.",
  },
  {
    id: "accounts-cloud-sync",
    title: "Accounts and cloud sync",
    status: "plannedLater",
    category: "future",
    summary: "DayLo does not have accounts or cloud sync yet.",
    details:
      "A later version may make it possible to keep a workspace across devices.",
  },
];
