export const integrationStatusLabels = {
  "not-linked": "Not connected",
  linked: "Connected",
  "linked-sample": "Connected · Sample",
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
      "Try a local Classroom demo without connecting Google.",
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
      "Import assignments and link classes to Student Hub Subjects.",
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
      "Show events and protect busy time when building study plans.",
    status: "not-linked",
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
      "Suggest study steps from tasks and subjects later.",
    status: "coming-soon",
    enabled: false,
    canLink: false,
    canUnlink: false,
    source: "future",
    previewAvailable: false,
  },
];
