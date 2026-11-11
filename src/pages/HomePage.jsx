import { useEffect, useMemo, useState } from "react";
import RevealOnScroll from "../components/RevealOnScroll.jsx";
import { DEFAULT_PLANNING_PREFERENCES } from "../lib/cloudPlanning.js";
import {
  getHomeAssessmentIndicator,
  formatHomeDate,
  getHomeGreeting,
  getHomeRecommendationItems,
  getHomeSubjectColour,
  getHomeUpcomingTasks,
  sortHomeCalendarEvents,
} from "../utils/homeDashboardUtils.js";
import {
  loadGoogleCalendarAccountMeta,
  loadGoogleCalendarPreferencesFromStorage,
} from "../utils/googleCalendarStorage.js";
import { getIntegrationAuthHeaders } from "../utils/integrationAuthUtils.js";
import { buildStudyRecommendations } from "../utils/studyRecommendations.js";

const HOME_INTRO_SESSION_KEY = "studentHubHomeIntroPlayed";
const HOME_CALENDAR_VISIBLE_LIMIT = 3;

function HomePage({
  authAccessToken = "",
  tasks = [],
  subjects = [],
  planningPreferences,
  loading = false,
  setActivePage,
  openTaskDetails,
  openAddTask,
  openIntegrations,
}) {
  const [playHomeIntro] = useState(shouldPlayHomeIntro);
  const [showAdditionalRecommendations, setShowAdditionalRecommendations] =
    useState(false);
  const now = new Date();
  const preferences = planningPreferences || DEFAULT_PLANNING_PREFERENCES;
  const recommendations = useMemo(
    () => buildStudyRecommendations({ tasks, subjects, preferences }),
    [preferences, subjects, tasks]
  );
  const todayRecommendations = getHomeRecommendationItems(recommendations.today);
  const upcomingTasks = useMemo(
    () => getHomeUpcomingTasks(tasks, subjects, now),
    [subjects, tasks]
  );
  const calendar = useTodayCalendarEvents({ authAccessToken });
  const visibleCalendarEvents = calendar.events.slice(
    0,
    HOME_CALENDAR_VISIBLE_LIMIT
  );
  const hiddenCalendarEventCount = Math.max(
    0,
    calendar.events.length - visibleCalendarEvents.length
  );
  const glowSurfaceProps = {
    onPointerEnter: handleHomeGlowPointerEnter,
    onPointerMove: handleHomeGlowPointerMove,
    onPointerLeave: handleHomeGlowPointerLeave,
  };

  function openRecommendation(recommendation) {
    if (recommendation?.taskId && typeof openTaskDetails === "function") {
      openTaskDetails(recommendation.taskId);
      return;
    }
    setActivePage("plan");
  }

  return (
    <div
      className={`page home-overview-dashboard ${
        playHomeIntro ? "home-intro-active" : ""
      }`}
    >
      <header className="home-overview-header">
        <h2>{getHomeGreeting(now)} <span aria-hidden="true">👋</span></h2>
        <p>{formatHomeDate(now)}</p>
      </header>

      <div className="home-overview-top">
        <section
          className="home-overview-card home-plan-summary home-glow-surface"
          aria-labelledby="home-plan-heading"
          {...glowSurfaceProps}
        >
          <HomeSectionHeader
            icon="◎"
            title="Today's Plan"
            titleId="home-plan-heading"
            action={`${recommendations.dailyBlockCount} ${
              recommendations.dailyBlockCount === 1 ? "block" : "blocks"
            } · ${recommendations.blockDurationMinutes} min each →`}
            actionLabel="Open Plan"
            onAction={() => setActivePage("plan")}
          />

          {loading ? (
            <HomeEmptyState title="Loading recommendations…" />
          ) : todayRecommendations.primary.length > 0 ? (
            <div className="home-plan-recommendations">
              {todayRecommendations.primary.map((recommendation, index) => (
                <HomeRecommendationCard
                  key={recommendation.id}
                  recommendation={recommendation}
                  priority={index + 1}
                  duration={recommendations.blockDurationMinutes}
                  subjectColour={getHomeSubjectColour(
                    recommendation,
                    subjects
                  )}
                  onOpen={() => openRecommendation(recommendation)}
                />
              ))}

              {todayRecommendations.additional.length > 0 && (
                <div className="home-plan-additional">
                  <button
                    type="button"
                    className="home-plan-more"
                    aria-expanded={showAdditionalRecommendations}
                    aria-controls="home-additional-recommendations"
                    onClick={() =>
                      setShowAdditionalRecommendations((current) => !current)
                    }
                  >
                    {showAdditionalRecommendations
                      ? "Show less"
                      : `+${todayRecommendations.additional.length} more`}
                    <span aria-hidden="true">
                      {showAdditionalRecommendations ? "↑" : "↓"}
                    </span>
                  </button>
                  {showAdditionalRecommendations && (
                    <div
                      className="home-plan-recommendations is-additional"
                      id="home-additional-recommendations"
                    >
                      {todayRecommendations.additional.map((recommendation) => (
                        <HomeRecommendationCard
                          key={recommendation.id}
                          recommendation={recommendation}
                          duration={recommendations.blockDurationMinutes}
                          subjectColour={getHomeSubjectColour(
                            recommendation,
                            subjects
                          )}
                          onOpen={() => openRecommendation(recommendation)}
                          additional
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <HomeEmptyState
              title="Nothing recommended today."
              message="Your normal routine and urgent work will appear here."
              action="Open Plan"
              onAction={() => setActivePage("plan")}
            />
          )}
        </section>

        <section
          className="home-overview-card home-calendar-summary home-glow-surface"
          aria-labelledby="home-calendar-heading"
          {...glowSurfaceProps}
        >
          <HomeSectionHeader
            icon="▣"
            title="Today's Calendar"
            titleId="home-calendar-heading"
            action="Open calendar →"
            onAction={() => setActivePage("calendar")}
          />

          {calendar.status === "loading" ? (
            <HomeEmptyState title="Loading today's events…" />
          ) : calendar.status === "disconnected" ? (
            <HomeEmptyState
              title="Connect Google Calendar"
              message="See real events alongside your DayLo deadlines."
              action="Open Integrations"
              onAction={openIntegrations}
            />
          ) : calendar.status === "no-calendars" ? (
            <HomeEmptyState
              title="Choose calendars to show"
              message="Select the calendars you want DayLo to display."
              action="Open Integrations"
              onAction={openIntegrations}
            />
          ) : calendar.status === "error" ? (
            <HomeEmptyState
              title="Calendar unavailable"
              message="Your events could not be loaded right now."
              action="Open calendar"
              onAction={() => setActivePage("calendar")}
            />
          ) : visibleCalendarEvents.length > 0 ? (
            <div className="home-calendar-events">
              {visibleCalendarEvents.map((event) => (
                <button
                  type="button"
                  className={`home-calendar-event${
                    event.allDay ? " is-all-day" : ""
                  }`}
                  key={`${event.calendarId}-${event.id}`}
                  style={{
                    "--home-event-colour":
                      event.backgroundColor ||
                      event.calendarColor ||
                      "var(--accent)",
                  }}
                  onClick={() => setActivePage("calendar")}
                >
                  <span className="home-calendar-event-time">
                    {event.allDay ? "All day" : formatEventStart(event.start)}
                  </span>
                  <i aria-hidden="true" />
                  <strong>{event.title}</strong>
                </button>
              ))}
              {hiddenCalendarEventCount > 0 && (
                <button
                  type="button"
                  className="home-calendar-more"
                  onClick={() => setActivePage("calendar")}
                >
                  +{hiddenCalendarEventCount} more event
                  {hiddenCalendarEventCount === 1 ? "" : "s"}
                </button>
              )}
            </div>
          ) : (
            <HomeEmptyState title="Nothing on your calendar today." />
          )}
        </section>
      </div>

      <RevealOnScroll
        as="section"
        className="home-overview-card home-coming-up-summary home-glow-surface"
        aria-labelledby="home-coming-up-heading"
        initiallyVisible={playHomeIntro}
        {...glowSurfaceProps}
      >
        <HomeSectionHeader
          icon="▣"
          title="Coming Up"
          titleId="home-coming-up-heading"
          action="Open to-do list →"
          onAction={() => setActivePage("tasks")}
        />
        {upcomingTasks.length > 0 ? (
          <div className="home-coming-up-list">
            {upcomingTasks.map((task) => (
              <HomeUpcomingTask
                key={task.id}
                task={task}
                onOpen={() => openTaskDetails(task.id)}
              />
            ))}
          </div>
        ) : (
          <HomeEmptyState title="Nothing due soon." />
        )}
      </RevealOnScroll>

      <RevealOnScroll
        as="section"
        className="home-overview-card home-quick-access home-glow-surface"
        aria-labelledby="home-quick-access-heading"
        index={1}
        initiallyVisible={playHomeIntro}
        {...glowSurfaceProps}
      >
        <HomeSectionHeader
          icon="ϟ"
          title="Quick Access"
          titleId="home-quick-access-heading"
        />
        <div className="home-quick-access-grid">
          <button type="button" onClick={openAddTask}>
            <span aria-hidden="true">✓</span> Add task <b aria-hidden="true">›</b>
          </button>
          <button type="button" onClick={() => setActivePage("calendar")}>
            <span aria-hidden="true">▣</span> Open calendar <b aria-hidden="true">›</b>
          </button>
          <a
            href="https://classroom.google.com/"
            target="_blank"
            rel="noreferrer"
          >
            <span aria-hidden="true">◇</span> Open Classroom <b aria-hidden="true">›</b>
          </a>
          <button type="button" onClick={() => setActivePage("myLists")}>
            <span aria-hidden="true">☷</span> My Lists <b aria-hidden="true">›</b>
          </button>
        </div>
      </RevealOnScroll>
    </div>
  );
}

function HomeSectionHeader({ icon, title, titleId, action, actionLabel, onAction }) {
  return (
    <header className="home-overview-card-header">
      <div>
        <span aria-hidden="true">{icon}</span>
        <h3 id={titleId}>{title}</h3>
      </div>
      {action && (
        <button type="button" aria-label={actionLabel || action} onClick={onAction}>
          {action}
        </button>
      )}
    </header>
  );
}

function HomeRecommendationCard({
  recommendation,
  priority,
  duration,
  subjectColour,
  onOpen,
  additional = false,
}) {
  const indicator = getHomeAssessmentIndicator(recommendation);
  return (
    <article
      className={`home-recommendation${additional ? " is-additional" : ""}`}
      style={{ "--home-subject-colour": subjectColour || "var(--accent)" }}
    >
      {priority && <span className="home-priority-label">Priority {priority}</span>}
      <button type="button" onClick={onOpen}>
        <i aria-hidden="true" />
        <span>
          <small>{recommendation.subject}</small>
          <strong>{recommendation.title}</strong>
          <em>{recommendation.reason} · {duration} min</em>
        </span>
        {indicator && (
          <b title={indicator.label} aria-label={indicator.label}>
            {indicator.short}
          </b>
        )}
      </button>
    </article>
  );
}

function HomeUpcomingTask({ task, onOpen }) {
  const dueDate = new Date(`${task.dueDate}T12:00:00`);
  const indicator = getHomeAssessmentIndicator(task);
  const classification = indicator?.label || "Homework";
  const detail = String(task.description || "").trim();
  return (
    <button
      type="button"
      className="home-coming-up-item"
      style={{ "--home-subject-colour": task.subjectColour || "var(--accent)" }}
      onClick={onOpen}
    >
      <span className="home-coming-up-date">
        <small>{dueDate.toLocaleDateString(undefined, { weekday: "short" })}</small>
        <strong>{dueDate.toLocaleDateString(undefined, { day: "numeric", month: "short" })}</strong>
      </span>
      <i aria-hidden="true" />
      <span className="home-coming-up-copy">
        <strong>{task.title}</strong>
        <small>{classification}{detail ? ` · ${detail}` : ` · ${task.subject || "Unassigned"}`}</small>
      </span>
      {indicator && (
        <b title={indicator.label} aria-label={indicator.label}>
          {indicator.short}
        </b>
      )}
    </button>
  );
}

function HomeEmptyState({ title, message, action, onAction }) {
  return (
    <div className="home-overview-empty">
      <strong>{title}</strong>
      {message && <p>{message}</p>}
      {action && <button type="button" onClick={onAction}>{action}</button>}
    </div>
  );
}

function useTodayCalendarEvents({ authAccessToken }) {
  const [state, setState] = useState({ status: "loading", events: [] });

  useEffect(() => {
    const controller = new AbortController();
    const account = loadGoogleCalendarAccountMeta();
    if (!account?.accountId) {
      setState({ status: "disconnected", events: [] });
      return () => controller.abort();
    }

    const preferences = Object.values(
      loadGoogleCalendarPreferencesFromStorage()
    );
    const selectedCalendarIds = preferences
      .filter(
        (preference) =>
          preference?.calendarId && preference.showInStudentHub === true
      )
      .map((preference) => preference.calendarId)
      .sort((left, right) => left.localeCompare(right));

    if (selectedCalendarIds.length === 0) {
      setState({ status: "no-calendars", events: [] });
      return () => controller.abort();
    }

    const timeMin = new Date();
    timeMin.setHours(0, 0, 0, 0);
    const timeMax = new Date(timeMin);
    timeMax.setDate(timeMax.getDate() + 1);
    setState({ status: "loading", events: [] });

    fetch("/api/google-calendar/events", {
      method: "POST",
      credentials: "include",
      signal: controller.signal,
      headers: getIntegrationAuthHeaders(authAccessToken, {
        Accept: "application/json",
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        accountId: account.accountId,
        selectedCalendarIds,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
      }),
    })
      .then(async (response) => ({
        response,
        result: await response.json().catch(() => null),
      }))
      .then(({ response, result }) => {
        if (!response.ok || result?.ok !== true) {
          const disconnectedStatuses = new Set([
            "no_calendar_session",
            "calendar_session_invalid_or_expired",
            "calendar_session_reconnect_required",
          ]);
          setState({
            status: disconnectedStatuses.has(result?.status)
              ? "disconnected"
              : "error",
            events: [],
          });
          return;
        }
        setState({
          status: "connected",
          events: sortHomeCalendarEvents(result.events || []),
        });
      })
      .catch((error) => {
        if (error?.name === "AbortError") return;
        setState({ status: "error", events: [] });
      });

    return () => controller.abort();
  }, [authAccessToken]);

  return state;
}

function formatEventStart(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function shouldPlayHomeIntro() {
  if (typeof window === "undefined") return false;
  try {
    if (window.sessionStorage.getItem(HOME_INTRO_SESSION_KEY) === "true") {
      return false;
    }
    window.sessionStorage.setItem(HOME_INTRO_SESSION_KEY, "true");
    return true;
  } catch {
    return false;
  }
}

function shouldUseHomePointerGlow() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
    window.matchMedia("(prefers-reduced-motion: no-preference)").matches &&
    window.matchMedia("(min-width: 641px)").matches
  );
}

function handleHomeGlowPointerEnter(event) {
  if (!shouldUseHomePointerGlow()) return;
  event.currentTarget.classList.add("is-pointer-glowing");
}

function handleHomeGlowPointerMove(event) {
  if (!shouldUseHomePointerGlow()) return;
  const bounds = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty(
    "--pointer-x",
    `${event.clientX - bounds.left}px`
  );
  event.currentTarget.style.setProperty(
    "--pointer-y",
    `${event.clientY - bounds.top}px`
  );
}

function handleHomeGlowPointerLeave(event) {
  event.currentTarget.classList.remove("is-pointer-glowing");
}

export default HomePage;
