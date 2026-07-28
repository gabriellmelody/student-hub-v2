import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getDaysLeft,
  formatDateKey,
  getUrgencyLabel,
  getUrgencyClass,
  getWidgetsForArea,
  sortTasksForDisplay,
} from "../utils/appUtils.js";

function NavButton({ label, icon, active, onClick }) {
  return (
    <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick}>
      <span className="nav-icon">{icon}</span>
      <span className="nav-label">{label}</span>
    </button>
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

  const accountName = (displayName || "Student").trim() || "Student";
  const accountInitials = accountName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "S";

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
                    <span>Help / FAQ</span>
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

function RightRail({
  tasks,
  planBlocks,
  setActivePage,
  collapsed,
  setCollapsed,
  widgetConfig,
  setWidgetConfig,
  editMode,
  setEditMode,
}) {
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [draggedWidgetId, setDraggedWidgetId] = useState(null);
  const [dragOverWidgetId, setDragOverWidgetId] = useState(null);
  const [droppedWidgetId, setDroppedWidgetId] = useState(null);
  const widgetNodesRef = useRef(new Map());
  const flipFirstRectsRef = useRef(null);
  const flipAnimationFrameRef = useRef(null);
  const activeDragIdRef = useRef(null);
  const lastDragOverIdRef = useRef(null);
  const dropSettleTimerRef = useRef(null);

  useEffect(() => {
    const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clockTimer);
  }, []);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(flipAnimationFrameRef.current);
      clearTimeout(dropSettleTimerRef.current);
    };
  }, []);

  const datedTasks = sortTasksForDisplay(
    tasks.filter((task) => !task.completed && task.dueDate)
  );
  const upcomingDeadlines = datedTasks.slice(0, 3);
  const planPreview = planBlocks
    .filter((block) => block.type === "study")
    .slice(0, 2);
  const schoolDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + index);
    const dateKey = formatDateKey(date);

    return {
      dateKey,
      dayLabel: date.toLocaleDateString(undefined, { weekday: "short" }),
      dateLabel: date.getDate(),
      deadlineCount: datedTasks.filter((task) => task.dueDate === dateKey)
        .length,
      isToday: index === 0,
    };
  });
  const railWidgets = getWidgetsForArea(widgetConfig, "rightRail");
  const hiddenRailWidgets = getWidgetsForArea(
    widgetConfig,
    "rightRail",
    false
  ).filter((widget) => !widget.visible);

  useLayoutEffect(() => {
    const firstRects = flipFirstRectsRef.current;

    if (!firstRects) return;

    flipFirstRectsRef.current = null;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    cancelAnimationFrame(flipAnimationFrameRef.current);
    const animatedWidgets = [];

    widgetNodesRef.current.forEach((node, widgetId) => {
      const firstRect = firstRects.get(widgetId);

      if (!firstRect) return;

      const lastRect = node.getBoundingClientRect();
      const deltaY = firstRect.top - lastRect.top;

      if (Math.abs(deltaY) < 1) return;

      node.style.transition = "none";
      node.style.transform = `translateY(${deltaY}px)`;
      node.style.zIndex = widgetId === activeDragIdRef.current ? "3" : "2";
      node.style.willChange = "transform";
      animatedWidgets.push(node);
    });

    flipAnimationFrameRef.current = requestAnimationFrame(() => {
      animatedWidgets.forEach((node) => {
        node.style.transition =
          "transform 210ms cubic-bezier(0.22, 1, 0.36, 1), border-color 160ms ease, box-shadow 160ms ease, opacity 160ms ease";
        node.style.transform = "";
      });
    });

    const cleanupTimer = setTimeout(() => {
      animatedWidgets.forEach((node) => {
        node.style.transition = "";
        node.style.transform = "";
        node.style.zIndex = "";
        node.style.willChange = "";
      });
    }, 270);

    return () => clearTimeout(cleanupTimer);
  }, [widgetConfig]);

  function setWidgetNode(widgetId, node) {
    if (node) {
      widgetNodesRef.current.set(widgetId, node);
    } else {
      widgetNodesRef.current.delete(widgetId);
    }
  }

  function getWidgetRects() {
    const rects = new Map();

    widgetNodesRef.current.forEach((node, widgetId) => {
      rects.set(widgetId, node.getBoundingClientRect());
    });

    return rects;
  }

  function updateRailWidget(widgetId, updates) {
    setWidgetConfig((currentConfig) =>
      currentConfig.map((widget) =>
        widget.id === widgetId ? { ...widget, ...updates } : widget
      )
    );
  }

  function reorderRailWidgets(activeWidgetId, overWidgetId) {
    if (
      !activeWidgetId ||
      !overWidgetId ||
      activeWidgetId === overWidgetId
    ) {
      return;
    }

    setWidgetConfig((currentConfig) => {
      const orderedRailWidgets = getWidgetsForArea(
        currentConfig,
        "rightRail",
        false
      );
      const visibleWidgets = orderedRailWidgets.filter(
        (widget) => widget.visible
      );
      const hiddenWidgets = orderedRailWidgets.filter(
        (widget) => !widget.visible
      );
      const activeIndex = visibleWidgets.findIndex(
        (widget) => widget.id === activeWidgetId
      );
      const overIndex = visibleWidgets.findIndex(
        (widget) => widget.id === overWidgetId
      );

      if (activeIndex < 0 || overIndex < 0) return currentConfig;

      const reorderedVisibleWidgets = [...visibleWidgets];
      const [movedWidget] = reorderedVisibleWidgets.splice(activeIndex, 1);
      reorderedVisibleWidgets.splice(overIndex, 0, movedWidget);

      const nextRailOrder = [...reorderedVisibleWidgets, ...hiddenWidgets];
      const orderById = new Map(
        nextRailOrder.map((widget, order) => [widget.id, order])
      );

      return currentConfig.map((widget) =>
        widget.area === "rightRail"
          ? { ...widget, order: orderById.get(widget.id) }
          : widget
      );
    });
  }

  function resetDragState() {
    activeDragIdRef.current = null;
    lastDragOverIdRef.current = null;
    setDraggedWidgetId(null);
    setDragOverWidgetId(null);
  }

  function handleDragStart(event, widgetId) {
    if (!editMode) {
      event.preventDefault();
      return;
    }

    const widgetNode = widgetNodesRef.current.get(widgetId);

    if (!widgetNode) return;

    activeDragIdRef.current = widgetId;
    lastDragOverIdRef.current = widgetId;
    setDraggedWidgetId(widgetId);
    setDroppedWidgetId(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/right-rail-widget", widgetId);

    const widgetRect = widgetNode.getBoundingClientRect();
    const dragOffsetX = Math.max(
      12,
      Math.min(widgetRect.width - 12, event.clientX - widgetRect.left)
    );
    const dragOffsetY = Math.max(
      10,
      Math.min(widgetRect.height - 10, event.clientY - widgetRect.top)
    );

    event.dataTransfer.setDragImage(widgetNode, dragOffsetX, dragOffsetY);
  }

  function handleDragOver(event, overWidgetId) {
    if (!editMode) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverWidgetId(overWidgetId);

    const activeWidgetId =
      activeDragIdRef.current ||
      event.dataTransfer.getData("text/right-rail-widget");
    const activeIndex = railWidgets.findIndex(
      (widget) => widget.id === activeWidgetId
    );
    const overIndex = railWidgets.findIndex(
      (widget) => widget.id === overWidgetId
    );

    if (
      !activeWidgetId ||
      activeWidgetId === overWidgetId ||
      activeIndex < 0 ||
      overIndex < 0 ||
      lastDragOverIdRef.current === overWidgetId
    ) {
      return;
    }

    const overNode = widgetNodesRef.current.get(overWidgetId);

    if (!overNode) return;

    const overRect = overNode.getBoundingClientRect();
    const movingDown = activeIndex < overIndex;
    const pointerPastMidpoint =
      event.clientY > overRect.top + overRect.height / 2;

    if (
      (movingDown && !pointerPastMidpoint) ||
      (!movingDown && pointerPastMidpoint)
    ) {
      return;
    }

    flipFirstRectsRef.current = getWidgetRects();
    lastDragOverIdRef.current = overWidgetId;
    reorderRailWidgets(activeWidgetId, overWidgetId);
  }

  function handleDrop(event) {
    event.preventDefault();
    const droppedId = activeDragIdRef.current;
    resetDragState();

    if (!droppedId) return;

    clearTimeout(dropSettleTimerRef.current);
    setDroppedWidgetId(droppedId);
    dropSettleTimerRef.current = setTimeout(() => {
      setDroppedWidgetId(null);
    }, 230);
  }

  function handleDragHandleKeyDown(event, widgetId) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

    const currentIndex = railWidgets.findIndex(
      (widget) => widget.id === widgetId
    );
    const nextIndex = currentIndex + (event.key === "ArrowUp" ? -1 : 1);

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= railWidgets.length) {
      return;
    }

    event.preventDefault();
    flipFirstRectsRef.current = getWidgetRects();
    reorderRailWidgets(widgetId, railWidgets[nextIndex].id);
  }

  function getDragClass(widgetId) {
    if (!editMode) return "";

    return ` right-rail-widget--editing${
      draggedWidgetId === widgetId ? " right-rail-widget--dragging" : ""
    }${
      dragOverWidgetId === widgetId ? " right-rail-widget--drag-over" : ""
    }${droppedWidgetId === widgetId ? " right-rail-widget--dropped" : ""}`;
  }

  function getDragProps(widgetId) {
    return {
      ref: (node) => setWidgetNode(widgetId, node),
      "data-right-rail-widget-id": widgetId,
      onDragOver: editMode
        ? (event) => handleDragOver(event, widgetId)
        : undefined,
      onDrop: editMode ? handleDrop : undefined,
    };
  }

  function renderEditControls(widget) {
    if (!editMode) return null;

    return (
      <div className="right-rail-widget-edit-controls">
        <button
          type="button"
          className="right-rail-drag-handle"
          draggable
          aria-label={`Move ${widget.label}. Use drag or arrow keys.`}
          title="Drag to reorder"
          onDragStart={(event) => handleDragStart(event, widget.id)}
          onDragEnd={resetDragState}
          onKeyDown={(event) => handleDragHandleKeyDown(event, widget.id)}
        >
          <span aria-hidden="true">⠿</span>
        </button>
        <button
          type="button"
          className="right-rail-widget-hide-button"
          onClick={() => updateRailWidget(widget.id, { visible: false })}
        >
          Hide
        </button>
      </div>
    );
  }

  function renderRailWidget(widget) {
    if (widget.type === "clock") {
      return (
        <section
          className={`right-rail-widget right-rail-widget--clock${getDragClass(
            widget.id
          )}`}
          key={widget.id}
          {...getDragProps(widget.id)}
        >
          {renderEditControls(widget)}
          <div className="rail-widget-header">
            <h3>Clock</h3>
            <span>Device time</span>
          </div>
          <time dateTime={currentTime.toISOString()}>
            <strong>
              {currentTime.toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </strong>
            <span>
              {currentTime.toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </span>
          </time>
        </section>
      );
    }

    if (widget.type === "calendar") {
      return (
        <section
          className={`right-rail-widget right-rail-widget--calendar${getDragClass(
            widget.id
          )}`}
          key={widget.id}
          {...getDragProps(widget.id)}
        >
          {renderEditControls(widget)}
          <div className="rail-widget-header">
            <button
              type="button"
              className="rail-widget-title-button"
              onClick={() => setActivePage("calendar")}
            >
              School calendar
            </button>
            <span>Next 7 days</span>
          </div>

          <div className="school-week" aria-label="Upcoming school deadlines">
            {schoolDays.map((day) => (
              <button
                type="button"
                key={day.dateKey}
                className={`school-day ${day.isToday ? "today" : ""} ${
                  day.deadlineCount > 0 ? "has-deadline" : ""
                }`}
                onClick={() => setActivePage("calendar")}
                title={
                  day.deadlineCount > 0
                    ? `${day.deadlineCount} task${
                        day.deadlineCount === 1 ? "" : "s"
                      } due`
                    : "No school tasks due"
                }
              >
                <span>{day.dayLabel}</span>
                <strong>{day.dateLabel}</strong>
                <i aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      );
    }

    if (widget.type === "deadlines") {
      return (
        <section
          className={`right-rail-widget right-rail-widget--deadlines${getDragClass(
            widget.id
          )}`}
          key={widget.id}
          {...getDragProps(widget.id)}
        >
          {renderEditControls(widget)}
          <div className="rail-widget-header">
            <h3>Upcoming deadlines</h3>
            <button type="button" onClick={() => setActivePage("tasks")}>
              View tasks
            </button>
          </div>

          {upcomingDeadlines.length > 0 ? (
            <div className="rail-deadline-list">
              {upcomingDeadlines.map((task) => {
                const daysLeft = getDaysLeft(task.dueDate);

                return (
                  <button
                    type="button"
                    className="rail-deadline"
                    key={task.id}
                    onClick={() => setActivePage("tasks")}
                  >
                    <span>
                      <small>{task.subject}</small>
                      <strong>{task.title}</strong>
                    </span>
                    <span className={`urgency ${getUrgencyClass(daysLeft)}`}>
                      {getUrgencyLabel(daysLeft)}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rail-empty">No upcoming school deadlines.</p>
          )}
        </section>
      );
    }

    if (widget.type === "plan") {
      return (
        <section
          className={`right-rail-widget right-rail-widget--plan${getDragClass(
            widget.id
          )}`}
          key={widget.id}
          {...getDragProps(widget.id)}
        >
          {renderEditControls(widget)}
          <div className="rail-widget-header">
            <h3>Today’s Plan</h3>
            <button type="button" onClick={() => setActivePage("plan")}>
              Open plan
            </button>
          </div>

          {planPreview.length > 0 ? (
            <div className="rail-plan-list">
              {planPreview.map((block) => (
                <div className="rail-plan-item" key={block.id}>
                  <span>{block.start}</span>
                  <strong>{block.title}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="rail-plan-empty">
              <p>No study plan yet.</p>
              <button type="button" onClick={() => setActivePage("plan")}>
                Go to Today’s Plan
              </button>
            </div>
          )}
        </section>
      );
    }

    return null;
  }

  return (
    <aside
      className={`right-rail ${collapsed ? "collapsed" : ""} ${
        editMode ? "right-rail--editing" : ""
      }`}
      aria-label="Side Panel school widgets"
    >
      <div className="right-rail-toolbar">
        <div className="right-rail-heading">
          <p className="eyebrow">School widgets</p>
          <h2>At a glance</h2>
        </div>
        <button
          type="button"
          className="right-rail-collapse-button"
          aria-label={
            editMode
              ? "Finish editing before collapsing the Side Panel"
              : collapsed
                ? "Expand Side Panel"
                : "Collapse Side Panel"
          }
          disabled={editMode}
          onClick={() => setCollapsed(!collapsed)}
        >
          →
        </button>
      </div>

      <div className="right-rail-content">
        {editMode && (
          <div className="right-rail-edit-bar">
            <div>
              <strong>Editing Side Panel</strong>
              <p>Drag to reorder, or hide widgets.</p>
            </div>
            <div className="right-rail-edit-actions">
              <button
                type="button"
                disabled={hiddenRailWidgets.length === 0}
                onClick={() =>
                  setShowAddWidget((currentValue) => !currentValue)
                }
              >
                Add widget
              </button>
              <button
                type="button"
                className="right-rail-edit-done"
                onClick={() => {
                  setShowAddWidget(false);
                  setEditMode(false);
                }}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {editMode && showAddWidget && hiddenRailWidgets.length > 0 && (
          <div className="right-rail-add-widget-panel">
            {hiddenRailWidgets.map((widget) => (
              <button
                type="button"
                key={widget.id}
                onClick={() => updateRailWidget(widget.id, { visible: true })}
              >
                <span>{widget.label}</span>
                <span aria-hidden="true">+</span>
              </button>
            ))}
          </div>
        )}

        {railWidgets.length === 0 && (
          <div className="right-rail-empty">
            <strong>No widgets selected.</strong>
            <p>
              {editMode
                ? "Use Add widget to restore one."
                : "Choose widgets in Appearance settings."}
            </p>
          </div>
        )}

        {railWidgets.map(renderRailWidget)}
      </div>
    </aside>
  );
}

export { AccountMenu, NavButton, RightRail };
