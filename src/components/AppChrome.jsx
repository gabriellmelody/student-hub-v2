import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import DayloMark from "./DayloMark.jsx";
import QuickLinkIcon from "./QuickLinkIcon.jsx";
import { getPinnedQuickLinks } from "../utils/appUtils.js";

function NavButton({ label, icon, active, onClick }) {
  return (
    <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick}>
      <span className="nav-icon">{icon}</span>
      <span className="nav-label">{label}</span>
    </button>
  );
}

function getMobilePageTitle(activePage, settingsView) {
  if (activePage === "tasks") return "To-do";
  if (activePage === "plan") return "Today’s Plan";
  if (activePage === "calendar") return "Calendar";
  if (activePage === "subjects") return "Subjects";
  if (activePage === "settings") {
    if (settingsView === "integrations") return "Integrations";
    if (settingsView === "appearance") return "Appearance";
    if (settingsView === "help") return "Help & tours";
    return "Settings";
  }

  return "Home";
}

function getAccountIdentity(displayName) {
  const accountName = (displayName || "Student").trim() || "Student";
  const accountInitials =
    accountName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "S";

  return { accountName, accountInitials };
}

function MobileTopBar({ activePage, settingsView, logoAppearance }) {
  return (
    <header className="mobile-topbar" aria-label="DayLo mobile header">
      <div className="mobile-topbar-brand">
        <DayloMark
          className="mobile-topbar-mark"
          appearance={logoAppearance}
        />
        <div>
          <strong>{getMobilePageTitle(activePage, settingsView)}</strong>
          <small>DayLo</small>
        </div>
      </div>
    </header>
  );
}

function MobileBottomNav({ activePage, moreOpen, onNavigate, onToggleMore }) {
  const navItems = [
    { id: "tasks", label: "To-do", icon: "✓" },
    { id: "plan", label: "Plan", icon: "◷" },
    { id: "home", label: "Home", icon: "⌂", center: true },
    { id: "calendar", label: "Calendar", icon: "▦" },
  ];
  const moreActive = moreOpen || activePage === "subjects" || activePage === "settings";

  return (
    <nav className="mobile-bottom-nav" aria-label="Primary mobile navigation">
      {navItems.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`mobile-bottom-nav-item${
            activePage === item.id ? " active" : ""
          }${item.center ? " mobile-bottom-nav-home" : ""}`}
          aria-current={activePage === item.id ? "page" : undefined}
          onClick={() => onNavigate(item.id)}
        >
          <span aria-hidden="true">{item.icon}</span>
          <strong>{item.label}</strong>
        </button>
      ))}

      <button
        type="button"
        className={`mobile-bottom-nav-item${moreActive ? " active" : ""}`}
        aria-current={moreActive && !moreOpen ? "page" : undefined}
        aria-haspopup="dialog"
        aria-expanded={moreOpen}
        onClick={onToggleMore}
      >
        <span aria-hidden="true">•••</span>
        <strong>More</strong>
      </button>
    </nav>
  );
}

