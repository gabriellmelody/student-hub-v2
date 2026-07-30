export const defaultTasks = [
  {
    id: "demo-english-essay",
    subject: "English",
    title: "Essay draft",
    dueDate: "2026-06-22",
    effort: 3,
    completed: false,
    source: "demo",
    externalId: null,
    classroomCourseId: null,
    classroomCourseName: null,
    importedAt: null,
    lastSyncedAt: null,
  },
  {
    id: "demo-maths-problem-set",
    subject: "Maths",
    title: "Problem set",
    dueDate: "2026-06-25",
    effort: 2,
    completed: false,
    source: "demo",
    externalId: null,
    classroomCourseId: null,
    classroomCourseName: null,
    importedAt: null,
    lastSyncedAt: null,
  },
  {
    id: "demo-biology-lab-report",
    subject: "Biology",
    title: "Summative lab report",
    dueDate: "2026-07-02",
    effort: 4,
    completed: false,
    source: "demo",
    externalId: null,
    classroomCourseId: null,
    classroomCourseName: null,
    importedAt: null,
    lastSyncedAt: null,
  },
  {
    id: "demo-history-reading",
    subject: "History",
    title: "Chapter reading",
    dueDate: "",
    effort: 1,
    completed: false,
    source: "demo",
    externalId: null,
    classroomCourseId: null,
    classroomCourseName: null,
    importedAt: null,
    lastSyncedAt: null,
  },
];

export function createDemoTasks() {
  const dueDateOffsets = [1, 3, 7, null];

  return defaultTasks.map((task, index) => {
    const dueDateOffset = dueDateOffsets[index];
    const dueDate = new Date();

    if (dueDateOffset !== null) dueDate.setDate(dueDate.getDate() + dueDateOffset);

    return normalizeTask({
      ...task,
      dueDate: dueDateOffset === null ? "" : formatDateKey(dueDate),
    });
  });
}

export const COMPLETED_TASK_RETENTION_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_ACCENT_COLOR = "#6366f1";
export const THEME_COLORS_STORAGE_KEY = "student-hub-theme-colors";
export const DEFAULT_THEME_COLORS = {
  paletteId: "student-hub",
  primary: DEFAULT_ACCENT_COLOR,
  secondary: "#0ea5e9",
  tertiary: "#a855f7",
  backgroundMode: "neutral",
  backgroundTone: DEFAULT_ACCENT_COLOR,
  backgroundStrength: "off",
};
export const themeBackgroundModes = [
  { value: "neutral", label: "Neutral" },
  { value: "match-theme", label: "Match theme" },
  { value: "custom", label: "Custom tone" },
];
export const themeBackgroundStrengths = [
  { value: "off", label: "Off" },
  { value: "subtle", label: "Subtle" },
  { value: "medium", label: "Medium" },
];
export const DEFAULT_SUBJECT_COLOR = "#2563eb";
export const WIDGET_CONFIG_STORAGE_KEY = "student-hub-widget-config";
export const TODAY_PLAN_STORAGE_KEY = "student-hub-today-plan";
export const QUICK_LINKS_STORAGE_KEY = "student-hub-quick-links";
export const QUICK_LINK_PIN_LIMIT = 5;
export const quickLinkIconCatalog = [
  { id: "globe", label: "Globe" },
  { id: "link", label: "Link" },
  { id: "school", label: "School" },
  { id: "book", label: "Book" },
  { id: "calendar", label: "Calendar" },
  { id: "sparkles", label: "AI / Sparkles" },
  { id: "chat", label: "Chat" },
  { id: "chart", label: "Grades / Chart" },
  { id: "folder", label: "Folder" },
  { id: "document", label: "Document" },
  { id: "video", label: "Video" },
  { id: "mail", label: "Email" },
  { id: "calculator", label: "Calculator" },
  { id: "code", label: "Code" },
  { id: "sports", label: "Sports" },
];
export const quickLinkPresets = [
  {
    id: "google-classroom",
    label: "Google Classroom",
    url: "https://classroom.google.com/",
    iconId: "school",
    type: "preset",
  },
  {
    id: "google-calendar",
    label: "Google Calendar",
    url: "https://calendar.google.com/",
    iconId: "calendar",
    type: "preset",
  },
  {
    id: "chatgpt",
    label: "ChatGPT",
    url: "https://chatgpt.com/",
    iconId: "sparkles",
    type: "preset",
    aiAssistant: true,
  },
  {
    id: "gemini",
    label: "Gemini",
    url: "https://gemini.google.com/",
    iconId: "sparkles",
    type: "preset",
    aiAssistant: true,
  },
  {
    id: "claude",
    label: "Claude",
    url: "https://claude.ai/",
    iconId: "chat",
    type: "preset",
    aiAssistant: true,
  },
  {
    id: "powerschool",
    label: "PowerSchool",
    url: "",
    iconId: "chart",
    type: "preset",
    customizableUrl: true,
  },
];
export const MOCK_CLASSROOM_COURSE_LINKS_STORAGE_KEY =
  "student-hub-mock-classroom-course-links";
export const MOCK_CLASSROOM_INTEGRATION_STORAGE_KEY =
  "student-hub-mock-classroom-integration";
export const REAL_CLASSROOM_COURSE_LINKS_STORAGE_KEY =
  "studentHub.realClassroomCourseSubjectLinks";
export const COMPLETED_HISTORY_STORAGE_KEY =
  "student-hub-completed-task-history";
export const MAX_COMPLETED_HISTORY_RECORDS = 500;
export const STUDENT_HUB_STORAGE_KEYS = [
  "student-hub-tasks",
  COMPLETED_HISTORY_STORAGE_KEY,
  "student-hub-subjects",
  "student-hub-student-profile",
  "student-hub-theme",
  "student-hub-accent",
  THEME_COLORS_STORAGE_KEY,
  "student-hub-density",
  "student-hub-home-layout",
  "student-hub-right-rail",
  "student-hub-right-rail-state",
  "student-hub-right-rail-widgets",
  WIDGET_CONFIG_STORAGE_KEY,
  TODAY_PLAN_STORAGE_KEY,
  QUICK_LINKS_STORAGE_KEY,
  MOCK_CLASSROOM_COURSE_LINKS_STORAGE_KEY,
  MOCK_CLASSROOM_INTEGRATION_STORAGE_KEY,
  REAL_CLASSROOM_COURSE_LINKS_STORAGE_KEY,
  "student-hub-hours",
  "student-hub-start-time",
];

function normalizeQuickLinkLabel(value, fallback = "School link") {
  const label = typeof value === "string" ? value.trim() : "";
  return (label || fallback).slice(0, 42);
}

function normalizeQuickLinkIconId(value, fallback = "globe") {
  const iconId = typeof value === "string" ? value.trim() : "";

  return quickLinkIconCatalog.some((icon) => icon.id === iconId)
    ? iconId
    : fallback;
}

export function normalizeQuickLinkUrl(value) {
  const trimmedValue = typeof value === "string" ? value.trim() : "";

  if (!trimmedValue) {
    return { ok: false, url: "", error: "Enter a website address." };
  }

  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(trimmedValue)
    ? trimmedValue
    : `https://${trimmedValue}`;

  try {
    const url = new URL(withProtocol);

    if (!["http:", "https:"].includes(url.protocol)) {
      return {
        ok: false,
        url: "",
        error: "Use an http or https website address.",
      };
    }

    if (!url.hostname) {
      return { ok: false, url: "", error: "Enter a valid website address." };
    }

    return { ok: true, url: url.href, error: "" };
  } catch {
    return { ok: false, url: "", error: "Enter a valid website address." };
  }
}

