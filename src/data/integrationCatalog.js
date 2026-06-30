export const integrationStatusLabels = {
  "not-linked": "Not linked",
  linked: "Linked",
  "coming-soon": "Coming soon",
  "planned-later": "Planned later",
};

export const integrationCatalog = [
  {
    id: "google-classroom",
    name: "Google Classroom",
    provider: "Google",
    description:
      "Bring school classes, assignments, and due dates into Student Hub.",
    status: "coming-soon",
    enabled: false,
    canLink: false,
    canUnlink: false,
    source: "mock",
    previewAvailable: true,
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    provider: "Google",
    description:
      "Show school-only events beside local task deadlines in the Calendar.",
    status: "planned-later",
    enabled: false,
    canLink: false,
    canUnlink: false,
    source: "future",
    previewAvailable: false,
  },
  {
    id: "ai-planner",
    name: "AI Planner",
    provider: "Student Hub",
    description:
      "Suggest what to study using local tasks, subjects, and grade goals.",
    status: "coming-soon",
    enabled: false,
    canLink: false,
    canUnlink: false,
    source: "future",
    previewAvailable: false,
  },
];

