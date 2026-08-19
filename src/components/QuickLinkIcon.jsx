import { useEffect, useState } from "react";
import { deriveSiteFaviconUrl, getKnownQuickLinkService } from "../lib/cloudQuickLinks.js";

function KnownSiteLogo({ service, className }) {
  const commonProps = { className: `${className} quick-link-site-icon`.trim(), viewBox: "0 0 24 24", "aria-hidden": true };
  if (service === "google-classroom") return <svg {...commonProps}><rect x="2" y="4" width="20" height="16" rx="2" fill="#0F9D58"/><rect x="5" y="7" width="14" height="8" fill="#fff"/><circle cx="12" cy="10" r="2" fill="#0F9D58"/><path d="M8 15c.7-1.8 2-2.7 4-2.7s3.3.9 4 2.7" fill="#0F9D58"/><path d="M5 18h14" stroke="#F4B400" strokeWidth="2"/></svg>;
  if (service === "google-calendar") return <svg {...commonProps}><rect x="3" y="3" width="18" height="18" rx="3" fill="#fff"/><path d="M3 9V6a3 3 0 0 1 3-3h3v6H3Z" fill="#4285F4"/><path d="M15 3h3a3 3 0 0 1 3 3v6h-6V3Z" fill="#34A853"/><path d="M3 15h6v6H6a3 3 0 0 1-3-3v-3Z" fill="#FBBC05"/><path d="M9 9h12v9a3 3 0 0 1-3 3H9V9Z" fill="#EA4335"/><text x="12" y="16.2" textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">31</text></svg>;
  if (service === "google-drive") return <svg {...commonProps}><path d="m9 3 3.5 6H19L15.5 3H9Z" fill="#FFC107"/><path d="m9 3-7 12h7l3.5-6L9 3Z" fill="#0F9D58"/><path d="M2 15l3.5 6h13L15 15H2Z" fill="#4285F4"/></svg>;
  if (service === "chatgpt") return <svg {...commonProps} fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M8 8.4c1-2 3.8-2.5 5.4-.8 2.3-.2 4.1 2.1 3.2 4.2 1.2 1.9 0 4.6-2.2 5-1 2-3.8 2.5-5.4.8-2.3.2-4.1-2.1-3.2-4.2-1.2-1.9 0-4.6 2.2-5Z"/><path d="m8.2 9.2 7.3 4.2M15.8 9.2l-7.3 4.2M12 6.8v8.4"/></svg>;
  if (service === "gemini") return <svg {...commonProps}><path d="M12 1.8c.7 5.7 4.5 9.5 10.2 10.2-5.7.7-9.5 4.5-10.2 10.2C11.3 16.5 7.5 12.7 1.8 12 7.5 11.3 11.3 7.5 12 1.8Z" fill="#4285F4"/><path d="M12 4.5c.8 4 3.5 6.7 7.5 7.5-4 .8-6.7 3.5-7.5 7.5-.8-4-3.5-6.7-7.5-7.5 4-.8 6.7-3.5 7.5-7.5Z" fill="#A142F4" opacity=".7"/></svg>;
  if (service === "claude") return <svg {...commonProps}><circle cx="12" cy="12" r="10" fill="#D97757"/><path d="M12 5v14M5 12h14M7.1 7.1l9.8 9.8M16.9 7.1l-9.8 9.8M8.3 5.8l7.4 12.4M18.2 8.3 5.8 15.7" stroke="#fff" strokeWidth="1.35" strokeLinecap="round"/></svg>;
  return null;
}

