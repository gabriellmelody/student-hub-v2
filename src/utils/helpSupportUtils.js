import {
  GUIDED_TOUR_STORAGE_KEY,
  loadGuidedTourProgress,
} from "./guidedTourStorage.js";

export const SUPPORT_FIELD_LIMITS = {
  replyEmail: 254,
  feedbackMessage: 2000,
  problemDescription: 1800,
  expectedOutcome: 1200,
  reproductionSteps: 1800,
  mailtoBody: 7000,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanText(value, limit) {
  return String(value || "").trim().slice(0, limit);
}

export function normalizeSupportEmail(value) {
  const email = cleanText(value, SUPPORT_FIELD_LIMITS.replyEmail);
  return EMAIL_PATTERN.test(email) ? email : "";
}

export function getGuidedTourDisplayStatus(tour, progress = loadGuidedTourProgress()) {
  const record = progress?.tours?.[tour?.id];

  if (!record) return "Not started";
  if (record.version !== tour.version) return "Updated";
  if (record.status === "completed") return "Completed";
  if (record.status === "skipped") return "Skipped";
  return "Not started";
}

export function getGuidedTourActionLabel(status) {
  return status === "Not started" ? "Start tour" : "Replay tour";
}

export function resetGuidedTourProgress(storage = globalThis.localStorage) {
  if (!storage?.removeItem) return false;

  try {
    storage.removeItem(GUIDED_TOUR_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function summarizeBrowser(userAgent = "") {
  const value = String(userAgent);

  if (/Edg\//i.test(value)) return "Microsoft Edge";
  if (/Chrome\//i.test(value)) return "Chrome";
  if (/Firefox\//i.test(value)) return "Firefox";
  if (/Safari\//i.test(value) && !/Chrome\//i.test(value)) return "Safari";
  return value ? "Other browser" : "Unknown";
}

function normalizeConnectionStatus(value) {
  if (value === true || value === "yes" || value === "connected") return "Yes";
  if (value === false || value === "no" || value === "disconnected") return "No";
  return "Unknown";
}

function normalizePlannerStatus(value) {
  if (value === "ready") return "Ready";
  if (value === "daily_limit_reached") return "Limit reached";
  if (["unavailable", "configuration_error"].includes(value)) return "Unavailable";
  return "Unknown";
}

export function buildSafeDiagnosticDetails({
  appVersion = "Beta build",
  now = new Date(),
  currentPage = "Help & tours",
  userAgent = "",
  viewportWidth = 0,
  viewportHeight = 0,
  theme = "system",
  online = true,
  classroomConnected,
  calendarConnected,
  smartPlannerStatus,
  remainingAllowance,
} = {}) {
  const lines = [
    "DayLo diagnostics",
    `Build: ${cleanText(appVersion, 80) || "Unknown"}`,
    `Date: ${now instanceof Date && Number.isFinite(now.getTime()) ? now.toISOString() : "Unknown"}`,
    `Page: ${cleanText(currentPage, 80) || "Unknown"}`,
    `Browser: ${summarizeBrowser(userAgent)}`,
    `Viewport: ${Math.max(0, Math.round(Number(viewportWidth) || 0))} × ${Math.max(0, Math.round(Number(viewportHeight) || 0))}`,
    `Theme: ${["light", "dark", "system"].includes(theme) ? theme : "unknown"}`,
    `Online: ${online === true ? "Yes" : online === false ? "No" : "Unknown"}`,
    `Classroom connected: ${normalizeConnectionStatus(classroomConnected)}`,
    `Calendar connected: ${normalizeConnectionStatus(calendarConnected)}`,
    `Smart Planner: ${normalizePlannerStatus(smartPlannerStatus)}`,
  ];

  if (
    Number.isInteger(remainingAllowance) &&
    remainingAllowance >= 0 &&
    smartPlannerStatus
  ) {
    lines.push(`AI allowance remaining: ${remainingAllowance}`);
  }

  return lines.join("\n");
}

export function validateSupportDraft(mode, draft) {
  const replyEmail = cleanText(draft?.replyEmail, SUPPORT_FIELD_LIMITS.replyEmail);

  if (replyEmail && !normalizeSupportEmail(replyEmail)) {
    return "Enter a valid reply email or leave it blank.";
  }

  if (mode === "problem") {
    if (!cleanText(draft?.whatHappened, SUPPORT_FIELD_LIMITS.problemDescription)) {
      return "Tell us what happened.";
    }
    return "";
  }

  if (!cleanText(draft?.message, SUPPORT_FIELD_LIMITS.feedbackMessage)) {
    return "Write a short feedback message.";
  }
  return "";
}

export function buildSupportMessage({
  mode = "feedback",
  draft = {},
  diagnostics = "",
  includeDiagnostics = false,
} = {}) {
  const replyEmail = cleanText(draft.replyEmail, SUPPORT_FIELD_LIMITS.replyEmail);
  const sections =
    mode === "problem"
      ? [
          ["What happened?", cleanText(draft.whatHappened, SUPPORT_FIELD_LIMITS.problemDescription)],
          ["What did you expect?", cleanText(draft.expected, SUPPORT_FIELD_LIMITS.expectedOutcome)],
          ["Steps to reproduce", cleanText(draft.steps, SUPPORT_FIELD_LIMITS.reproductionSteps)],
        ]
      : [
          ["Feedback type", cleanText(draft.feedbackType, 60) || "General feedback"],
          ["Message", cleanText(draft.message, SUPPORT_FIELD_LIMITS.feedbackMessage)],
        ];

  if (replyEmail) sections.push(["Reply email", replyEmail]);

  const coreMessage = sections
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}\n${value}`)
    .join("\n\n");
  const diagnosticText = includeDiagnostics
    ? cleanText(diagnostics, 2600)
    : "";
  const diagnosticPrefix = diagnosticText
    ? "\n\n---\nOnly the diagnostic details shown in DayLo are included.\n"
    : "";
  const availableDiagnosticLength = Math.max(
    0,
    SUPPORT_FIELD_LIMITS.mailtoBody - coreMessage.length - diagnosticPrefix.length
  );

  return `${coreMessage}${diagnosticPrefix}${diagnosticText.slice(
    0,
    availableDiagnosticLength
  )}`;
}

export function buildSupportMailto({
  supportEmail,
  mode = "feedback",
  draft,
  diagnostics,
  includeDiagnostics,
} = {}) {
  const email = normalizeSupportEmail(supportEmail);
  if (!email) return "";

  const subject =
    mode === "problem"
      ? "DayLo problem report"
      : "DayLo feedback";
  const body = buildSupportMessage({
    mode,
    draft,
    diagnostics,
    includeDiagnostics,
  });

  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
}

export async function copySupportMessage(
  message,
  {
    clipboard = globalThis.navigator?.clipboard,
    documentRef = globalThis.document,
  } = {}
) {
  const text = String(message || "");
  if (!text) return false;

  try {
    if (clipboard?.writeText) {
      await clipboard.writeText(text);
      return true;
    }

    if (!documentRef?.createElement || !documentRef?.execCommand) return false;
    const textArea = documentRef.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    documentRef.body.appendChild(textArea);
    textArea.select();
    const copied = documentRef.execCommand("copy");
    textArea.remove();
    return copied;
  } catch {
    return false;
  }
}
