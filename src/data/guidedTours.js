import { getClassroomSetupStartPhase } from "../utils/classroomSetupTourUtils.js";

export const demoGuidedTour = {
  id: "demo",
  version: 1,
  persistOutcome: false,
  steps: [
    {
      id: "home-overview",
      page: "home",
      target: '[data-tour="home-overview"]',
      title: "Your next task",
      description: "See what needs your attention first and open your full to-do list.",
      placement: "right",
      mobilePlacement: "bottom",
      spotlightPadding: 8,
      allowTargetInteraction: false,
    },
    {
      id: "todo-add-task",
      page: "tasks",
      target: '[data-tour="todo-add-task"]',
      title: "Keep work in one place",
      description: "Add school work here, then organise it by priority, date, effort, or subject.",
      placement: "bottom",
      mobilePlacement: "bottom",
      spotlightPadding: 7,
      allowTargetInteraction: false,
    },
  ],
};

export const gettingStartedGuidedTour = {
  id: "getting-started",
  version: 1,
  steps: [
    {
      id: "home-overview",
      page: "home",
      target: '[data-tour="home-overview"]',
      title: "Your day at a glance",
      description: "See what needs attention next, this week’s progress and your current study plan.",
      placement: "right",
      mobilePlacement: "bottom",
    },
    {
      id: "todo-add-task",
      page: "tasks",
      target: '[data-tour="todo-add-task"]',
      title: "Keep all your work together",
      description: "Add work yourself or import assignments from Google Classroom, then organise it by priority, effort or Subject.",
      placement: "bottom",
      mobilePlacement: "bottom",
    },
    {
      id: "subjects-overview",
      page: "subjects",
      target: '[data-tour="subjects-overview"]',
      fallbackTarget: '[data-tour="subject-empty-add"]',
      title: "Set where you are and where you want to be",
      description: "Current and target grades help you track each Subject. Smart Planner can use the gap as one signal, while deadlines and urgent work still come first.",
      placement: "bottom",
      mobilePlacement: "bottom",
    },
    {
      id: "calendar-overview",
      page: "calendar",
      target: '[data-tour="calendar-overview"]',
      title: "Plan around real commitments",
      description: "Assignment deadlines stay visible alongside Google Calendar events. Calendars marked as busy time are avoided when Smart Planner builds your plan.",
      placement: "right",
      mobilePlacement: "bottom",
    },
    {
      id: "smart-planner-open",
      page: "plan",
      target: '[data-tour="smart-planner-open"]',
      title: "Build a realistic plan for today",
      description: "Smart Planner uses your tasks, available time, Calendar, Subject goals and optional context to suggest what to work on today.",
      placement: "bottom",
      mobilePlacement: "bottom",
    },
    {
      id: "settings-shortcut",
      page: "plan",
      target: '[data-tour="settings-shortcut"]',
      mobileTarget: '[data-tour="mobile-settings-shortcut"]',
      title: "Personalise DayLo",
      description: "Open Settings to change appearance, integrations and other preferences.",
      placement: "right",
      mobilePlacement: "bottom",
    },
    {
      id: "smart-planner-status",
      page: "settings",
      settingsView: "integrations",
      target: '[data-tour="smart-planner-status"]',
      fallbackTarget: '[data-tour="integrations-overview"]',
      title: "Manage your connections",
      description: "Check Classroom, Calendar and Smart Planner here. Basic Planner remains available even when AI is unavailable or its daily limit is reached.",
      placement: "left",
      mobilePlacement: "bottom",
    },
  ],
};

export const todoGuidedTour = {
  id: "todo",
  version: 1,
  steps: [
    {
      id: "todo-add-task",
      page: "tasks",
      target: '[data-tour="todo-add-task"]',
      title: "Add school work",
      description:
        "Add a task yourself or import selected assignments from Google Classroom.",
      placement: "bottom",
      mobilePlacement: "bottom",
    },
    {
      id: "todo-due-navigation",
      page: "tasks",
      target: '[data-tour="todo-due-navigation"]',
      fallbackTarget: '[data-tour="todo-overview"]',
      title: "Keep dates visible",
      description:
        "See overdue work at a glance, then use Due date to move between upcoming dates.",
      placement: "bottom",
      mobilePlacement: "bottom",
    },
    {
      id: "todo-organise",
      page: "tasks",
      target: '[data-tour="todo-organise"]',
      fallbackTarget: '[data-tour="todo-overview"]',
      title: "Organise active work",
      description:
        "Use Priority, Due date, Effort, or Subject to change how active work is grouped and scanned.",
      placement: "bottom",
      mobilePlacement: "bottom",
    },
    {
      id: "todo-task-actions",
      page: "tasks",
      target: '[data-tour="todo-task-actions"]',
      fallbackTarget: '[data-tour="todo-add-task"]',
      title: "Update each task",
      description:
        "Task controls let you edit, complete, or delete work. If the list is empty, add a task when you are ready.",
      placement: "right",
      mobilePlacement: "bottom",
    },
  ],
};