function MobileMoreSheet({
  open,
  onClose,
  setActivePage,
  openSettings,
  quickLinksPreferences,
  displayName,
  theme,
  setTheme,
}) {
  const closeButtonRef = useRef(null);
  const { accountName, accountInitials } = getAccountIdentity(displayName);
  const pinnedLinks = getPinnedQuickLinks(quickLinksPreferences);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => closeButtonRef.current?.focus());

    function closeOnEscape(event) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open]);

  if (!open || typeof document === "undefined") return null;

  function navigate(page) {
    setActivePage(page);
    onClose();
  }

  function navigateSettings(view) {
    openSettings(view);
    onClose();
  }

  return createPortal(
    <div className="mobile-more-layer" role="presentation">
      <button
        type="button"
        className="mobile-more-backdrop"
        aria-label="Close More menu"
        onClick={onClose}
      />

      <section
        className="mobile-more-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-more-title"
      >
        <div className="mobile-more-handle" aria-hidden="true" />
        <div className="mobile-more-header">
          <div>
            <p className="eyebrow">More</p>
            <h2 id="mobile-more-title">DayLo</h2>
          </div>
          <button
            type="button"
            className="mobile-more-close"
            ref={closeButtonRef}
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mobile-more-content">
          <section className="mobile-more-section" aria-label="Destinations">
            <button type="button" onClick={() => navigate("subjects")}>
              <span aria-hidden="true">◈</span>
              <strong>Subjects</strong>
            </button>
            <button type="button" onClick={() => navigateSettings("hub")}>
              <span aria-hidden="true">⚙</span>
              <strong>Settings</strong>
            </button>
            <button type="button" onClick={() => navigateSettings("integrations")}>
              <span aria-hidden="true">⇄</span>
              <strong>Integrations</strong>
            </button>
          </section>

          <section className="mobile-more-section" aria-labelledby="mobile-more-quick-links">
            <div className="mobile-more-section-heading">
              <h3 id="mobile-more-quick-links">Quick links</h3>
              <button type="button" onClick={() => navigateSettings("quickLinks")}>
                Manage
              </button>
            </div>

            {pinnedLinks.length > 0 ? (
              <div className="mobile-more-quick-links">
                {pinnedLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onClose}
                  >
                    <span aria-hidden="true">
                      <QuickLinkIcon iconId={link.iconId} />
                    </span>
                    <strong>{link.label}</strong>
                    <small aria-hidden="true">↗</small>
                  </a>
                ))}
              </div>
            ) : (
              <p className="mobile-more-empty">No pinned links yet.</p>
            )}
          </section>

          <section className="mobile-more-section" aria-labelledby="mobile-more-account">
            <div className="mobile-more-account">
              <span className="mobile-more-avatar" aria-hidden="true">
                {accountInitials}
              </span>
              <span>
                <strong id="mobile-more-account">{accountName}</strong>
                <small>Local workspace</small>
              </span>
            </div>

            <div className="mobile-more-theme" role="group" aria-label="Appearance">
              {["light", "dark", "system"].map((option) => (
                <button
                  key={option}
                  type="button"
                  className={theme === option ? "active" : ""}
                  aria-pressed={theme === option}
                  onClick={() => setTheme(option)}
                >
                  {option === "light"
                    ? "Light"
                    : option === "dark"
                      ? "Dark"
                      : "System"}
                </button>
              ))}
            </div>

            <button type="button" onClick={() => navigateSettings("appearance")}>
              <span aria-hidden="true">◐</span>
              <strong>Personalisation</strong>
            </button>
            <button type="button" onClick={() => navigateSettings("help")}>
              <span aria-hidden="true">?</span>
              <strong>Help & tours</strong>
            </button>
            <button
              type="button"
              className="mobile-more-disabled"
              disabled
              title="Log out unavailable until accounts are added"
            >
              <span aria-hidden="true">↪</span>
              <strong>Log out</strong>
              <small>Accounts coming later</small>
            </button>
          </section>
        </div>
      </section>
    </div>,
    document.body
  );
}

function QuickLinksNav({ collapsed, quickLinksPreferences, openSettings }) {
  const pinnedLinks = getPinnedQuickLinks(quickLinksPreferences);

  if (pinnedLinks.length === 0) return null;

  return (
    <section className="sidebar-quick-links" aria-label="Quick links">
      {!collapsed && <p className="sidebar-quick-links-heading">Quick links</p>}

      <div className="sidebar-quick-links-list">
        {pinnedLinks.map((link) => (
          <a
            key={link.id}
            className="sidebar-quick-link"
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            title={`${link.label} opens in a new tab`}
            aria-label={`${link.label}, external link`}
          >
            <span className="sidebar-quick-link-icon" aria-hidden="true">
              <QuickLinkIcon iconId={link.iconId} />
            </span>
            <span className="sidebar-quick-link-label">{link.label}</span>
            <span className="sidebar-quick-link-external" aria-hidden="true">
              ↗
            </span>
          </a>
        ))}
      </div>

      {!collapsed && (
        <button
          type="button"
          className="sidebar-quick-links-manage"
          onClick={() => openSettings("quickLinks")}
        >
          <span aria-hidden="true">⚙</span>
          <span>Manage links</span>
        </button>
      )}
    </section>
  );
}

