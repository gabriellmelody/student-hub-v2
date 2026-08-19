import { normalizeQuickLinkUrl, quickLinkPresets } from "../utils/appUtils.js";

const COLUMNS = "id,user_id,name,url,icon_mode,icon_key,pinned,sort_order,created_at,updated_at";
const ICON_KEYS = new Set(["globe", "school", "calendar", "book", "sparkles", "folder", "calculator", "video", "mail", "link"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanName(value) { return String(value || "").trim().slice(0, 42) || "Quick Link"; }
function cleanIconKey(value) { return ICON_KEYS.has(value) ? value : "globe"; }

export function deriveSiteFaviconUrl(value) {
  const normalized = normalizeQuickLinkUrl(value);
  if (!normalized.ok) return "";
  return `${new URL(normalized.url).origin}/favicon.ico`;
}

export function getKnownQuickLinkService(value) {
  const normalized = normalizeQuickLinkUrl(value);
  if (!normalized.ok) return "";
  const host = new URL(normalized.url).hostname.toLowerCase().replace(/^www\./, "");
  if (host === "classroom.google.com") return "google-classroom";
  if (host === "calendar.google.com") return "google-calendar";
  if (host === "drive.google.com") return "google-drive";
  if (host === "chatgpt.com" || host === "chat.openai.com") return "chatgpt";
  if (host === "gemini.google.com") return "gemini";
  if (host === "claude.ai") return "claude";
  return "";
}

export function mapCloudQuickLink(row = {}) {
  return {
    id: String(row.id || ""), label: cleanName(row.name), url: String(row.url || ""),
    iconMode: row.icon_mode === "daylo" ? "daylo" : "site",
    iconId: cleanIconKey(row.icon_key), defaultIconId: "globe", type: "custom",
    pinned: row.pinned !== false,
    sortOrder: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
    pinnedOrder: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
  };
}

export function mapQuickLinkForWrite(link, userId, sortOrder = link?.sortOrder ?? 0) {
  const normalized = normalizeQuickLinkUrl(link?.url);
  if (!normalized.ok) throw new Error(normalized.error);
  const iconMode = link?.iconMode === "daylo" ? "daylo" : "site";
  return { user_id: userId, name: cleanName(link?.label), url: normalized.url, icon_mode: iconMode,
    icon_key: iconMode === "daylo" ? cleanIconKey(link?.iconId) : null,
    pinned: link?.pinned !== false, sort_order: sortOrder };
}

export function getDefaultCloudQuickLinks() {
  const pinnedIds = ["google-classroom", "google-calendar", "chatgpt"];
  return quickLinkPresets.filter((item) => normalizeQuickLinkUrl(item.url).ok)
    .map((item, index) => ({
      label: item.label,
      url: item.url,
      iconMode: "site",
      iconId: item.iconId,
      pinned: pinnedIds.includes(item.id),
      pinnedOrder: index,
      type: "custom",
    }));
}

export async function fetchCloudQuickLinks(client, userId) {
  const { data, error } = await client.from("quick_links").select(COLUMNS).eq("user_id", userId)
    .order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(mapCloudQuickLink);
}

export async function fetchQuickLinksInitialized(client, userId) {
  const { data, error } = await client.from("quick_links_state").select("user_id,initialized_at").eq("user_id", userId).maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  return Boolean(data);
}

async function markInitialized(client, userId) {
  const { error } = await client.from("quick_links_state").upsert({ user_id: userId }, { onConflict: "user_id" });
  if (error) throw error;
}

export async function initializeCloudQuickLinks(client, userId, links = getDefaultCloudQuickLinks()) {
  const payloads = links.map((link, index) => mapQuickLinkForWrite(link, userId, index));
  if (payloads.length) {
    const { error } = await client.from("quick_links").insert(payloads);
    if (error) throw error;
  }
  await markInitialized(client, userId);
  return fetchCloudQuickLinks(client, userId);
}

export function dedupeLegacyQuickLinks(cloudLinks = [], legacyLinks = []) {
  const urls = new Set(cloudLinks.map((link) => normalizeQuickLinkUrl(link.url).url.toLowerCase()));
  return legacyLinks.filter((link) => {
    const normalized = normalizeQuickLinkUrl(link.url);
    if (!normalized.ok || urls.has(normalized.url.toLowerCase())) return false;
    urls.add(normalized.url.toLowerCase()); return true;
  });
}

export async function importLegacyQuickLinks(client, userId, cloudLinks, legacyLinks) {
  const unique = dedupeLegacyQuickLinks(cloudLinks, legacyLinks);
  for (const [offset, link] of unique.entries()) {
    const { error } = await client.from("quick_links").insert(mapQuickLinkForWrite(link, userId, cloudLinks.length + offset));
    if (error) throw error;
  }
  await markInitialized(client, userId);
  return fetchCloudQuickLinks(client, userId);
}

export async function reconcileCloudQuickLinks(client, userId, current, next) {
  const currentIds = new Set(current.map((link) => link.id));
  const nextIds = new Set(next.filter((link) => UUID_PATTERN.test(link.id)).map((link) => link.id));
  for (const [index, link] of next.entries()) {
    const sortOrder = Number.isFinite(Number(link.sortOrder)) ? Number(link.sortOrder) : index;
    const payload = mapQuickLinkForWrite(link, userId, sortOrder);
    if (UUID_PATTERN.test(link.id) && currentIds.has(link.id)) {
      const { error } = await client.from("quick_links").update(payload).eq("user_id", userId).eq("id", link.id);
      if (error) throw error;
    } else {
      const { error } = await client.from("quick_links").insert(payload);
      if (error) throw error;
    }
  }
  for (const link of current) if (!nextIds.has(link.id)) {
    const { error } = await client.from("quick_links").delete().eq("user_id", userId).eq("id", link.id);
    if (error) throw error;
  }
  await markInitialized(client, userId);
  return fetchCloudQuickLinks(client, userId);
}

export function subscribeToCloudQuickLinkChanges(client, userId, onChange) {
  const channel = client.channel(`quick-links:${userId}`).on("postgres_changes",
    { event: "*", schema: "public", table: "quick_links", filter: `user_id=eq.${userId}` }, onChange).subscribe();
  return () => client.removeChannel?.(channel) || channel?.unsubscribe?.();
}