export const subjectsGuidedTour = {
  id: "subjects",
  version: 1,
  steps: [
    {
      id: "subjects-overview",
      page: "subjects",
      target: '[data-tour="subjects-overview"]',
      fallbackTarget: '[data-tour="subject-empty-add"]',
      title: "Your subject overview",
      description: "Choose a subject to focus the tasks and history shown below.",
      placement: "bottom",
      mobilePlacement: "bottom",
    },
    {
      id: "subject-current-grade",
      page: "subjects",
      target: '[data-tour="subject-current-grade"]',
      fallbackTarget: '[data-tour="subject-empty-add"]',
      title: "Current grade",
      description: "This represents where you are now and should be kept current.",
      placement: "bottom",
      mobilePlacement: "bottom",
    },
    {
      id: "subject-target-grade",
      page: "subjects",
      target: '[data-tour="subject-target-grade"]',
      fallbackTarget: '[data-tour="subject-empty-add"]',
      title: "Target grade",
      description: "This is your goal. The gap is only a secondary planning signal, and reaching it still requires work.",
      placement: "bottom",
      mobilePlacement: "bottom",
    },
    {
      id: "subject-add",
      page: "subjects",
      target: '[data-tour="subject-add"]',
      title: "Manage subject profiles",
      description: "Open Settings to add subjects or update grades and colours.",
      placement: "bottom",
      mobilePlacement: "bottom",
    },
  ],
};

export const calendarGuidedTour = {
  id: "calendar",
  version: 1,
  steps: [
    {
      id: "calendar-overview",
      page: "calendar",
      target: '[data-tour="calendar-overview"]',
      title: "Your school month",
      description: "Move between months and select a day to see its details.",
      placement: "right",
      mobilePlacement: "bottom",
    },
    {
      id: "calendar-task-deadlines",
      page: "calendar",
      target: '[data-tour="calendar-task-deadlines"]',
      fallbackTarget: '[data-tour="calendar-overview"]',
      title: "Task deadlines",
      description: "DayLo tasks use due dates here. They remain tasks, not Calendar events.",
      placement: "left",
      mobilePlacement: "bottom",
    },
    {
      id: "calendar-google-events",
      page: "calendar",
      target: '[data-tour="calendar-google-events"]',
      fallbackTarget: '[data-tour="calendar-overview"]',
      title: "Calendar events",
      description: "Selected Google Calendar events appear beside deadlines without becoming DayLo tasks.",
      placement: "left",
      mobilePlacement: "top",
    },
    {
      id: "calendar-busy-time",
      page: "calendar",
      target: '[data-tour="calendar-busy-time"]',
      fallbackTarget: '[data-tour="calendar-overview"]',
      title: "Protect busy time",
      description: "Calendars marked Block study time help plans avoid existing events.",
      placement: "left",
      mobilePlacement: "top",
    },
  ],
};

export const smartPlannerGuidedTour = {
  id: "smart-planner",
  version: 1,
  steps: [
    {
      id: "smart-planner-time",
      page: "plan",
      target: '[data-tour="smart-planner-time"]',
      title: "Choose your study window",
      description: "Start defaults to the next half-hour, but both times remain editable.",
      placement: "right",
      mobilePlacement: "bottom",
      action: "open-smart-planner",
    },
    {
      id: "smart-planner-style",
      page: "plan",
      target: '[data-tour="smart-planner-style"]',
      title: "Set the planning style",
      description: "Choose the pace and whether Calendar events should block study time.",
      placement: "right",
      mobilePlacement: "bottom",
    },
    {
      id: "smart-planner-context",
      page: "plan",
      target: '[data-tour="smart-planner-context"]',
      title: "Add useful context",
      description: "Add temporary progress or priorities that are not already on your tasks.",
      placement: "right",
      mobilePlacement: "top",
    },
    {
      id: "smart-planner-actions",
      page: "plan",
      target: '[data-tour="smart-planner-actions"]',
      title: "Create your plan",
      description: "AI creates a preview and changes nothing until you accept it. Basic Planner is always available.",
      placement: "top",
      mobilePlacement: "top",
    },
    {
      id: "smart-planner-status",
      page: "plan",
      target: '[data-tour="smart-planner-status"]',
      title: "Know what is available",
      description: "Each successful AI plan uses one daily allowance. This status shows what remains and when it resets.",
      placement: "top",
      mobilePlacement: "top",
    },
  ],
};