function createPresetQuickLink(preset, pinned = false, pinnedOrder = null) {
  return {
    id: preset.id,
    presetId: preset.id,
    label: preset.label,
    url: preset.url,
    iconId: normalizeQuickLinkIconId(preset.iconId),
    defaultIconId: normalizeQuickLinkIconId(preset.iconId),
    type: "preset",
    pinned,
    pinnedOrder,
  };
}

function getDefaultQuickLinksPreferences() {
  const defaultPinnedIds = ["google-classroom", "google-calendar", "chatgpt"];

  return {
    version: 1,
    aiAssistantPreference: "chatgpt",
    links: quickLinkPresets.map((preset) =>
      createPresetQuickLink(
        preset,
        defaultPinnedIds.includes(preset.id),
        defaultPinnedIds.indexOf(preset.id) >= 0
          ? defaultPinnedIds.indexOf(preset.id)
          : null
      )
    ),
  };
}

export function normalizeQuickLinksPreferences(preferences) {
  const defaults = getDefaultQuickLinksPreferences();

  if (!preferences || typeof preferences !== "object") return defaults;

  const savedLinks = Array.isArray(preferences.links) ? preferences.links : [];
  const savedById = new Map(
    savedLinks
      .filter((link) => link && typeof link === "object" && link.id)
      .map((link) => [String(link.id), link])
  );
  const presetLinks = quickLinkPresets.map((preset) => {
    const saved = savedById.get(preset.id);
    const normalizedUrl = preset.customizableUrl
      ? normalizeQuickLinkUrl(saved?.url || preset.url)
      : { ok: true, url: preset.url };

    return {
      ...createPresetQuickLink(preset),
      label: normalizeQuickLinkLabel(saved?.label, preset.label),
      url: normalizedUrl.ok ? normalizedUrl.url : "",
      iconId: normalizeQuickLinkIconId(saved?.iconId, preset.iconId),
      defaultIconId: normalizeQuickLinkIconId(preset.iconId),
      pinned: saved?.pinned === true,
      pinnedOrder: Number.isFinite(Number(saved?.pinnedOrder))
        ? Number(saved.pinnedOrder)
        : null,
    };
  });
  const presetIds = new Set(quickLinkPresets.map((preset) => preset.id));
  const customLinks = savedLinks
    .filter(
      (link) =>
        link &&
        typeof link === "object" &&
        !presetIds.has(String(link.id)) &&
        link.type === "custom"
    )
    .map((link) => {
      const normalizedUrl = normalizeQuickLinkUrl(link.url);

      if (!normalizedUrl.ok) return null;

      return {
        id: String(link.id),
        label: normalizeQuickLinkLabel(link.label, "Custom link"),
        url: normalizedUrl.url,
        iconId: normalizeQuickLinkIconId(link.iconId, "globe"),
        defaultIconId: "globe",
        type: "custom",
        pinned: link.pinned === true,
        pinnedOrder: Number.isFinite(Number(link.pinnedOrder))
          ? Number(link.pinnedOrder)
          : null,
      };
    })
    .filter(Boolean);
  const allLinks = [...presetLinks, ...customLinks];
  const orderedPinnedIds = allLinks
    .filter((link) => link.pinned && link.url)
    .sort((left, right) => {
      const leftOrder = Number.isFinite(Number(left.pinnedOrder))
        ? Number(left.pinnedOrder)
        : Number.MAX_SAFE_INTEGER;
      const rightOrder = Number.isFinite(Number(right.pinnedOrder))
        ? Number(right.pinnedOrder)
        : Number.MAX_SAFE_INTEGER;

      return leftOrder - rightOrder || left.label.localeCompare(right.label);
    })
    .slice(0, QUICK_LINK_PIN_LIMIT)
    .map((link) => link.id);

  return {
    version: 1,
    aiAssistantPreference:
      ["chatgpt", "gemini", "claude"].includes(
        preferences.aiAssistantPreference
      )
        ? preferences.aiAssistantPreference
        : "chatgpt",
    links: allLinks.map((link) => {
      const pinnedOrder = orderedPinnedIds.indexOf(link.id);

      return {
        ...link,
        pinned: pinnedOrder >= 0,
        pinnedOrder: pinnedOrder >= 0 ? pinnedOrder : null,
      };
    }),
  };
}

export function loadQuickLinksPreferences() {
  if (typeof window === "undefined") return getDefaultQuickLinksPreferences();

  try {
    return normalizeQuickLinksPreferences(
      JSON.parse(window.localStorage.getItem(QUICK_LINKS_STORAGE_KEY) || "null")
    );
  } catch {
    return getDefaultQuickLinksPreferences();
  }
}

export function saveQuickLinksPreferences(preferences) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    QUICK_LINKS_STORAGE_KEY,
    JSON.stringify(normalizeQuickLinksPreferences(preferences))
  );
}

export function getPinnedQuickLinks(preferences) {
  return normalizeQuickLinksPreferences(preferences).links
    .filter((link) => link.pinned && link.url)
    .sort((left, right) => left.pinnedOrder - right.pinnedOrder)
    .slice(0, QUICK_LINK_PIN_LIMIT);
}
export const subjectCourseSystems = ["IB", "AP", "GCSE", "A-level", "Other"];
export const subjectLevels = ["HL", "SL", "AP", "Standard", "Higher", "Other"];
export const taskTypeOptions = [
  { value: "homework", label: "Homework" },
  { value: "assessment", label: "Assessment" },
  { value: "revision", label: "Revision" },
  { value: "project", label: "Project" },
  { value: "other", label: "Other" },
];
export const taskImportanceOptions = [
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];
const assessmentKeywordDefinitions = [
  ["summative", "Summative"],
  ["formative", "Formative"],
  ["coursework", "Coursework"],
  ["presentation", "Presentation"],
  ["assessment", "Assessment"],
  ["exam", "Exam"],
  ["quiz", "Quiz"],
  ["test", "Test"],
  ["mock", "Mock"],
  ["oral", "Oral"],
  ["ia", "IA"],
  ["paper", "Paper"],
];
export const accentColorPresets = [
  { label: "Indigo", value: DEFAULT_ACCENT_COLOR },
  { label: "Purple", value: "#7c3aed" },
  { label: "Blue", value: "#2563eb" },
  { label: "Green", value: "#16865c" },
  { label: "Orange", value: "#d76516" },
  { label: "Pink", value: "#d9468c" },
  { label: "Red", value: "#dc3f4f" },
];
export const themeColorPalettes = [
  {
    id: "student-hub",
    label: "Student Hub",
    primary: DEFAULT_THEME_COLORS.primary,
    secondary: DEFAULT_THEME_COLORS.secondary,
    tertiary: DEFAULT_THEME_COLORS.tertiary,
  },
  {
    id: "ocean",
    label: "Ocean",
    primary: "#2563eb",
    secondary: "#0891b2",
    tertiary: "#14b8a6",
  },
  {
    id: "forest",
    label: "Forest",
    primary: "#16865c",
    secondary: "#65a30d",
    tertiary: "#0f766e",
  },
  {
    id: "lavender",
    label: "Lavender",
    primary: "#7c3aed",
    secondary: "#db2777",
    tertiary: "#6366f1",
  },
  {
    id: "sunset",
    label: "Sunset",
    primary: "#d76516",
    secondary: "#dc3f4f",
    tertiary: "#f59e0b",
  },
  {
    id: "monochrome",
    label: "Monochrome",
    primary: "#52525b",
    secondary: "#71717a",
    tertiary: "#a1a1aa",
  },
];
export const rightRailWidgetOptions = [
  { value: "clock", label: "Clock" },
  { value: "calendar", label: "School calendar" },
  { value: "deadlines", label: "Upcoming deadlines" },
  { value: "plan", label: "Today’s Plan" },
];

