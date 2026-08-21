export const SETTINGS_SEARCH_REGISTRY = [
  { id: "appearance", label: "Appearance", section: "Settings", view: "appearance", aliases: ["theme", "dark", "light"] },
  { id: "appearance-mode", label: "Appearance mode", section: "Appearance", view: "appearance", anchor: "appearance-mode", aliases: ["theme", "dark", "light", "system"] },
  { id: "accent-colour", label: "Accent colour", section: "Appearance", view: "appearance", anchor: "accent-colour", aliases: ["color", "colour", "palette", "theme colours"] },
  { id: "density", label: "Density", section: "Appearance", view: "appearance", anchor: "density", aliases: ["compact", "comfortable", "layout"] },
  { id: "subjects", label: "Subjects", section: "Settings", view: "subjects", aliases: ["courses", "grades"] },
  { id: "quick-links", label: "Quick links", section: "Settings", view: "quickLinks", aliases: ["shortcuts", "links"] },
  { id: "integrations", label: "Integrations", section: "Settings", view: "integrations", aliases: ["google", "classroom", "calendar"] },
  { id: "google-classroom", label: "Google Classroom", section: "Integrations", view: "integrations", anchor: "google-classroom", aliases: ["classroom", "classes"] },
  { id: "google-calendar", label: "Google Calendar", section: "Integrations", view: "integrations", anchor: "google-calendar", aliases: ["calendar"] },
  { id: "notifications", label: "Notifications", section: "Settings", view: "notifications", aliases: ["alerts", "reminders", "push"] },
  { id: "planning-reminder", label: "Plan my evening reminder", section: "Notifications", view: "notifications", anchor: "planning-reminder", aliases: ["planning reminder", "5pm", "5 pm", "daily planning"] },
  { id: "quiet-hours", label: "Quiet hours", section: "Notifications", view: "notifications", anchor: "quiet-hours", aliases: ["quiet", "do not disturb"] },
  { id: "account-security", label: "Account & security", section: "Settings", view: "accountSecurity", aliases: ["security", "password", "change password"] },
  { id: "change-password", label: "Change password", section: "Account & security", view: "accountSecurity", anchor: "change-password", aliases: ["password", "security"] },
  { id: "app-updates", label: "App & updates", section: "Settings", view: "appUpdates", aliases: ["install", "update", "pwa"] },
];

function normalized(value) { return String(value || "").trim().toLowerCase(); }
export function searchSettings(query, registry = SETTINGS_SEARCH_REGISTRY) {
  const q = normalized(query); if (!q) return [];
  return registry.map((item, index) => {
    const label = normalized(item.label); const aliases = (item.aliases || []).map(normalized); const section = normalized(item.section);
    let score = label === q ? 500 : label.startsWith(q) ? 400 : aliases.includes(q) ? 350 : aliases.some((alias) => alias.startsWith(q) || alias.includes(q)) ? 300 : section.includes(q) ? 200 : `${label} ${aliases.join(" ")} ${section}`.split(/\s+/).some((word) => word.includes(q)) ? 100 : 0;
    if (score > 0 && item.anchor) score += 1;
    return { ...item, score, index };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.index - b.index);
}