export const todaysPlanGuidedTour = {
  id: "todays-plan",
  version: 1,
  steps: [
    {
      id: "todays-plan-smart-planner",
      page: "plan",
      target: '[data-tour="smart-planner-open"]',
      title: "Create a plan",
      description:
        "Smart Planner can propose a realistic plan for today without changing anything until you accept it.",
      placement: "bottom",
      mobilePlacement: "bottom",
    },
    {
      id: "todays-plan-timeline",
      page: "plan",
      target: '[data-tour="todays-plan-timeline"]',
      fallbackTarget: '[data-tour="todays-plan-overview"]',
      title: "Follow the study timeline",
      description:
        "Accepted plans appear here as ordered study and break blocks. An empty plan stays ready for you to build.",
      placement: "right",
      mobilePlacement: "bottom",
    },
    {
      id: "todays-plan-adjust",
      page: "plan",
      target: '[data-tour="todays-plan-adjust"]',
      fallbackTarget: '[data-tour="todays-plan-overview"]',
      title: "Adjust the plan",
      description:
        "Add a block or use block options to edit the schedule when your day changes.",
      placement: "bottom",
      mobilePlacement: "bottom",
    },
    {
      id: "todays-plan-complete",
      page: "plan",
      target: '[data-tour="todays-plan-complete"]',
      fallbackTarget: '[data-tour="todays-plan-overview"]',
      title: "Complete planned work",
      description:
        "Mark a study block done as you finish it. If there is no active block yet, the plan overview remains available.",
      placement: "left",
      mobilePlacement: "top",
    },
  ],
};

const classroomSetupSteps = {
  connect: {
    id: "classroom-setup-connect",
    phase: "connect",
    page: "settings",
    settingsView: "integrations",
    target: '[data-tour="classroom-setup-connect"]',
    fallbackTarget: '[data-tour="classroom-setup-card"]',
    title: "Connect Google Classroom",
    description:
      "Choose your Google account to connect Classroom. You’ll return to DayLo when it’s ready.",
    placement: "left",
    mobilePlacement: "bottom",
    allowTargetInteraction: true,
  },
  return: {
    id: "classroom-setup-return",
    phase: "connect",
    page: "settings",
    settingsView: "integrations",
    target: '[data-tour="classroom-setup-card"]',
    fallbackTarget: '[data-tour="integrations-overview"]',
    title: "Return to DayLo",
    description:
      "After you choose an account, DayLo returns here and continues with your classes. You can retry or stop at any time.",
    placement: "left",
    mobilePlacement: "bottom",
  },
  loadClasses: {
    id: "classroom-setup-load-classes",
    phase: "load-classes",
    page: "settings",
    settingsView: "integrations",
    target: '[data-tour="classroom-setup-load"]',
    fallbackTarget: '[data-tour="classroom-setup-card"]',
    title: "Load your classes",
    description: "Read your active Classroom classes so you can choose which ones DayLo should use.",
    placement: "left",
    mobilePlacement: "bottom",
    allowTargetInteraction: true,
  },
  openManager: {
    id: "classroom-setup-open-manager",
    phase: "choose-classes",
    page: "settings",
    settingsView: "integrations",
    target: '[data-tour="classroom-setup-manage"]',
    fallbackTarget: '[data-tour="classroom-setup-card"]',
    title: "Manage Classroom",
    description: "Open your class list to choose classes, link Subjects and review assignments.",
    placement: "left",
    mobilePlacement: "bottom",
    allowTargetInteraction: true,
  },
  chooseClasses: {
    id: "classroom-setup-choose-classes",
    phase: "choose-classes",
    page: "settings",
    settingsView: "integrations",
    target: '[data-tour="classroom-setup-class-choices"]',
    fallbackTarget: '[data-tour="classroom-setup-manager"]',
    title: "Choose your classes",
    description: "Include classes you want to use in DayLo and ignore the rest.",
    placement: "right",
    mobilePlacement: "bottom",
    allowTargetInteraction: true,
  },
  linkSubjects: {
    id: "classroom-setup-link-subjects",
    phase: "link-subjects",
    page: "settings",
    settingsView: "integrations",
    target: '[data-tour="classroom-setup-subject-links"]',
    fallbackTarget: '[data-tour="classroom-setup-class-choices"]',
    title: "Link DayLo Subjects",
    description: "Link each included class to a Subject, or create one with the suggested name.",
    placement: "right",
    mobilePlacement: "bottom",
    allowTargetInteraction: true,
  },
  previewAssignments: {
    id: "classroom-setup-preview-assignments",
    phase: "preview-assignments",
    page: "settings",
    settingsView: "integrations",
    target: '[data-tour="classroom-setup-preview"]',
    fallbackTarget: '[data-tour="classroom-setup-manager"]',
    title: "Preview assignments",
    description: "Load assignments for included classes and review them before anything becomes a task.",
    placement: "left",
    mobilePlacement: "bottom",
    allowTargetInteraction: true,
  },
  importAssignments: {
    id: "classroom-setup-import-assignments",
    phase: "import-assignments",
    page: "settings",
    settingsView: "integrations",
    target: '[data-tour="classroom-setup-import"]',
    fallbackTarget: '[data-tour="classroom-setup-manager"]',
    title: "Import selected work",
    description: "Only selected assignments become DayLo tasks. Existing imports stay duplicate-free.",
    placement: "left",
    mobilePlacement: "top",
    allowTargetInteraction: true,
  },
  manage: {
    id: "classroom-setup-manage-later",
    phase: "manage",
    page: "settings",
    settingsView: "integrations",
    target: '[data-tour="classroom-setup-manager"]',
    fallbackTarget: '[data-tour="classroom-setup-card"]',
    title: "Manage Classroom here",
    description: "Return here whenever you want to change classes, preview new work or sync selected assignments.",
    placement: "left",
    mobilePlacement: "bottom",
  },
};