const QUICK_LINK_ICON_PATHS = {
  globe: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16" />
      <path d="M12 4a12 12 0 0 1 0 16" />
      <path d="M12 4a12 12 0 0 0 0 16" />
    </>
  ),
  link: (
    <>
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="M8.8 10.8 7.4 12.2a3 3 0 0 0 4.2 4.2l1.4-1.4" />
      <path d="M11 9 12.4 7.6a3 3 0 0 1 4.2 4.2l-1.4 1.4" />
    </>
  ),
  school: (
    <>
      <path d="m4 10 8-4 8 4-8 4-8-4Z" />
      <path d="M7 12.5v3.2c1.4 1 3 1.5 5 1.5s3.6-.5 5-1.5v-3.2" />
      <path d="M19 11.5v4" />
    </>
  ),
  book: (
    <>
      <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15H7.5A2.5 2.5 0 0 0 5 20.5v-15Z" />
      <path d="M5 5.5A2.5 2.5 0 0 1 7.5 8H19" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M4 10h16" />
      <path d="M8 14h2" />
      <path d="M14 14h2" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3 1.3 4.1L17 9l-3.7 1.9L12 15l-1.3-4.1L7 9l3.7-1.9L12 3Z" />
      <path d="m6 14 .7 2.1L9 17l-2.3.9L6 20l-.7-2.1L3 17l2.3-.9L6 14Z" />
      <path d="m18 14 .6 1.7L20 16.5l-1.4.8L18 19l-.6-1.7-1.4-.8 1.4-.8.6-1.7Z" />
    </>
  ),
  chat: (
    <>
      <path d="M5 6.5A3.5 3.5 0 0 1 8.5 3h7A3.5 3.5 0 0 1 19 6.5v4A3.5 3.5 0 0 1 15.5 14H11l-4.5 4v-4A3.5 3.5 0 0 1 5 10.5v-4Z" />
      <path d="M9 8.5h6" />
      <path d="M9 11h3" />
    </>
  ),
  chart: (
    <>
      <path d="M4 19h16" />
      <path d="M7 16v-5" />
      <path d="M12 16V7" />
      <path d="M17 16v-8" />
    </>
  ),
  folder: (
    <>
      <path d="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" />
    </>
  ),
  document: (
    <>
      <path d="M7 3h7l3 3v15H7V3Z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6" />
      <path d="M9 15h6" />
    </>
  ),
  video: (
    <>
      <rect x="4" y="6" width="12" height="12" rx="2" />
      <path d="m16 10 4-2v8l-4-2v-4Z" />
    </>
  ),
  mail: (
    <>
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="m5 8 7 5 7-5" />
    </>
  ),
  calculator: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <path d="M9 7h6" />
      <path d="M9 11h.01" />
      <path d="M12 11h.01" />
      <path d="M15 11h.01" />
      <path d="M9 15h.01" />
      <path d="M12 15h.01" />
      <path d="M15 15h.01" />
    </>
  ),
  code: (
    <>
      <path d="m9 8-4 4 4 4" />
      <path d="m15 8 4 4-4 4" />
      <path d="m13 6-2 12" />
    </>
  ),
  sports: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M8.5 5.5c1.5 3 4.5 6 7 13" />
      <path d="M5.5 8.5c3 1.5 6 4.5 13 7" />
    </>
  ),
  assistant: (
    <>
      <circle cx="12" cy="12" r="7" />
      <path d="M9 10h.01" />
      <path d="M15 10h.01" />
      <path d="M9 14c1.6 1.2 4.4 1.2 6 0" />
      <path d="M12 3v2" />
    </>
  ),
};

function QuickLinkIcon({ iconId = "globe", iconMode = "daylo", url = "", className = "" }) {
  const resolvedIconId = QUICK_LINK_ICON_PATHS[iconId] ? iconId : "globe";
  const knownService = iconMode === "site" ? getKnownQuickLinkService(url) : "";
  const faviconUrl = iconMode === "site" ? deriveSiteFaviconUrl(url) : "";
  const [faviconFailed, setFaviconFailed] = useState(false);

  useEffect(() => setFaviconFailed(false), [faviconUrl]);

  if (knownService) return <KnownSiteLogo service={knownService} className={className} />;

  if (faviconUrl && !faviconFailed) {
    return <img className={`${className} quick-link-site-icon`.trim()} src={faviconUrl} alt="" onError={() => setFaviconFailed(true)} />;
  }

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      aria-hidden="true"
      focusable="false"
    >
      {QUICK_LINK_ICON_PATHS[resolvedIconId]}
    </svg>
  );
}

export default QuickLinkIcon;