export function getDefaultWidgetConfig(homeLayout = "focused") {
  const expandedHome = homeLayout === "dashboard";

  return [
    {
      id: "home-next-focus",
      type: "nextFocus",
      label: "Next focus",
      area: "home",
      visible: true,
      size: "expanded",
      order: 0,
      source: "local",
    },
    {
      id: "home-today-plan",
      type: "todayPlan",
      label: "Today’s Plan",
      area: "home",
      visible: true,
      size: "compact",
      order: 1,
      source: "local",
    },
    {
      id: "home-school-calendar",
      type: "schoolCalendar",
      label: "School calendar",
      area: "home",
      visible: true,
      size: expandedHome ? "expanded" : "compact",
      order: 2,
      source: "local",
    },
    {
      id: "home-progress",
      type: "progress",
      label: "Progress",
      area: "home",
      visible: true,
      size: expandedHome ? "expanded" : "compact",
      order: 3,
      source: "local",
    },
    ...rightRailWidgetOptions.map((option, order) => ({
      id: `right-rail-${option.value}`,
      type: option.value,
      label: option.label,
      area: "rightRail",
      visible: true,
      size: "compact",
      order,
      source: "local",
    })),
  ];
}

export function normalizeWidgetConfig(
  savedConfig,
  homeLayout = "focused",
  legacyRightRailWidgets = null
) {
  const defaults = getDefaultWidgetConfig(homeLayout);

  return defaults.map((defaultWidget) => {
    const savedWidget = Array.isArray(savedConfig)
      ? savedConfig.find((widget) => widget?.id === defaultWidget.id)
      : null;
    const legacyVisibility =
      defaultWidget.area === "rightRail" &&
      Array.isArray(legacyRightRailWidgets)
        ? legacyRightRailWidgets.includes(defaultWidget.type)
        : defaultWidget.visible;

    return {
      ...defaultWidget,
      visible:
        typeof savedWidget?.visible === "boolean"
          ? savedWidget.visible
          : legacyVisibility,
      size:
        savedWidget?.size === "compact" || savedWidget?.size === "expanded"
          ? savedWidget.size
          : defaultWidget.size,
      order: Number.isFinite(Number(savedWidget?.order))
        ? Number(savedWidget.order)
        : defaultWidget.order,
    };
  });
}

export function loadWidgetConfig(homeLayout = "focused") {
  const legacyRightRailWidgets = loadRightRailWidgets();
  const savedConfig = localStorage.getItem(WIDGET_CONFIG_STORAGE_KEY);

  if (!savedConfig) {
    return normalizeWidgetConfig(
      null,
      homeLayout,
      legacyRightRailWidgets
    );
  }

  try {
    return normalizeWidgetConfig(
      JSON.parse(savedConfig),
      homeLayout,
      legacyRightRailWidgets
    );
  } catch {
    return normalizeWidgetConfig(
      null,
      homeLayout,
      legacyRightRailWidgets
    );
  }
}

export function getWidgetsForArea(widgetConfig, area, visibleOnly = true) {
  return widgetConfig
    .filter(
      (widget) =>
        widget.area === area && (!visibleOnly || widget.visible === true)
    )
    .sort((first, second) => first.order - second.order);
}

export function normalizeHexColor(value) {
  return /^#[0-9a-f]{6}$/i.test(value || "")
    ? value.toLowerCase()
    : DEFAULT_ACCENT_COLOR;
}

export function normalizeThemeColors(savedThemeColors = null, legacyAccent = null) {
  const savedPalette = themeColorPalettes.find(
    (palette) => palette.id === savedThemeColors?.paletteId
  );
  const fallback = savedPalette || DEFAULT_THEME_COLORS;
  const legacyPrimary = legacyAccent ? normalizeHexColor(legacyAccent) : null;
  const savedBackgroundMode = savedThemeColors?.backgroundMode;
  const backgroundMode = ["neutral", "match-theme", "custom"].includes(
    savedBackgroundMode
  )
    ? savedBackgroundMode
    : DEFAULT_THEME_COLORS.backgroundMode;
  const savedBackgroundStrength = savedThemeColors?.backgroundStrength;
  const backgroundStrength = ["off", "subtle", "medium"].includes(
    savedBackgroundStrength
  )
    ? savedBackgroundStrength
    : DEFAULT_THEME_COLORS.backgroundStrength;

  return {
    paletteId:
      savedThemeColors?.paletteId && savedThemeColors.paletteId !== fallback.id
        ? "custom"
        : fallback.paletteId || fallback.id || "student-hub",
    primary: normalizeHexColor(
      savedThemeColors?.primary || legacyPrimary || fallback.primary
    ),
    secondary: normalizeHexColor(savedThemeColors?.secondary || fallback.secondary),
    tertiary: normalizeHexColor(savedThemeColors?.tertiary || fallback.tertiary),
    backgroundMode,
    backgroundTone: normalizeHexColor(
      savedThemeColors?.backgroundTone || DEFAULT_THEME_COLORS.backgroundTone
    ),
    backgroundStrength,
  };
}

export function loadThemeColors() {
  if (typeof window === "undefined") return DEFAULT_THEME_COLORS;

  try {
    const savedThemeColors = JSON.parse(
      window.localStorage.getItem(THEME_COLORS_STORAGE_KEY) || "null"
    );

    return normalizeThemeColors(
      savedThemeColors,
      window.localStorage.getItem("student-hub-accent")
    );
  } catch {
    return normalizeThemeColors(
      null,
      window.localStorage.getItem("student-hub-accent")
    );
  }
}

export function saveThemeColors(themeColors) {
  if (typeof window === "undefined") return;

  const normalizedThemeColors = normalizeThemeColors(themeColors);

  window.localStorage.setItem(
    THEME_COLORS_STORAGE_KEY,
    JSON.stringify(normalizedThemeColors)
  );
  window.localStorage.setItem("student-hub-accent", normalizedThemeColors.primary);
}

export function getThemeColorWarnings(themeColors) {
  const normalizedThemeColors = normalizeThemeColors(themeColors);

  return ["primary", "secondary", "tertiary"].reduce((warnings, role) => {
    const color = normalizedThemeColors[role];
    const contrastText = getContrastText(color);

    if (getContrastRatio(color, contrastText) < 4.5) {
      warnings[role] = "This colour may be difficult to read.";
    }

    return warnings;
  }, {});
}

export function hexToRgb(hex) {
  const value = normalizeHexColor(hex).slice(1);

  return {
    red: parseInt(value.slice(0, 2), 16),
    green: parseInt(value.slice(2, 4), 16),
    blue: parseInt(value.slice(4, 6), 16),
  };
}

