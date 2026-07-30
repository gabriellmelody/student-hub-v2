export const integrationStatusLabels = {
  "not-linked": "Not connected",
  linked: "Connected",
  "linked-sample": "Connected · Sample",
  "coming-soon": "Coming soon",
  "planned-later": "Planned later",
  beta: "Beta",
  checking: "Checking",
  ready: "Ready",
  "daily-limit-reached": "AI limit reached",
  unavailable: "Temporarily unavailable",
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
    name: "Smart Planner AI",
    provider: "Student Hub",
    description:
      "Build a focused study plan from your active tasks.",
    status: "checking",
    enabled: true,
    canLink: false,
    canUnlink: false,
    source: "future",
    previewAvailable: false,
  },
];
