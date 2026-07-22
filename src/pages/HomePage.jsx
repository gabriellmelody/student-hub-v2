import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  getDaysLeft,
  formatDateKey,
  parseDateKey,
  getTaskCalendarEvents,
  getUrgencyLabel,
  getUrgencyClass,
  getEffortLabel,
  getEffortClass,
  getTaskSignalBadges,
  getWidgetsForArea,
} from "../utils/appUtils.js";
import TaskSourceBadge from "../components/TaskSourceBadge.jsx";

function HomePage({
  tasks,
  subjects,
  activeTasks,
  completedTasks,
  noDeadlineTasks,
  hiddenBacklogCount,
  progressPercentage,
  nextTask,
  openEveningPlanner,
  hasPlan,
  setActivePage,
  homeLayout,
  widgetConfig,
  setWidgetConfig,
  homeEditMode,
  setHomeEditMode,
}) {
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
  const homeWidgets = getWidgetsForArea(widgetConfig, "home");
  const hiddenHomeWidgets = getWidgetsForArea(
    widgetConfig,
    "home",
    false
  ).filter((widget) => !widget.visible);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(flipAnimationFrameRef.current);
      clearTimeout(dropSettleTimerRef.current);
    };
  }, []);

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
      const deltaX = firstRect.left - lastRect.left;
      const deltaY = firstRect.top - lastRect.top;

      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;

      node.style.transition = "none";
      node.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
      node.style.zIndex = widgetId === activeDragIdRef.current ? "3" : "2";
      node.style.willChange = "transform";
      animatedWidgets.push(node);
    });

    flipAnimationFrameRef.current = requestAnimationFrame(() => {
      animatedWidgets.forEach((node) => {
        node.style.transition =
          "transform 220ms cubic-bezier(0.22, 1, 0.36, 1), border-color 160ms ease, box-shadow 160ms ease, opacity 160ms ease";
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
    }, 280);

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

  function reorderHomeWidgets(activeWidgetId, overWidgetId) {
    if (
      !activeWidgetId ||
      !overWidgetId ||
      activeWidgetId === overWidgetId
    ) {
      return;
    }

    setWidgetConfig((currentConfig) => {
      const orderedHomeWidgets = getWidgetsForArea(
        currentConfig,
        "home",
        false
      );
      const visibleWidgets = orderedHomeWidgets.filter(
        (widget) => widget.visible
      );
      const hiddenWidgets = orderedHomeWidgets.filter(
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

      const nextHomeOrder = [...reorderedVisibleWidgets, ...hiddenWidgets];
      const orderById = new Map(
        nextHomeOrder.map((widget, order) => [widget.id, order])
      );

      return currentConfig.map((widget) =>
        widget.area === "home"
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

  function handleWidgetDragStart(event, widgetId) {
    if (!homeEditMode) {
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
    event.dataTransfer.setData("text/home-widget", widgetId);

    const widgetRect = widgetNode.getBoundingClientRect();
    const dragOffsetX = Math.max(
      16,
      Math.min(widgetRect.width - 16, event.clientX - widgetRect.left)
    );
    const dragOffsetY = Math.max(
      12,
      Math.min(widgetRect.height - 12, event.clientY - widgetRect.top)
    );

    event.dataTransfer.setDragImage(widgetNode, dragOffsetX, dragOffsetY);
  }

  function handleWidgetDragOver(event, overWidgetId) {
    if (!homeEditMode) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverWidgetId(overWidgetId);

    const activeWidgetId =
      activeDragIdRef.current ||
      event.dataTransfer.getData("text/home-widget");
    const activeIndex = homeWidgets.findIndex(
      (widget) => widget.id === activeWidgetId
    );
    const overIndex = homeWidgets.findIndex(
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

    const activeNode = widgetNodesRef.current.get(activeWidgetId);
    const overNode = widgetNodesRef.current.get(overWidgetId);

    if (!activeNode || !overNode) return;

    const activeRect = activeNode.getBoundingClientRect();
    const overRect = overNode.getBoundingClientRect();
    const sameRow =
      Math.abs(activeRect.top - overRect.top) <
      Math.min(activeRect.height, overRect.height) / 2;
    const movingForward = activeIndex < overIndex;
    const pointerPastMidpoint = sameRow
      ? event.clientX > overRect.left + overRect.width / 2
      : event.clientY > overRect.top + overRect.height / 2;

    if (
      (movingForward && !pointerPastMidpoint) ||
      (!movingForward && pointerPastMidpoint)
    ) {
      return;
    }

    flipFirstRectsRef.current = getWidgetRects();
    lastDragOverIdRef.current = overWidgetId;
    reorderHomeWidgets(activeWidgetId, overWidgetId);
  }

  function handleWidgetDrop(event) {
    event.preventDefault();
    const droppedId = activeDragIdRef.current;
    resetDragState();

    if (!droppedId) return;

    clearTimeout(dropSettleTimerRef.current);
    setDroppedWidgetId(droppedId);
    dropSettleTimerRef.current = setTimeout(() => {
      setDroppedWidgetId(null);
    }, 240);
  }

  function handleDragHandleKeyDown(event, widgetId) {
    const keyDirection = {
      ArrowLeft: -1,
      ArrowUp: -1,
      ArrowRight: 1,
      ArrowDown: 1,
    }[event.key];

    if (!keyDirection) return;

    const currentIndex = homeWidgets.findIndex(
      (widget) => widget.id === widgetId
    );
    const nextIndex = currentIndex + keyDirection;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= homeWidgets.length) {
      return;
    }

    event.preventDefault();
    flipFirstRectsRef.current = getWidgetRects();
    reorderHomeWidgets(widgetId, homeWidgets[nextIndex].id);
  }

  function getWidgetDragClass(widgetId) {
    if (!homeEditMode) return "";

    return ` home-widget--editing${
      draggedWidgetId === widgetId ? " home-widget--dragging" : ""
    }${dragOverWidgetId === widgetId ? " home-widget--drag-over" : ""}${
      droppedWidgetId === widgetId ? " home-widget--dropped" : ""
    }`;
  }

  function getWidgetDragProps(widgetId) {
    return {
      ref: (node) => setWidgetNode(widgetId, node),
      "data-home-widget-id": widgetId,
      onDragOver: homeEditMode
        ? (event) => handleWidgetDragOver(event, widgetId)
        : undefined,
      onDrop: homeEditMode ? handleWidgetDrop : undefined,
    };
  }

  function updateWidget(widgetId, updates) {
    setWidgetConfig((currentConfig) =>
      currentConfig.map((widget) =>
        widget.id === widgetId ? { ...widget, ...updates } : widget
      )
    );
  }

  function finishEditing() {
    setShowAddWidget(false);
    setHomeEditMode(false);
  }

  function renderWidgetControls(widget, supportsSize = false) {
    if (!homeEditMode) return null;

    return (
      <HomeWidgetControls
        widget={widget}
        supportsSize={supportsSize}
        onUpdate={updateWidget}
        onDragStart={handleWidgetDragStart}
        onDragEnd={resetDragState}
        onDragHandleKeyDown={handleDragHandleKeyDown}
      />
    );
  }

  function renderHomeWidget(widget) {
    if (widget.type === "nextFocus") {
      return (
        <section
          className={`home-widget home-widget--focus home-widget--size-${
            widget.size
          }${getWidgetDragClass(widget.id)}`}
          key={widget.id}
          {...getWidgetDragProps(widget.id)}
        >
          {renderWidgetControls(widget)}
          <div className="home-widget-header">
            <h3>Next focus</h3>
          </div>

          {nextTask ? (
            <div className="focus-card">
              <p>{nextTask.subject}</p>
              <h3>{nextTask.title}</h3>
              {(getTaskSignalBadges(nextTask).length > 0 ||
                ["classroom", "classroom-mock"].includes(
                  nextTask.taskSource || nextTask.source
                )) && (
                <div className="task-signal-badges focus-task-signals">
                  <TaskSourceBadge task={nextTask} />
                  {getTaskSignalBadges(nextTask)
                    .slice(0, 2)
                    .map((badge) => (
                      <span
                        className={`task-signal-badge task-signal-${badge.tone}`}
                        key={`${badge.tone}-${badge.label}`}
                      >
                        {badge.label}
                      </span>
                    ))}
                </div>
              )}
              <div className="focus-meta-row">
                <span>{getUrgencyLabel(getDaysLeft(nextTask.dueDate))}</span>
                <span
                  className={`effort-pill ${getEffortClass(nextTask.effort)}`}
                >
                  {getEffortLabel(nextTask.effort)} · {nextTask.effort}/5
                </span>
              </div>
            </div>
          ) : (
            <div className="empty-plan">
              <h3>No tasks yet.</h3>
              <p>Add a task to start shaping your day.</p>
            </div>
          )}

          <button
            className="secondary-button"
            onClick={() => setActivePage("tasks")}
          >
            Open to-do list
          </button>
        </section>
      );
    }

    if (widget.type === "todayPlan") {
      return (
        <section
          className={`home-widget home-widget--setup home-widget--size-${
            widget.size
          }${getWidgetDragClass(widget.id)}`}
          key={widget.id}
          {...getWidgetDragProps(widget.id)}
        >
          {renderWidgetControls(widget)}
          <div className="home-widget-header">
            <h3>Study plan</h3>
          </div>

          <p className="home-plan-helper">
            Pick a time window and let Student Hub build a plan from your tasks.
          </p>

          <div className="home-plan-actions">
            <button className="primary-button" onClick={openEveningPlanner}>
              {hasPlan ? "Regenerate plan" : "Create plan"}
            </button>
          </div>
        </section>
      );
    }

    if (widget.type === "schoolCalendar") {
      return (
        <HomeCalendarWidget
          key={widget.id}
          tasks={tasks}
          subjects={subjects}
          size={widget.size}
          setActivePage={setActivePage}
          editMode={homeEditMode}
          widget={widget}
          onUpdateWidget={updateWidget}
          dragClassName={getWidgetDragClass(widget.id)}
          dragProps={getWidgetDragProps(widget.id)}
          onDragStart={handleWidgetDragStart}
          onDragEnd={resetDragState}
          onDragHandleKeyDown={handleDragHandleKeyDown}
        />
      );
    }

    if (widget.type === "progress" && widget.size === "expanded") {
      return (
        <section
          className={`home-widget home-widget--overview home-widget--size-expanded${getWidgetDragClass(
            widget.id
          )}`}
          key={widget.id}
          {...getWidgetDragProps(widget.id)}
        >
          {renderWidgetControls(widget, true)}
          <div className="home-widget-header">
            <h3>Overview</h3>
            <span>{progressPercentage}% complete</span>
          </div>

          <div className="progress-track overview-progress-track">
            <div
              className="progress-fill"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          <div className="home-widget-stats">
            <HomeStatCard label="Active" value={activeTasks.length} />
            <HomeStatCard label="Completed" value={completedTasks.length} />
            <HomeStatCard label="No deadline" value={noDeadlineTasks.length} />
            <HomeStatCard
              label="Backlog"
              value={Math.max(hiddenBacklogCount, 0)}
            />
          </div>
        </section>
      );
    }

    if (widget.type === "progress") {
      return (
        <section
          className={`home-widget home-widget--summary home-widget--size-compact${getWidgetDragClass(
            widget.id
          )}`}
          key={widget.id}
          {...getWidgetDragProps(widget.id)}
        >
          {renderWidgetControls(widget, true)}
          <div className="home-widget-header progress-header">
            <h3>Progress</h3>
            <span>{progressPercentage}%</span>
          </div>

          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          <div className="home-task-summary">
            <span>
              <strong>{activeTasks.length}</strong> active
            </span>
            <span>
              <strong>{completedTasks.length}</strong> completed
            </span>
          </div>
        </section>
      );
    }

    return null;
  }

  return (
    <div
      className={`page home-layout-${homeLayout} ${
        homeEditMode ? "home-edit-mode" : ""
      }`}
    >
      <header className="page-header">
        <p className="eyebrow">Home</p>
        <h2>Your school day</h2>
        <p>See what matters and plan when you’re ready.</p>
      </header>

      {homeEditMode && (
        <section className="home-edit-bar" aria-label="Home edit mode">
          <div>
            <strong>Editing Home Page</strong>
            <p>Drag to reorder, then hide or resize your blocks.</p>
          </div>
          <div className="home-edit-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={hiddenHomeWidgets.length === 0}
              onClick={() => setShowAddWidget((currentValue) => !currentValue)}
            >
              Add widget
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={finishEditing}
            >
              Done
            </button>
          </div>
        </section>
      )}

      {homeEditMode && showAddWidget && hiddenHomeWidgets.length > 0 && (
        <section className="home-add-widget-panel" aria-label="Add Home widget">
          <div className="home-add-widget-heading">
            <div>
              <strong>Add a widget</strong>
              <p>Restore a hidden block to its saved position.</p>
            </div>
            <button
              type="button"
              aria-label="Close add widget panel"
              onClick={() => setShowAddWidget(false)}
            >
              ×
            </button>
          </div>
          <div className="home-add-widget-list">
            {hiddenHomeWidgets.map((widget) => (
              <button
                type="button"
                key={widget.id}
                onClick={() => updateWidget(widget.id, { visible: true })}
              >
                <span>
                  <strong>{widget.label}</strong>
                  <small>
                    {widget.size === "expanded" ? "Expanded" : "Compact"}
                  </small>
                </span>
                <span aria-hidden="true">+</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section
        className={`home-dashboard home-dashboard--${homeLayout}`}
        aria-label="Home dashboard"
      >
        <div
          className={`home-widget-grid home-widget-grid--count-${Math.min(
            homeWidgets.length,
            4
          )}`}
        >
          {homeWidgets.length > 0 ? (
            homeWidgets.map(renderHomeWidget)
          ) : (
            <section className="home-widget home-widget--empty">
              <div className="empty-plan">
                <h3>No Home widgets selected.</h3>
                <p>
                  {homeEditMode
                    ? "Add a widget to bring blocks back."
                    : "Edit Home to bring widgets back."}
                </p>
              </div>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}

function HomeCalendarWidget({
  tasks,
  subjects,
  size,
  setActivePage,
  editMode,
  widget,
  onUpdateWidget,
  dragClassName,
  dragProps,
  onDragStart,
  onDragEnd,
  onDragHandleKeyDown,
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = formatDateKey(today);
  const upcomingEvents = getTaskCalendarEvents(tasks, subjects)
    .filter((event) => !event.completed && event.date >= todayKey)
    .sort(
      (first, second) =>
        first.date.localeCompare(second.date) ||
        first.title.localeCompare(second.title)
    );
  const previewDays = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    const dateKey = formatDateKey(date);

    return {
      date,
      dateKey,
      count: upcomingEvents.filter((event) => event.date === dateKey).length,
    };
  });
  const openCalendar = () => setActivePage("calendar");

  return (
    <section
      className={`home-widget home-widget--calendar home-widget--size-${size}${dragClassName}`}
      {...dragProps}
    >
      {editMode && (
        <HomeWidgetControls
          widget={widget}
          supportsSize
          onUpdate={onUpdateWidget}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragHandleKeyDown={onDragHandleKeyDown}
        />
      )}
      <div className="home-widget-header">
        <h3>School calendar</h3>
        <button className="home-calendar-action" onClick={openCalendar}>
          View calendar
        </button>
      </div>

      {upcomingEvents.length === 0 ? (
        <button className="home-calendar-empty" onClick={openCalendar}>
          No upcoming due dates.
        </button>
      ) : size === "compact" ? (
        <button
          className={`home-calendar-next ${
            upcomingEvents[0].subjectColour ? "has-subject-colour" : ""
          }`}
          data-source={upcomingEvents[0].source}
          style={
            upcomingEvents[0].subjectColour
              ? { "--subject-color": upcomingEvents[0].subjectColour }
              : undefined
          }
          onClick={openCalendar}
        >
          <span className="home-calendar-date">
            {parseDateKey(upcomingEvents[0].date).toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </span>
          <span className="home-calendar-task-copy">
            <strong>{upcomingEvents[0].title}</strong>
            <small>{upcomingEvents[0].subject}</small>
          </span>
          <span
            className={`urgency ${getUrgencyClass(
              getDaysLeft(upcomingEvents[0].date)
            )}`}
          >
            {getUrgencyLabel(getDaysLeft(upcomingEvents[0].date))}
          </span>
        </button>
      ) : (
        <>
          <div className="home-calendar-days" aria-label="Next two weeks">
            {previewDays.map(({ date, dateKey, count }) => (
              <button
                key={dateKey}
                className={count > 0 ? "has-deadline" : ""}
                aria-label={`${date.toLocaleDateString()}${
                  count ? `, ${count} deadline${count === 1 ? "" : "s"}` : ""
                }`}
                onClick={openCalendar}
              >
                <span>
                  {date.toLocaleDateString(undefined, { weekday: "narrow" })}
                </span>
                <strong>{date.getDate()}</strong>
                <i aria-hidden="true" />
              </button>
            ))}
          </div>

          <div className="home-calendar-deadlines">
            {upcomingEvents.slice(0, 2).map((event) => {
              const daysLeft = getDaysLeft(event.date);

              return (
                <button
                  key={event.id}
                  className={event.subjectColour ? "has-subject-colour" : ""}
                  data-source={event.source}
                  style={
                    event.subjectColour
                      ? { "--subject-color": event.subjectColour }
                      : undefined
                  }
                  onClick={openCalendar}
                >
                  <span className="home-calendar-task-copy">
                    <strong>{event.title}</strong>
                    <small>{event.subject}</small>
                  </span>
                  <span className={`urgency ${getUrgencyClass(daysLeft)}`}>
                    {getUrgencyLabel(daysLeft)}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function HomeWidgetControls({
  widget,
  supportsSize,
  onUpdate,
  onDragStart,
  onDragEnd,
  onDragHandleKeyDown,
}) {
  return (
    <div className="home-widget-edit-controls">
      <button
        type="button"
        className="home-widget-drag-handle"
        draggable
        aria-label={`Move ${widget.label}. Use drag or arrow keys.`}
        title="Drag to reorder"
        onDragStart={(event) => onDragStart(event, widget.id)}
        onDragEnd={onDragEnd}
        onKeyDown={(event) => onDragHandleKeyDown(event, widget.id)}
      >
        <span aria-hidden="true">⠿</span>
      </button>
      {supportsSize && (
        <div
          className="home-widget-size-toggle"
          role="group"
          aria-label={`${widget.label} size`}
        >
          {["compact", "expanded"].map((size) => (
            <button
              type="button"
              key={size}
              className={widget.size === size ? "active" : ""}
              aria-pressed={widget.size === size}
              onClick={() => onUpdate(widget.id, { size })}
            >
              {size === "compact" ? "Compact" : "Expanded"}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        className="home-widget-hide-button"
        onClick={() => onUpdate(widget.id, { visible: false })}
      >
        Hide
      </button>
    </div>
  );
}

function HomeStatCard({ label, value }) {
  return (
    <div className="home-stat">
      <p>{label}</p>
      <h3>{value}</h3>
    </div>
  );
}

export default HomePage;