function getClassroomSetupSteps(context = {}, resumePhase = "") {
  const managerOpen = context.managerOpen === true;
  const phase = getClassroomSetupStartPhase(context, resumePhase);

  if (phase === "connect") {
    return [
      classroomSetupSteps.connect,
      classroomSetupSteps.return,
      classroomSetupSteps.loadClasses,
      classroomSetupSteps.openManager,
      classroomSetupSteps.chooseClasses,
      classroomSetupSteps.linkSubjects,
      classroomSetupSteps.previewAssignments,
      classroomSetupSteps.importAssignments,
      classroomSetupSteps.manage,
    ];
  }

  if (phase === "load-classes") {
    return [
      classroomSetupSteps.loadClasses,
      classroomSetupSteps.openManager,
      classroomSetupSteps.chooseClasses,
      classroomSetupSteps.linkSubjects,
      classroomSetupSteps.previewAssignments,
      classroomSetupSteps.importAssignments,
      classroomSetupSteps.manage,
    ];
  }

  const managerSteps = [];
  if (!managerOpen) managerSteps.push(classroomSetupSteps.openManager);
  if (phase === "choose-classes") managerSteps.push(classroomSetupSteps.chooseClasses);
  if (["choose-classes", "link-subjects"].includes(phase)) {
    managerSteps.push(classroomSetupSteps.linkSubjects);
  }
  if (["choose-classes", "link-subjects", "preview-assignments"].includes(phase)) {
    managerSteps.push(classroomSetupSteps.previewAssignments);
  }
  if (phase !== "manage") managerSteps.push(classroomSetupSteps.importAssignments);
  managerSteps.push(classroomSetupSteps.manage);
  return managerSteps;
}

export function createClassroomSetupGuidedTour(context = {}, resumePhase = "") {
  return {
    id: "google-classroom-setup",
    version: 1,
    steps: getClassroomSetupSteps(context, resumePhase),
  };
}

export const classroomSetupGuidedTour = createClassroomSetupGuidedTour();

const guidedTours = {
  [demoGuidedTour.id]: demoGuidedTour,
  [gettingStartedGuidedTour.id]: gettingStartedGuidedTour,
  [todoGuidedTour.id]: todoGuidedTour,
  [subjectsGuidedTour.id]: subjectsGuidedTour,
  [calendarGuidedTour.id]: calendarGuidedTour,
  [smartPlannerGuidedTour.id]: smartPlannerGuidedTour,
  [todaysPlanGuidedTour.id]: todaysPlanGuidedTour,
  [classroomSetupGuidedTour.id]: classroomSetupGuidedTour,
};

export function getGuidedTourDefinition(tourId, context, resumePhase) {
  if (tourId === classroomSetupGuidedTour.id) {
    return createClassroomSetupGuidedTour(context, resumePhase);
  }
  return guidedTours[tourId] || null;
}