export function rgbToHex({ red, green, blue }) {
  return `#${[red, green, blue]
    .map((value) => Math.round(value).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function mixColors(color, target, amount) {
  const sourceRgb = hexToRgb(color);
  const targetRgb = hexToRgb(target);

  return rgbToHex({
    red: sourceRgb.red + (targetRgb.red - sourceRgb.red) * amount,
    green: sourceRgb.green + (targetRgb.green - sourceRgb.green) * amount,
    blue: sourceRgb.blue + (targetRgb.blue - sourceRgb.blue) * amount,
  });
}

export function getRelativeLuminance(color) {
  const { red, green, blue } = hexToRgb(color);
  const channels = [red, green, blue].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function getContrastRatio(firstColor, secondColor) {
  const firstLuminance = getRelativeLuminance(firstColor);
  const secondLuminance = getRelativeLuminance(secondColor);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

export function getContrastText(accentColor) {
  const lightText = "#ffffff";
  const darkText = "#18181b";

  return getContrastRatio(accentColor, lightText) >=
    getContrastRatio(accentColor, darkText)
    ? lightText
    : darkText;
}

export function getReadableAccent(accentColor, theme) {
  const background = theme === "dark" ? "#0d0d0f" : "#f7f7f5";
  const target = theme === "dark" ? "#ffffff" : "#18181b";

  for (let step = 0; step <= 10; step += 1) {
    const candidate = mixColors(accentColor, target, step / 10);
    if (getContrastRatio(candidate, background) >= 4.5) return candidate;
  }

  return target;
}

export function colorToRgba(color, alpha) {
  const { red, green, blue } = hexToRgb(color);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

const neutralBackgroundTheme = {
  dark: {
    canvas: "#0d0d0f",
    sidebar: "#111113",
    surface: "#18181b",
    elevated: "#202024",
    subtle: "#151518",
    input: "#09090b",
    hover: "#24242a",
    control: "#27272a",
    controlHover: "#323238",
    border: "#232326",
    borderRaised: "#2b2b30",
    borderStrong: "#3f3f46",
    borderHover: "#52525b",
    indicatorBorder: "#34343b",
    borderSoft: "rgba(255, 255, 255, 0.075)",
  },
  light: {
    canvas: "#f7f7f5",
    sidebar: "#f1f1ef",
    surface: "#ffffff",
    elevated: "#fafaf9",
    subtle: "#f5f5f3",
    input: "#ffffff",
    hover: "#f4f4f1",
    control: "#f0f0ed",
    controlHover: "#e8e8e4",
    border: "#e7e7e3",
    borderRaised: "#e9e9e5",
    borderStrong: "#d5d5cf",
    borderHover: "#c4c4bd",
    indicatorBorder: "#deded9",
    borderSoft: "rgba(41, 41, 39, 0.075)",
  },
};

export function deriveThemeBackground(themeColors, resolvedTheme = "light") {
  const normalizedThemeColors = normalizeThemeColors(themeColors);
  const appearance = resolvedTheme === "dark" ? "dark" : "light";
  const neutralTheme = neutralBackgroundTheme[appearance];
  const strength = normalizedThemeColors.backgroundStrength;

  if (normalizedThemeColors.backgroundMode === "neutral" || strength === "off") {
    return {
      ...neutralTheme,
      mode: normalizedThemeColors.backgroundMode,
      strength,
      tone:
        normalizedThemeColors.backgroundMode === "match-theme"
          ? normalizedThemeColors.primary
          : normalizedThemeColors.backgroundTone,
    };
  }

  const tone =
    normalizedThemeColors.backgroundMode === "match-theme"
      ? normalizedThemeColors.primary
      : normalizedThemeColors.backgroundTone;
  const medium = strength === "medium";

  if (appearance === "dark") {
    return {
      mode: normalizedThemeColors.backgroundMode,
      strength,
      tone,
      canvas: mixColors(neutralTheme.canvas, tone, medium ? 0.13 : 0.08),
      sidebar: mixColors(neutralTheme.sidebar, tone, medium ? 0.14 : 0.09),
      surface: mixColors(neutralTheme.surface, tone, medium ? 0.11 : 0.07),
      elevated: mixColors(neutralTheme.elevated, tone, medium ? 0.12 : 0.08),
      subtle: mixColors(neutralTheme.subtle, tone, medium ? 0.1 : 0.06),
      input: mixColors(neutralTheme.input, tone, medium ? 0.08 : 0.05),
      hover: mixColors(neutralTheme.hover, tone, medium ? 0.16 : 0.1),
      control: mixColors(neutralTheme.control, tone, medium ? 0.13 : 0.08),
      controlHover: mixColors(
        neutralTheme.controlHover,
        tone,
        medium ? 0.15 : 0.1
      ),
      border: mixColors(neutralTheme.border, tone, medium ? 0.18 : 0.11),
      borderRaised: mixColors(
        neutralTheme.borderRaised,
        tone,
        medium ? 0.19 : 0.12
      ),
      borderStrong: mixColors(
        neutralTheme.borderStrong,
        tone,
        medium ? 0.2 : 0.13
      ),
      borderHover: mixColors(
        neutralTheme.borderHover,
        tone,
        medium ? 0.2 : 0.14
      ),
      indicatorBorder: mixColors(
        neutralTheme.indicatorBorder,
        tone,
        medium ? 0.18 : 0.12
      ),
      borderSoft: colorToRgba(tone, medium ? 0.18 : 0.12),
    };
  }

  return {
    mode: normalizedThemeColors.backgroundMode,
    strength,
    tone,
    canvas: mixColors(neutralTheme.canvas, tone, medium ? 0.09 : 0.05),
    sidebar: mixColors(neutralTheme.sidebar, tone, medium ? 0.1 : 0.06),
    surface: mixColors(neutralTheme.surface, tone, medium ? 0.035 : 0.018),
    elevated: mixColors(neutralTheme.elevated, tone, medium ? 0.05 : 0.03),
    subtle: mixColors(neutralTheme.subtle, tone, medium ? 0.08 : 0.05),
    input: mixColors(neutralTheme.input, tone, medium ? 0.025 : 0.012),
    hover: mixColors(neutralTheme.hover, tone, medium ? 0.1 : 0.06),
    control: mixColors(neutralTheme.control, tone, medium ? 0.09 : 0.05),
    controlHover: mixColors(
      neutralTheme.controlHover,
      tone,
      medium ? 0.11 : 0.07
    ),
    border: mixColors(neutralTheme.border, tone, medium ? 0.16 : 0.1),
    borderRaised: mixColors(
      neutralTheme.borderRaised,
      tone,
      medium ? 0.15 : 0.09
    ),
    borderStrong: mixColors(
      neutralTheme.borderStrong,
      tone,
      medium ? 0.16 : 0.1
    ),
    borderHover: mixColors(
      neutralTheme.borderHover,
      tone,
      medium ? 0.14 : 0.09
    ),
    indicatorBorder: mixColors(
      neutralTheme.indicatorBorder,
      tone,
      medium ? 0.14 : 0.09
    ),
    borderSoft: colorToRgba(tone, medium ? 0.12 : 0.08),
  };
}

export function normalizeTask(task, fallbackSource = "manual") {
  const normalizedMetadata = applyTaskImportanceDetection(task);

  return {
    ...task,
    ...normalizedMetadata,
    source: task.source || fallbackSource,
    externalId: task.externalId || null,
    classroomCourseId: task.classroomCourseId || null,
    classroomCourseName: task.classroomCourseName || null,
    submissionId: task.submissionId || null,
    submissionState: task.submissionState || "",
    classroomStatusCategory: task.classroomStatusCategory || "unknown",
    late: task.late === true,
    assignedGrade: task.assignedGrade ?? null,
    draftGrade: task.draftGrade ?? null,
    submissionUpdatedAt: task.submissionUpdatedAt || null,
    importedAt: task.importedAt || null,
    sourceUpdatedAt: task.sourceUpdatedAt || null,
    lastSyncedAt: task.lastSyncedAt || null,
    archived: task.archived === true,
  };
}

export function detectTaskImportance(title = "") {
  const detectedTags = assessmentKeywordDefinitions
    .filter(([keyword]) =>
      new RegExp(`\\b${keyword}\\b`, "i").test(String(title))
    )
    .map(([, label]) => label);

  return {
    detectedTags,
    taskType: detectedTags.length > 0 ? "assessment" : "homework",
    importance: detectedTags.length > 0 ? "high" : "normal",
  };
}

export function applyTaskImportanceDetection(task) {
  const detection = detectTaskImportance(
    [task?.title, task?.description].filter(Boolean).join(" ")
  );
  const hasManualOverride = task?.importanceSource === "manual";
  const validTaskTypes = new Set(taskTypeOptions.map((option) => option.value));
  const validImportance = new Set(
    taskImportanceOptions.map((option) => option.value)
  );

  return {
    taskType:
      hasManualOverride && validTaskTypes.has(task?.taskType)
        ? task.taskType
        : detection.taskType,
    importance:
      hasManualOverride && validImportance.has(task?.importance)
        ? task.importance
        : detection.importance,
    detectedTags: detection.detectedTags,
    importanceSource: hasManualOverride ? "manual" : "auto",
  };
}

export function updateTaskTitleWithDetection(task, title) {
  const nextTask = { ...task, title };

  return {
    ...nextTask,
    ...applyTaskImportanceDetection(nextTask),
  };
}

export function getTaskSignalBadges(task) {
  const badges = [];
  const primaryTag = Array.isArray(task?.detectedTags)
    ? task.detectedTags[0]
    : null;

  if (task?.taskType === "assessment") {
    badges.push({
      label: primaryTag || "Assessment",
      tone: "assessment",
    });
  } else if (task?.taskType === "revision") {
    badges.push({ label: "Revision", tone: "type" });
  } else if (task?.taskType === "project") {
    badges.push({ label: "Project", tone: "type" });
  }

  if (task?.importance === "urgent") {
    badges.push({ label: "Urgent importance", tone: "urgent" });
  } else if (
    task?.importance === "high" &&
    task?.taskType !== "assessment"
  ) {
    badges.push({ label: "High importance", tone: "high" });
  }

  return badges.slice(0, 2);
}

function normalizeHistorySource(source) {
  return ["manual", "demo", "classroom", "classroom-mock"].includes(source)
    ? source
    : "manual";
}

export function createCompletedTaskHistoryRecord(task, completedAt = Date.now()) {
  const timestamp = Number(completedAt);
  const safeCompletedAt = Number.isFinite(timestamp) ? timestamp : Date.now();
  const normalizedMetadata = applyTaskImportanceDetection(task);

  return {
    id: `history-${String(task.id)}-${safeCompletedAt}`,
    originalTaskId: task.id ?? null,
    title: String(task.title || "Untitled task").trim() || "Untitled task",
    subject: String(task.subject || "").trim(),
    dueDate: typeof task.dueDate === "string" ? task.dueDate : "",
    completedAt: safeCompletedAt,
    source: normalizeHistorySource(task.source),
    ...normalizedMetadata,
  };
}

function normalizeCompletedTaskHistory(records) {
  if (!Array.isArray(records)) return [];

  const normalizedRecords = records.flatMap((record) => {
    if (!record || typeof record !== "object") return [];

    const completedAt = Number(record.completedAt);

    if (!Number.isFinite(completedAt)) return [];

    const normalizedMetadata = applyTaskImportanceDetection(record);

    return {
      id:
        record.id ||
        `history-${String(record.originalTaskId ?? "unknown")}-${completedAt}`,
      originalTaskId: record.originalTaskId ?? null,
      title:
        String(record.title || "Untitled task").trim() || "Untitled task",
      subject: String(record.subject || "").trim(),
      dueDate: typeof record.dueDate === "string" ? record.dueDate : "",
      completedAt,
      source: normalizeHistorySource(record.source),
      ...normalizedMetadata,
    };
  });

  normalizedRecords.sort(
    (firstRecord, secondRecord) =>
      secondRecord.completedAt - firstRecord.completedAt
  );

  const seenTaskIds = new Set();

  return normalizedRecords
    .filter((record) => {
      const dedupeKey =
        record.originalTaskId == null
          ? `record:${record.id}`
          : `task:${String(record.originalTaskId)}`;

      if (seenTaskIds.has(dedupeKey)) return false;

      seenTaskIds.add(dedupeKey);
      return true;
    })
    .slice(0, MAX_COMPLETED_HISTORY_RECORDS);
}

export function loadCompletedTaskHistory(tasks = []) {
  let savedRecords;

  try {
    const savedHistory = localStorage.getItem(COMPLETED_HISTORY_STORAGE_KEY);
    savedRecords = savedHistory ? JSON.parse(savedHistory) : [];
  } catch {
    savedRecords = [];
  }

  const currentCompletedRecords = tasks
    .filter((task) => task.completed)
    .map((task) =>
      createCompletedTaskHistoryRecord(task, task.completedAt || Date.now())
    );

  return normalizeCompletedTaskHistory([
    ...(Array.isArray(savedRecords) ? savedRecords : []),
    ...currentCompletedRecords,
  ]);
}

export function upsertCompletedTaskHistory(history, task, completedAt) {
  return normalizeCompletedTaskHistory([
    createCompletedTaskHistoryRecord(task, completedAt),
    ...history,
  ]);
}

export function removeTaskFromCompletedHistory(history, taskId) {
  return history.filter(
    (record) => String(record.originalTaskId) !== String(taskId)
  );
}

export function getExternalSourceKey(item) {
  const source = typeof item?.source === "string" ? item.source.trim() : "";
  const externalId =
    typeof item?.externalId === "string" ? item.externalId.trim() : "";

  return source && externalId ? `${source}:${externalId}` : null;
}

export function findExternalSourceMatch(items, candidate) {
  const candidateKey = getExternalSourceKey(candidate);

  if (!candidateKey || !Array.isArray(items)) return null;

  return (
    items.find((item) => getExternalSourceKey(item) === candidateKey) || null
  );
}

export function loadTasks() {
  const savedTasks = localStorage.getItem("student-hub-tasks");

  if (!savedTasks) return [];

  try {
    const parsedTasks = JSON.parse(savedTasks);

    if (!Array.isArray(parsedTasks)) return [];

    const now = Date.now();

    return parsedTasks.flatMap((task) => {
      if (!task || typeof task !== "object") return [];

      const normalizedTask = normalizeTask(task);

      if (!normalizedTask.completed) return normalizedTask;

      const savedCompletedAt = Number(normalizedTask.completedAt);
      const completedAt = Number.isFinite(savedCompletedAt)
        ? savedCompletedAt
        : now;

      if (now - completedAt >= COMPLETED_TASK_RETENTION_MS) return [];

      return { ...normalizedTask, completedAt };
    });
  } catch {
    return [];
  }
}

export function loadRightRailWidgets() {
  const savedWidgets = localStorage.getItem("student-hub-right-rail-widgets");
  const defaultWidgets = rightRailWidgetOptions.map((option) => option.value);

  if (!savedWidgets) return defaultWidgets;

  try {
    const parsedWidgets = JSON.parse(savedWidgets);

    if (!Array.isArray(parsedWidgets)) return defaultWidgets;

    return rightRailWidgetOptions
      .filter((option) => parsedWidgets.includes(option.value))
      .map((option) => option.value);
  } catch {
    return defaultWidgets;
  }
}

export function loadSubjects() {
  const savedSubjects = localStorage.getItem("student-hub-subjects");

  if (!savedSubjects) return [];

  try {
    const parsedSubjects = JSON.parse(savedSubjects);

    if (!Array.isArray(parsedSubjects)) return [];

    return parsedSubjects
      .filter((subject) => subject && typeof subject.name === "string")
      .map((subject) => ({
        id: subject.id || `subject-${Date.now()}-${Math.random()}`,
        name: subject.name.trim(),
        courseSystem: subject.courseSystem || "Other",
        level: subject.level || "Other",
        currentGrade: subject.currentGrade || "",
        targetGrade: subject.targetGrade || "",
        colour: /^#[0-9a-f]{6}$/i.test(subject.colour || "")
          ? subject.colour
          : DEFAULT_SUBJECT_COLOR,
        source: subject.source || "manual",
        classroomCourseId: subject.classroomCourseId || null,
        externalId: subject.externalId || null,
        importedAt: subject.importedAt || null,
        lastSyncedAt: subject.lastSyncedAt || null,
      }))
      .filter((subject) => subject.name);
  } catch {
    return [];
  }
}

export function loadStudentProfile() {
  const savedProfile = localStorage.getItem("student-hub-student-profile");

  if (!savedProfile) {
    return {
      schoolSystem: "",
      onboardingCompleted: false,
      source: "manual",
    };
  }

  try {
    const parsedProfile = JSON.parse(savedProfile);

    return {
      schoolSystem: parsedProfile.schoolSystem || "",
      onboardingCompleted: parsedProfile.onboardingCompleted === true,
      source: parsedProfile.source || "manual",
    };
  } catch {
    return {
      schoolSystem: "",
      onboardingCompleted: false,
      source: "manual",
    };
  }
}

export function findSubjectProfile(subjects, subjectName) {
  const normalizedName = normalizeSubjectName(subjectName);

  if (!normalizedName) return null;

  return (
    subjects.find(
      (subject) => normalizeSubjectName(subject.name) === normalizedName
    ) || null
  );
}

export function normalizeSubjectName(subjectName) {
  return typeof subjectName === "string"
    ? subjectName.trim().toLocaleLowerCase().replace(/\s+/g, " ")
    : "";
}

export function getDaysLeft(dueDate) {
  if (!dueDate) return null;

  const today = new Date();
  const due = new Date(dueDate);

  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  return Math.ceil((due - today) / (1000 * 60 * 60 * 24));
}

export function hasRealDueDate(dueDate) {
  if (typeof dueDate !== "string") return false;

  const trimmedDate = dueDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) return false;

  const [year, month, day] = trimmedDate.split("-").map(Number);
  const parsedDate = new Date(year, month - 1, day);

  return (
    parsedDate.getFullYear() === year &&
    parsedDate.getMonth() === month - 1 &&
    parsedDate.getDate() === day
  );
}

export function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function getTaskCalendarEvents(tasks, subjects = []) {
  return tasks
    .filter((task) => task.dueDate && !task.archived)
    .map((task) => {
      const subjectProfile = findSubjectProfile(subjects, task.subject);

      return {
        id: `task-${task.id}`,
        source: "task",
        taskId: task.id,
        externalId: task.externalId || null,
        date: task.dueDate,
        title: task.title,
        subject: task.subject,
        subjectName: task.subject,
        subjectId: subjectProfile?.id || null,
        colour: subjectProfile?.colour || null,
        subjectColour: subjectProfile?.colour || null,
        taskSource: task.source || "manual",
        completed: task.completed,
        effort: task.effort,
        taskType: task.taskType,
        importance: task.importance,
        detectedTags: task.detectedTags,
        importanceSource: task.importanceSource,
      };
    });
}

export function getMonthCalendarDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);

    return {
      date,
      dateKey: formatDateKey(date),
      isCurrentMonth: date.getMonth() === month,
      isToday: formatDateKey(date) === formatDateKey(new Date()),
    };
  });
}

export function getUrgencyLabel(daysLeft) {
  if (daysLeft === null) return "No deadline";
  if (daysLeft < 0) return "Overdue";
  if (daysLeft === 0) return "Due today";
  if (daysLeft === 1) return "Due tomorrow";
  return `${daysLeft} days left`;
}

export function getUrgencyClass(daysLeft) {
  if (daysLeft === null) return "neutral";
  if (daysLeft <= 1) return "urgent";
  if (daysLeft <= 5) return "soon";
  return "safe";
}

export function getEffortLabel(effort) {
  if (effort === 1) return "Easy";
  if (effort === 2 || effort === 3) return "Medium";
  if (effort === 4) return "High";
  return "Max";
}

export function getEffortClass(effort) {
  if (effort === 1) return "effort-low";
  if (effort === 2 || effort === 3) return "effort-medium";
  if (effort === 4) return "effort-high";
  return "effort-max";
}

export function formatTime(startTime, minutesToAdd) {
  const [hours, minutes] = startTime.split(":").map(Number);

  const date = new Date();
  date.setHours(hours, minutes + minutesToAdd, 0, 0);

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getTaskTip(task) {
  const daysLeft = getDaysLeft(task.dueDate);

  if (daysLeft !== null && daysLeft < 0) {
    return "This is overdue. Aim to finish the minimum acceptable version first.";
  }

  if (daysLeft !== null && daysLeft <= 1) {
    return "Focus on completion first, polish later.";
  }

  if (task.effort >= 4) {
    return "Break this into one clear section rather than trying to finish everything.";
  }

  if (!task.dueDate) {
    return "Do this only if it is quick or blocking something else.";
  }

  return "Make steady progress and stop when the block ends.";
}

export function compareTasksSmart(a, b) {
  const aDays = getDaysLeft(a.dueDate);
  const bDays = getDaysLeft(b.dueDate);
  const safeADays = aDays === null ? 999 : aDays;
  const safeBDays = bDays === null ? 999 : bDays;

  const importanceScore = { normal: 0, high: 1, urgent: 2 };
  const importanceDifference =
    (importanceScore[b.importance] || 0) -
    (importanceScore[a.importance] || 0);

  if (safeADays !== safeBDays) {
    const dueDateGap = Math.abs(safeADays - safeBDays);
    const bothBeyondImmediateUrgency = safeADays > 1 && safeBDays > 1;

    if (
      dueDateGap <= 1 &&
      bothBeyondImmediateUrgency &&
      importanceDifference !== 0
    ) {
      return importanceDifference;
    }

    return safeADays - safeBDays;
  }

  if (importanceDifference !== 0) return importanceDifference;
  return b.effort - a.effort;
}

export function sortTasksForDisplay(taskList) {
  return [...taskList].sort(compareTasksSmart);
}

export const taskSortOptions = [
  { value: "smart", label: "Smart" },
  { value: "dueDate", label: "Due date" },
  { value: "effort", label: "Effort" },
  { value: "subject", label: "Subject" },
];

export function sortTasksByMode(taskList, sortMode) {
  if (sortMode === "smart") {
    return sortTasksForDisplay(taskList);
  }

  return [...taskList].sort((a, b) => {
    if (sortMode === "dueDate") {
      const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;

      if (aTime !== bTime) return aTime - bTime;
      const importanceScore = { normal: 0, high: 1, urgent: 2 };
      const importanceDifference =
        (importanceScore[b.importance] || 0) -
        (importanceScore[a.importance] || 0);

      if (importanceDifference !== 0) return importanceDifference;
      return b.effort - a.effort;
    }

    if (sortMode === "effort") {
      if (a.effort !== b.effort) return b.effort - a.effort;
      return compareTasksSmart(a, b);
    }

    return (
      a.subject.localeCompare(b.subject, undefined, { sensitivity: "base" }) ||
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
    );
  });
}

export function cleanPlanSequence(blocks) {
  if (blocks.some((block) => block.type === "message")) return blocks;

  return blocks.filter((block, index) => {
    if (block.type !== "break") return true;
    if (block.source === "manual") return true;

    const hasStudyBefore = blocks
      .slice(0, index)
      .some((previousBlock) => previousBlock.type === "study");
    const hasStudyAfter = blocks
      .slice(index + 1)
      .some((nextBlock) => nextBlock.type === "study");
    const previousBlock = blocks[index - 1];

    return (
      hasStudyBefore &&
      hasStudyAfter &&
      previousBlock?.type !== "break"
    );
  });
}

export function recalculatePlanTimes(blocks, startTime) {
  let currentOffset = 0;

  return blocks.map((block) => {
    if (block.type === "message") return block;

    const duration = Math.max(1, Math.round(Number(block.duration) || 1));
    const timedBlock = {
      ...block,
      duration,
      start: formatTime(startTime, currentOffset),
      end: formatTime(startTime, currentOffset + duration),
    };

    currentOffset += duration;
    return timedBlock;
  });
}

export function getPlanBlockKey(block, index) {
  if (block.type === "study") return block.id || `study-${block.taskId}`;
  if (block.type === "break") return block.id || `break-${index}`;
  return block.id;
}

export function loadSavedPlanSnapshot() {
  const savedPlan = localStorage.getItem(TODAY_PLAN_STORAGE_KEY);

  if (!savedPlan) return null;

  try {
    const parsedPlan = JSON.parse(savedPlan);

    if (
      !parsedPlan ||
      typeof parsedPlan !== "object" ||
      !Array.isArray(parsedPlan.blocks) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(parsedPlan.generatedDate || "")
    ) {
      return null;
    }

    return parsedPlan;
  } catch {
    return null;
  }
}

export function isSavedPlanForToday(savedPlan) {
  return savedPlan?.generatedDate === formatDateKey(new Date());
}

export function restoreSavedPlanBlocks(savedPlan, tasks, startTime) {
  if (!savedPlan || !Array.isArray(savedPlan.blocks)) return [];

  const taskIds = new Set(tasks.map((task) => task.id));
  const normalizedBlocks = savedPlan.blocks
    .filter(
      (block) =>
        block &&
        typeof block === "object" &&
        ["study", "break", "message"].includes(block.type)
    )
    .map((block, index) => {
      const hasValidTaskLink =
        block.taskId == null || taskIds.has(block.taskId);
      const taskId = hasValidTaskLink ? (block.taskId ?? null) : null;

      return {
        ...block,
        id: block.id || `restored-${block.type}-${index}`,
        source:
          !hasValidTaskLink && block.source === "generated"
            ? "manual"
            : block.source || (taskId == null ? "manual" : "generated"),
        taskId,
        edited: block.edited === true,
        locked: block.locked === true,
        calendarEventId: block.calendarEventId || null,
      };
    });

  const hasValidatedSmartTiming = normalizedBlocks.every(
    (block) =>
      block.type === "message" ||
      (block.plannerSource === "smart" &&
        Number.isInteger(block.startMinute) &&
        Number.isInteger(block.endMinute) &&
        block.endMinute > block.startMinute &&
        typeof block.start === "string" &&
        typeof block.end === "string")
  );

  if (hasValidatedSmartTiming) return normalizedBlocks;

  return recalculatePlanTimes(normalizedBlocks, startTime);
}

export function saveTodayPlanSnapshot({
  blocks,
  startTime,
  hoursAvailable,
  metadata = null,
}) {
  localStorage.setItem(
    TODAY_PLAN_STORAGE_KEY,
    JSON.stringify({
      generatedDate: formatDateKey(new Date()),
      savedAt: new Date().toISOString(),
      startTime,
      hoursAvailable,
      metadata,
      blocks,
    })
  );
}

export function timeToMinutes(timeValue) {
  if (!/^\d{2}:\d{2}$/.test(String(timeValue || ""))) return null;

  const [hours, minutes] = timeValue.split(":").map(Number);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

function formatDurationSummary(minutes) {
  const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;

  if (hours === 0) return `${remainingMinutes} min`;
  if (remainingMinutes === 0) return `${hours} hr`;
  return `${hours} hr ${remainingMinutes} min`;
}

function getMergedBusyIntervals(busyIntervals, startMinutes, endMinutes) {
  const clippedIntervals = (Array.isArray(busyIntervals) ? busyIntervals : [])
    .map((interval) => ({
      startMinutes: Math.max(
        startMinutes,
        Math.round(Number(interval?.startMinutes))
      ),
      endMinutes: Math.min(
        endMinutes,
        Math.round(Number(interval?.endMinutes))
      ),
    }))
    .filter(
      (interval) =>
        Number.isFinite(interval.startMinutes) &&
        Number.isFinite(interval.endMinutes) &&
        interval.endMinutes > interval.startMinutes
    )
    .sort((firstInterval, secondInterval) => {
      return firstInterval.startMinutes - secondInterval.startMinutes;
    });

  return clippedIntervals.reduce((mergedIntervals, interval) => {
    const previousInterval = mergedIntervals[mergedIntervals.length - 1];

    if (
      previousInterval &&
      interval.startMinutes <= previousInterval.endMinutes
    ) {
      previousInterval.endMinutes = Math.max(
        previousInterval.endMinutes,
        interval.endMinutes
      );
      return mergedIntervals;
    }

    mergedIntervals.push({ ...interval });
    return mergedIntervals;
  }, []);
}

function getFreeStudyIntervals(startMinutes, endMinutes, busyIntervals) {
  const mergedBusyIntervals = getMergedBusyIntervals(
    busyIntervals,
    startMinutes,
    endMinutes
  );
  const freeIntervals = [];
  let currentStart = startMinutes;

  mergedBusyIntervals.forEach((busyInterval) => {
    if (busyInterval.startMinutes > currentStart) {
      freeIntervals.push({
        startOffset: currentStart - startMinutes,
        endOffset: busyInterval.startMinutes - startMinutes,
      });
    }

    currentStart = Math.max(currentStart, busyInterval.endMinutes);
  });

  if (currentStart < endMinutes) {
    freeIntervals.push({
      startOffset: currentStart - startMinutes,
      endOffset: endMinutes - startMinutes,
    });
  }

  return {
    busyIntervals: mergedBusyIntervals,
    freeIntervals,
    usableMinutes: freeIntervals.reduce(
      (totalMinutes, interval) =>
        totalMinutes + Math.max(0, interval.endOffset - interval.startOffset),
      0
    ),
  };
}

export function getDefaultEveningPlannerDraft() {
  return {
    startTime: "16:30",
    endTime: "20:30",
    energy: "normal",
    includeBreaks: true,
    maxFocusMinutes: 35,
    planStyle: "balanced",
  };
}

function isInactiveClassroomTask(task) {
  return (
    task.source === "classroom" &&
    ["done", "returned", "turned_in", "submitted"].includes(
      task.classroomStatusCategory
    )
  );
}

function getEveningTaskScore(task) {
  const daysLeft = getDaysLeft(task.dueDate);
  const importanceScore = { urgent: 36, high: 20, normal: 0 };
  const typeScore =
    task.taskType === "assessment"
      ? 18
      : task.taskType === "project"
        ? 10
        : task.taskType === "revision"
          ? 8
          : 0;
  const dueScore =
    daysLeft === null
      ? -18
      : daysLeft < 0
        ? 70
        : daysLeft === 0
          ? 62
          : daysLeft === 1
            ? 50
            : daysLeft <= 3
              ? 38
              : daysLeft <= 7
                ? 22
                : 8;

  return (
    dueScore +
    (importanceScore[task.importance] || 0) +
    typeScore +
    (Number(task.effort) || 2)
  );
}

function getEveningTaskDuration(task, energy) {
  const effort = Number(task.effort) || 2;
  const effortDurations = {
    1: 25,
    2: 30,
    3: 35,
    4: 45,
    5: 50,
  };
  const energyAdjustment = energy === "low" ? -5 : energy === "high" ? 10 : 0;
  const assessmentBoost =
    task.taskType === "assessment" || task.importance === "high" ? 10 : 0;
  const duration = (effortDurations[effort] || 35) + energyAdjustment + assessmentBoost;

  return Math.min(60, Math.max(25, duration));
}

export function buildEveningPlan({
  tasks,
  startTime,
  endTime,
  energy = "normal",
  includeBreaks = true,
  maxFocusMinutes = 35,
  planStyle = "balanced",
  busyIntervals = [],
}) {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  if (startMinutes === null || endMinutes === null) {
    return {
      ok: false,
      reason: "Choose a start and end time.",
      blocks: [],
    };
  }

  if (endMinutes <= startMinutes) {
    return {
      ok: false,
      reason: "Choose an end time after your start time.",
      blocks: [],
    };
  }

  const availableMinutes = endMinutes - startMinutes;

  if (availableMinutes < 30) {
    return {
      ok: false,
      reason: "Give yourself at least 30 minutes.",
      blocks: [],
    };
  }

  const freeTime = getFreeStudyIntervals(
    startMinutes,
    endMinutes,
    busyIntervals
  );

  if (freeTime.usableMinutes <= 0 && freeTime.busyIntervals.length > 0) {
    return {
      ok: false,
      reason:
        "Your calendar has no free study time in this window. Choose a different time or change which calendars block study time.",
      blocks: [],
      windowMinutes: availableMinutes,
      usableMinutes: 0,
      busyMinutes: availableMinutes,
    };
  }

  if (freeTime.usableMinutes < 30) {
    return {
      ok: false,
      reason:
        freeTime.busyIntervals.length > 0
          ? `Your calendar leaves ${formatDurationSummary(
              freeTime.usableMinutes
            )} free. Choose a longer window.`
          : "Give yourself at least 30 minutes.",
      blocks: [],
      windowMinutes: availableMinutes,
      usableMinutes: freeTime.usableMinutes,
      busyMinutes: availableMinutes - freeTime.usableMinutes,
    };
  }

  const styleBufferMultiplier =
    planStyle === "light" ? 1.7 : planStyle === "push" ? 0.45 : 1;
  const baseBufferMinutes =
    availableMinutes >= 120 ? 15 : availableMinutes >= 75 ? 10 : 0;
  const bufferMinutes = Math.round(baseBufferMinutes * styleBufferMultiplier);
  let remainingMinutes = Math.max(0, freeTime.usableMinutes - bufferMinutes);
  const safeMaxFocusMinutes = [25, 35, 45, 60].includes(
    Number(maxFocusMinutes)
  )
    ? Number(maxFocusMinutes)
    : 35;
  const styleBlockMultiplier =
    planStyle === "light" ? 0.85 : planStyle === "push" ? 1.18 : 1;
  const maxStudyBlocks =
    planStyle === "light" ? 2 : planStyle === "push" ? 6 : 4;
  const breakDuration = energy === "low" ? 10 : 5;
  const candidateTasks = tasks
    .filter(
      (task) =>
        task &&
        !task.completed &&
        !task.archived &&
        !task.ignored &&
        !isInactiveClassroomTask(task)
    )
    .sort((firstTask, secondTask) => {
      const scoreDifference =
        getEveningTaskScore(secondTask) - getEveningTaskScore(firstTask);

      if (scoreDifference !== 0) return scoreDifference;
      return compareTasksSmart(firstTask, secondTask);
    });

  if (candidateTasks.length === 0) {
    return {
      ok: false,
      reason: "No active tasks to plan yet.",
      blocks: [],
    };
  }

  const blocks = [];
  let intervalIndex = 0;
  let currentOffset = freeTime.freeIntervals[0]?.startOffset || 0;
  let scheduledStudyMinutes = 0;

  function getCurrentFreeInterval() {
    return freeTime.freeIntervals[intervalIndex] || null;
  }

  function moveToNextFreeInterval() {
    intervalIndex += 1;
    currentOffset = freeTime.freeIntervals[intervalIndex]?.startOffset || 0;
  }

  function ensureMinimumFreeTime(minimumMinutes) {
    let currentInterval = getCurrentFreeInterval();

    while (
      currentInterval &&
      currentInterval.endOffset - currentOffset < minimumMinutes
    ) {
      moveToNextFreeInterval();
      currentInterval = getCurrentFreeInterval();
    }

    return currentInterval;
  }

  const totalCandidateWorkMinutes = candidateTasks.reduce(
    (totalMinutes, task) => {
      return (
        totalMinutes +
        Math.round(getEveningTaskDuration(task, energy) * styleBlockMultiplier)
      );
    },
    0
  );

  for (const task of candidateTasks) {
    const studyBlockCount = blocks.filter((block) => block.type === "study").length;
    if (studyBlockCount >= maxStudyBlocks) break;
    if (remainingMinutes < 25) break;

    let remainingTaskMinutes = Math.round(
      getEveningTaskDuration(task, energy) * styleBlockMultiplier
    );

    while (
      remainingTaskMinutes >= 20 &&
      remainingMinutes >= 25 &&
      blocks.filter((block) => block.type === "study").length < maxStudyBlocks
    ) {
      const currentInterval = ensureMinimumFreeTime(20);

      if (!currentInterval) break;

      const intervalRemaining = currentInterval.endOffset - currentOffset;
      const duration = Math.min(
        safeMaxFocusMinutes,
        remainingTaskMinutes,
        remainingMinutes,
        intervalRemaining
      );

      if (duration < 20) break;

      blocks.push({
        id: `evening-${task.id}-${currentOffset}`,
        type: "study",
        source: "generated",
        taskSource: task.source || "manual",
        edited: false,
        locked: false,
        taskId: task.id,
        calendarEventId: null,
        subject: task.subject,
        title: task.title,
        start: formatTime(startTime, currentOffset),
        end: formatTime(startTime, currentOffset + duration),
        duration,
        effort: task.effort,
        taskType: task.taskType,
        importance: task.importance,
        detectedTags: task.detectedTags,
        importanceSource: task.importanceSource,
        classroomCourseId: task.classroomCourseId || null,
        classroomCourseName: task.classroomCourseName || "",
        externalId: task.externalId || null,
        tip: getTaskTip(task),
      });

      currentOffset += duration;
      remainingMinutes -= duration;
      remainingTaskMinutes -= duration;
      scheduledStudyMinutes += duration;

      if (includeBreaks && remainingMinutes >= breakDuration + 25) {
        const breakInterval = getCurrentFreeInterval();

        if (
          !breakInterval ||
          breakInterval.endOffset - currentOffset < breakDuration + 25
        ) {
          if (breakInterval && breakInterval.endOffset - currentOffset < 25) {
            moveToNextFreeInterval();
          }
          continue;
        }

        blocks.push({
          id: `evening-break-${currentOffset}`,
          type: "break",
          source: "generated",
          edited: false,
          locked: false,
          taskId: null,
          calendarEventId: null,
          start: formatTime(startTime, currentOffset),
          end: formatTime(startTime, currentOffset + breakDuration),
          duration: breakDuration,
          title: "Break",
          tip:
            energy === "low"
              ? "Reset properly before the next block."
              : "Step away for a few minutes.",
        });

        currentOffset += breakDuration;
        remainingMinutes -= breakDuration;
      }
    }
  }

  if (blocks.length === 0) {
    return {
      ok: false,
      reason: "No task fits this time window yet.",
      blocks: [],
    };
  }

  return {
    ok: true,
    blocks: cleanPlanSequence(blocks),
    scheduledTaskCount: new Set(
      blocks
        .filter((block) => block.type === "study")
        .map((block) => block.taskId)
    ).size,
    breakCount: blocks.filter((block) => block.type === "break").length,
    windowMinutes: availableMinutes,
    usableMinutes: freeTime.usableMinutes,
    busyMinutes: availableMinutes - freeTime.usableMinutes,
    unscheduledWorkMinutes: Math.max(
      0,
      totalCandidateWorkMinutes - scheduledStudyMinutes
    ),
  };
}

export function createSubjectDraft(courseSystem = "IB") {
  return {
    name: "",
    courseSystem,
    level:
      courseSystem === "IB"
        ? "HL"
        : courseSystem === "AP"
          ? "AP"
          : courseSystem === "GCSE" || courseSystem === "A-level"
            ? "Higher"
            : "Standard",
    currentGrade: "",
    targetGrade: "",
    colour: DEFAULT_SUBJECT_COLOR,
  };
}