function AccountMenu({
  collapsed,
  active,
  openSettings,
  displayName,
  theme,
  setTheme,
  themeColors,
}) {
  const [open, setOpen] = useState(false);
  const [personalisationOpen, setPersonalisationOpen] = useState(false);
  const [narrowMenu, setNarrowMenu] = useState(() =>
    typeof window === "undefined" ? false : window.innerWidth <= 640
  );
  const menuPanelRef = useRef(null);
  const submenuPanelRef = useRef(null);
  const accountButtonRef = useRef(null);

  function closeMenu({ restoreFocus = false } = {}) {
    setOpen(false);
    setPersonalisationOpen(false);

    if (restoreFocus) {
      requestAnimationFrame(() => accountButtonRef.current?.focus());
    }
  }

  useEffect(() => {
    if (!open) return undefined;

    function handleMenuClose(event) {
      if (event.key === "Escape") {
        closeMenu({ restoreFocus: true });
        return;
      }

      if (event.type === "pointerdown") {
        const target = event.target;
        const clickedInsideMenu =
          accountButtonRef.current?.contains(target) ||
          menuPanelRef.current?.contains(target) ||
          submenuPanelRef.current?.contains(target);

        if (!clickedInsideMenu) {
          closeMenu();
        }
      }
    }

    document.addEventListener("pointerdown", handleMenuClose);
    document.addEventListener("keydown", handleMenuClose);

    return () => {
      document.removeEventListener("pointerdown", handleMenuClose);
      document.removeEventListener("keydown", handleMenuClose);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setPersonalisationOpen(false);
  }, [open]);

  useEffect(() => {
    function updateNarrowMenu() {
      setNarrowMenu(window.innerWidth <= 640);
    }

    updateNarrowMenu();
    window.addEventListener("resize", updateNarrowMenu);

    return () => window.removeEventListener("resize", updateNarrowMenu);
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;

    function positionMenu() {
      const accountButton = accountButtonRef.current;
      const menuPanel = menuPanelRef.current;
      const submenuPanel = submenuPanelRef.current;

      if (!accountButton || !menuPanel) return;

      const viewportPadding = 10;
      const menuGap = 8;
      const buttonRect = accountButton.getBoundingClientRect();
      const menuWidth = Math.min(252, window.innerWidth - viewportPadding * 2);
      const maxHeight = Math.max(100, window.innerHeight - viewportPadding * 2);

      menuPanel.style.width = `${menuWidth}px`;
      menuPanel.style.maxHeight = `${maxHeight}px`;

      const menuHeight = Math.min(menuPanel.scrollHeight, maxHeight);
      const spaceAbove = buttonRect.top - viewportPadding;
      const spaceBelow = window.innerHeight - buttonRect.bottom - viewportPadding;
      const placeAbove = spaceAbove >= menuHeight || spaceAbove > spaceBelow;
      const proposedTop = placeAbove
        ? buttonRect.top - menuHeight - menuGap
        : buttonRect.bottom + menuGap;
      const top = Math.min(
        Math.max(viewportPadding, proposedTop),
        window.innerHeight - menuHeight - viewportPadding
      );
      const left = Math.min(
        Math.max(viewportPadding, buttonRect.left),
        window.innerWidth - menuWidth - viewportPadding
      );

      menuPanel.style.top = `${top}px`;
      menuPanel.style.left = `${left}px`;

      if (submenuPanel && personalisationOpen && !narrowMenu) {
        const submenuWidth = Math.min(248, window.innerWidth - viewportPadding * 2);
        const submenuMaxHeight = maxHeight;
        const submenuHeight = Math.min(submenuPanel.scrollHeight, submenuMaxHeight);
        const menuRect = menuPanel.getBoundingClientRect();
        const rightLeft = menuRect.right + menuGap;
        const leftLeft = menuRect.left - submenuWidth - menuGap;
        const fitsRight = rightLeft + submenuWidth <= window.innerWidth - viewportPadding;
        const proposedSubmenuLeft = fitsRight ? rightLeft : leftLeft;
        const submenuLeft = Math.min(
          Math.max(viewportPadding, proposedSubmenuLeft),
          window.innerWidth - submenuWidth - viewportPadding
        );
        const submenuTop = Math.min(
          Math.max(viewportPadding, menuRect.top),
          window.innerHeight - submenuHeight - viewportPadding
        );

        submenuPanel.style.width = `${submenuWidth}px`;
        submenuPanel.style.maxHeight = `${submenuMaxHeight}px`;
        submenuPanel.style.top = `${submenuTop}px`;
        submenuPanel.style.left = `${submenuLeft}px`;
      }
    }

    const frame = requestAnimationFrame(positionMenu);
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [collapsed, open, personalisationOpen, narrowMenu]);

  function chooseItem(action) {
    closeMenu();
    action();
  }

  function openPersonalisation() {
    setPersonalisationOpen(true);
  }

  function closePersonalisation() {
    setPersonalisationOpen(false);
  }

  const { accountName, accountInitials } = getAccountIdentity(displayName);
  const backgroundStrengthLabel =
    themeColors.backgroundStrength === "medium"
      ? "Medium"
      : themeColors.backgroundStrength === "subtle"
        ? "Subtle"
        : "Off";
  const backgroundSummary =
    themeColors.backgroundMode === "match-theme"
      ? `Match theme · ${backgroundStrengthLabel}`
      : themeColors.backgroundMode === "custom"
        ? `Custom · ${backgroundStrengthLabel}`
        : "Neutral";
  const backgroundPreview =
    themeColors.backgroundMode === "match-theme"
      ? themeColors.primary
      : themeColors.backgroundTone || themeColors.primary;

  const personalisationPanel = (
    <div
      className={`sidebar-account-submenu ${
        narrowMenu ? "sidebar-account-submenu-inline" : ""
      }`}
      role="menu"
      ref={submenuPanelRef}
    >
      <div className="sidebar-account-submenu-heading">
        {narrowMenu && (
          <button
            type="button"
            className="sidebar-account-back-button"
            onClick={closePersonalisation}
          >
            <span aria-hidden="true">‹</span>
            <span>Back</span>
          </button>
        )}
        <div>
          <strong>Personalisation</strong>
          <small>Quick appearance settings</small>
        </div>
      </div>

      <div className="sidebar-account-submenu-section">
        <span className="sidebar-account-submenu-label">Appearance</span>
        <div
          className="sidebar-account-theme-controls"
          role="group"
          aria-label="Appearance"
        >
          {["light", "dark", "system"].map((option) => (
            <button
              key={option}
              type="button"
              className={theme === option ? "active" : ""}
              aria-pressed={theme === option}
              onClick={() => setTheme(option)}
            >
              {option === "light"
                ? "Light"
                : option === "dark"
                  ? "Dark"
                  : "System"}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="sidebar-account-theme-colours-row"
        role="menuitem"
        onClick={() => chooseItem(() => openSettings("appearance"))}
      >
        <span className="sidebar-account-theme-preview" aria-hidden="true">
          <i style={{ "--account-theme-preview": themeColors.primary }} />
          <i style={{ "--account-theme-preview": themeColors.secondary }} />
          <i style={{ "--account-theme-preview": themeColors.tertiary }} />
        </span>
        <span>
          <strong>Theme colours</strong>
          <small>Open full settings</small>
        </span>
        <span aria-hidden="true">›</span>
      </button>

      <button
        type="button"
        className="sidebar-account-background-row"
        role="menuitem"
        onClick={() =>
          chooseItem(() => openSettings("appearance", "theme-background-setting"))
        }
      >
        <span
          className="sidebar-account-background-swatch"
          aria-hidden="true"
          style={{ "--account-background-preview": backgroundPreview }}
        />
        <span>
          <strong>Background</strong>
          <small>{backgroundSummary}</small>
        </span>
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );

  const menuOverlay =
    open && typeof document !== "undefined"
      ? createPortal(
          <div className="sidebar-account-overlay-layer">
            <div
              className="sidebar-account-menu"
              role="menu"
              ref={menuPanelRef}
            >
              {narrowMenu && personalisationOpen ? (
                personalisationPanel
              ) : (
                <>
                  <div className="sidebar-account-menu-heading">
                    <span
                      className="sidebar-account-menu-avatar"
                      aria-hidden="true"
                    >
                      {accountInitials}
                    </span>
                    <span className="sidebar-account-menu-copy">
                      <strong>{accountName}</strong>
                      <small>Local workspace</small>
                    </span>
                    <span
                      className="sidebar-account-menu-indicator"
                      aria-hidden="true"
                    >
                      ···
                    </span>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    aria-haspopup="menu"
                    aria-expanded={personalisationOpen}
                    onClick={openPersonalisation}
                  >
                    <span aria-hidden="true">◐</span>
                    <span>Personalisation</span>
                    <span aria-hidden="true">›</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => chooseItem(() => openSettings("hub"))}
                  >
                    <span aria-hidden="true">⚙</span>
                    <span>Settings</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => chooseItem(() => openSettings("integrations"))}
                  >
                    <span aria-hidden="true">⇄</span>
                    <span>Integrations</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => chooseItem(() => openSettings("help"))}
                  >
                    <span aria-hidden="true">?</span>
                    <span>Help & tours</span>
                    <span aria-hidden="true">›</span>
                  </button>
                  <div className="sidebar-account-menu-divider" />
                  <button
                    type="button"
                    role="menuitem"
                    className="sidebar-account-menu-disabled"
                    disabled
                    title="Log out unavailable until accounts are added"
                  >
                    <span aria-hidden="true">↪</span>
                    <span>Log out</span>
                    <small>Accounts coming later</small>
                  </button>
                </>
              )}
            </div>

            {personalisationOpen && !narrowMenu && personalisationPanel}
          </div>,
          document.body
        )
      : null;

  return (
    <div className={`sidebar-account ${open ? "is-open" : ""}`}>
      {menuOverlay}

      <button
        type="button"
        ref={accountButtonRef}
        className={`sidebar-account-button ${active ? "active" : ""}`}
        aria-label={collapsed ? "Open local workspace menu" : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          if (open) {
            closeMenu();
          } else {
            setOpen(true);
          }
        }}
      >
        <span className="sidebar-account-avatar" aria-hidden="true">
          {accountInitials}
        </span>
        <span className="sidebar-account-copy">
          <strong>{accountName}</strong>
          <small>Local workspace</small>
        </span>
        <span className="sidebar-account-chevron" aria-hidden="true">
          {open ? "⌄" : "⌃"}
        </span>
      </button>
    </div>
  );
}


export {
  AccountMenu,
  MobileBottomNav,
  MobileMoreSheet,
  MobileTopBar,
  NavButton,
  QuickLinksNav,
};
