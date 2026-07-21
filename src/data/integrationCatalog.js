export const integrationStatusLabels = {
  "not-linked": "Not linked",
  linked: "Linked",
  "linked-sample": "Linked · Sample",
  "coming-soon": "Coming soon",
  "planned-later": "Planned later",
  beta: "Beta",
};

export const integrationCatalog = [
  {
    id: "google-classroom",
    name: "Sample Classroom",
    provider: "Google",
    description:
      "Use local sample data to test Classroom-style courses and assignments.",
    status: "not-linked",
    enabled: true,
    canLink: true,
    canUnlink: true,
    source: "mock",
    previewAvailable: true,
  },
  {
    id: "real-google-classroom",
    name: "Google Classroom",
    provider: "Google",
    description:
      "Connect Google Classroom to bring school assignments into Student Hub.",
    status: "beta",
    enabled: false,
    canLink: false,
    canUnlink: false,
    source: "future",
    previewAvailable: false,
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
