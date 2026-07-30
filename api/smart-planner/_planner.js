/* global Buffer, process */

const MAX_TASKS = 20;
const MAX_BUSY_INTERVALS = 40;
const MAX_BLOCKS = 18;
const MAX_OMITTED_TASKS = 20;
const MAX_WARNINGS = 6;
const MAX_REQUEST_BYTES = 64 * 1024;

const PLAN_STYLES = new Set(["balanced", "lighter", "maximum"]);
const TEMPORARY_ANTHROPIC_STATUSES = new Set([429, 500, 502, 503, 504, 529]);

export const SMART_PLANNER_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["status", "summary", "blocks", "omittedTasks", "warnings"],
  properties: {
    status: {
      type: "string",
      enum: ["ready", "no_tasks", "no_time"],
    },
    summary: { type: "string", minLength: 1, maxLength: 280 },
    blocks: {
      type: "array",
      maxItems: MAX_BLOCKS,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "type",
          "taskId",
          "title",
          "subject",
          "startMinute",
          "durationMinutes",
          "goal",
          "reason",
        ],
        properties: {
          type: { type: "string", enum: ["study", "break"] },
          taskId: { type: ["string", "null"], maxLength: 120 },
          title: { type: "string", minLength: 1, maxLength: 180 },
          subject: { type: ["string", "null"], maxLength: 80 },
          startMinute: { type: "integer", minimum: 0, maximum: 1439 },
          durationMinutes: { type: "integer", minimum: 5, maximum: 75 },
          goal: { type: "string", minLength: 1, maxLength: 240 },
          reason: { type: "string", minLength: 1, maxLength: 240 },
        },
      },
    },
    omittedTasks: {
      type: "array",
      maxItems: MAX_OMITTED_TASKS,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["taskId", "title", "reason", "suggestedNextStep"],
        properties: {
          taskId: { type: "string", maxLength: 120 },
          title: { type: "string", minLength: 1, maxLength: 180 },
          reason: { type: "string", minLength: 1, maxLength: 240 },
          suggestedNextStep: { type: "string", minLength: 1, maxLength: 240 },
        },
      },
    },
    warnings: {
      type: "array",
      maxItems: MAX_WARNINGS,
      items: { type: "string", maxLength: 240 },
    },
  },
};

export const SMART_PLANNER_SYSTEM_PROMPT = `You are Student Hub's realistic study-planning engine. Return only the requested structured JSON.

Rules:
1. Plan only inside the supplied current local-day window.
2. Never schedule through a supplied busy interval.
3. Use only supplied active tasks and never invent a task ID.
4. Prioritise overdue work, work due today, imminent assessments, high-effort work, and meaningful progress on large projects.
5. Use subject and task variety when it improves a realistic plan.
6. Do not fill every minute unrealistically; honour the selected planning style.
7. Insert short breaks during longer sessions.
8. Split large work into concrete goals without claiming a major project can be finished in one short block.
9. Intentionally omit lower-priority work when it cannot fit and explain each omission honestly.
10. Never move work into tomorrow, exceed the finish time, overlap blocks, or leave schedule collisions unexplained.
11. Study blocks should usually be 15 to 75 minutes. Use 5-minute increments for every time and duration.
12. Break blocks must use a null taskId. Study blocks must reference a supplied task ID.
13. Keep goals, reasons, warnings, and summaries concise.
14. You may recognise tests, quizzes, exams, essays, coursework, IAs, EE, TOK, CAS, oral preparation, revision, drafts, research, and long-term projects, but never invent assignment content.`;

function text(value, maximumLength) {
  return String(value ?? "").trim().slice(0, maximumLength);
}

function isIntegerBetween(value, minimum, maximum) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

function normalizeOrigin(value) {
  if (typeof value !== "string" || value.trim() === "") return "";

  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

export function getAllowedSmartPlannerOrigins() {
  const configured =
    process.env.SMART_PLANNER_ALLOWED_ORIGINS ||
    process.env.GOOGLE_OAUTH_ALLOWED_ORIGINS ||
    "";
  const parts = configured
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const malformedOrigins = parts.filter((part) => !normalizeOrigin(part));
  const origins = parts.map(normalizeOrigin).filter(Boolean);

  if (!isProductionRuntime()) {
    origins.push("http://localhost:5173", "http://127.0.0.1:5173");
  }

  return {
    malformedOrigins,
    origins: new Set(origins),
  };
}

async function readBody(request) {
  if (request.body && typeof request.body === "object") {
    const serialized = JSON.stringify(request.body);
    if (Buffer.byteLength(serialized, "utf8") > MAX_REQUEST_BYTES) {
      throw new Error("request_too_large");
    }
    return request.body;
  }

  if (typeof request.body === "string") {
    if (Buffer.byteLength(request.body, "utf8") > MAX_REQUEST_BYTES) {
      throw new Error("request_too_large");
    }
    return JSON.parse(request.body || "{}");
  }

  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > MAX_REQUEST_BYTES) throw new Error("request_too_large");
    chunks.push(buffer);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function normalizeTask(task) {
  if (!task || typeof task !== "object") return null;

  const id = text(task.id, 120);
  const title = text(task.title, 180);
  if (!id || !title || task.completed === true) return null;

  const effort = Number(task.effort);
  const progress = Number(task.progress);

  return {
    id,
    title,
    subject: text(task.subject, 80),
    dueDate: text(task.dueDate, 40),
    overdue: task.overdue === true,
    taskType: text(task.taskType, 60),
    assessmentType: text(task.assessmentType, 60),
    importance: text(task.importance, 32),
    effort: Number.isFinite(effort) ? Math.min(5, Math.max(1, Math.round(effort))) : 2,
    source: text(task.source, 40),
    classroomSubmissionState: text(task.classroomSubmissionState, 60),
    progress: Number.isFinite(progress) ? Math.min(100, Math.max(0, Math.round(progress))) : null,
    completed: false,
  };
}

function normalizeBusyIntervals(intervals, startMinute, finishMinute) {
  const normalized = intervals
    .map((interval) => {
      const start = Number(interval?.startMinute);
      const end = Number(interval?.endMinute);

      if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start) {
        return null;
      }

      const clippedStart = Math.max(startMinute, start);
      const clippedEnd = Math.min(finishMinute, end);
      return clippedEnd > clippedStart
        ? { startMinute: clippedStart, endMinute: clippedEnd }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.startMinute - b.startMinute);

  return normalized.reduce((merged, interval) => {
    const previous = merged[merged.length - 1];
    if (previous && interval.startMinute <= previous.endMinute) {
      previous.endMinute = Math.max(previous.endMinute, interval.endMinute);
    } else {
      merged.push({ ...interval });
    }
    return merged;
  }, []);
}

export async function validateSmartPlannerRequest(request) {
  if (request.method !== "POST") {
    return { ok: false, statusCode: 405, status: "method_not_allowed", message: "Smart Planner uses POST requests." };
  }

  if (!String(request.headers?.["content-type"] || "").toLowerCase().includes("application/json")) {
    return { ok: false, statusCode: 415, status: "unsupported_media_type", message: "Smart Planner expects JSON." };
  }

  if (request.headers?.["x-student-hub-request"] !== "smart-planner") {
    return { ok: false, statusCode: 403, status: "request_header_required", message: "Smart Planner rejected this request." };
  }

  const allowed = getAllowedSmartPlannerOrigins();
  const origin = normalizeOrigin(String(request.headers?.origin || ""));

  if (allowed.malformedOrigins.length > 0) {
    return { ok: false, statusCode: 500, status: "origin_config_invalid", message: "Smart Planner origin settings need attention." };
  }

  if (!origin || !allowed.origins.has(origin)) {
    return { ok: false, statusCode: 403, status: "origin_not_allowed", message: "Smart Planner rejected this request." };
  }

  let body;
  try {
    body = await readBody(request);
  } catch (error) {
    return {
      ok: false,
      statusCode: error?.message === "request_too_large" ? 413 : 400,
      status: error?.message === "request_too_large" ? "request_too_large" : "invalid_json",
      message: "Smart Planner could not read this planning request.",
    };
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, statusCode: 400, status: "invalid_request", message: "Smart Planner needs valid planning details." };
  }

  const localDate = text(body.localDate, 10);
  const timeZone = text(body.timeZone, 80);
  const utcOffsetMinutes = Number(body.utcOffsetMinutes);
  const currentMinute = Number(body.currentMinute);
  const startMinute = Number(body.startMinute);
  const finishMinute = Number(body.finishMinute);
  const planningStyle = text(body.planningStyle, 20);
  const tasks = Array.isArray(body.tasks) ? body.tasks : [];
  const busyIntervals = Array.isArray(body.busyIntervals) ? body.busyIntervals : [];

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(localDate) ||
    !timeZone ||
    !isIntegerBetween(utcOffsetMinutes, -840, 840) ||
    !isIntegerBetween(currentMinute, 0, 1439) ||
    !isIntegerBetween(startMinute, 0, 1439) ||
    !isIntegerBetween(finishMinute, 1, 1440) ||
    finishMinute <= startMinute ||
    startMinute < currentMinute ||
    !PLAN_STYLES.has(planningStyle) ||
    tasks.length > MAX_TASKS ||
    busyIntervals.length > MAX_BUSY_INTERVALS
  ) {
    return { ok: false, statusCode: 400, status: "invalid_request", message: "Check the planning time and options, then try again." };
  }

  const normalizedTasks = tasks.map(normalizeTask);
  if (normalizedTasks.some((task) => task === null)) {
    return { ok: false, statusCode: 400, status: "invalid_tasks", message: "Smart Planner received an invalid task list." };
  }

  const taskIds = new Set(normalizedTasks.map((task) => task.id));
  if (taskIds.size !== normalizedTasks.length) {
    return { ok: false, statusCode: 400, status: "duplicate_task_ids", message: "Smart Planner received duplicate tasks." };
  }

  return {
    ok: true,
    input: {
      localDate,
      timeZone,
      utcOffsetMinutes,
      currentMinute,
      startMinute,
      finishMinute,
      planningStyle,
      tasks: normalizedTasks,
      busyIntervals: normalizeBusyIntervals(busyIntervals, startMinute, finishMinute),
    },
  };
}

function overlapsBusyInterval(startMinute, endMinute, busyIntervals) {
  return busyIntervals.some(
    (interval) => startMinute < interval.endMinute && endMinute > interval.startMinute
  );
}

export function validateSmartPlannerOutput(rawOutput, input) {
  if (!rawOutput || typeof rawOutput !== "object" || Array.isArray(rawOutput)) {
    return { ok: false, status: "ai_invalid", message: "Smart Planner returned an invalid plan." };
  }

  const status = text(rawOutput.status, 24);
  if (!["ready", "no_tasks", "no_time"].includes(status)) {
    return { ok: false, status: "ai_invalid", message: "Smart Planner returned an invalid plan status." };
  }

  const rawBlocks = Array.isArray(rawOutput.blocks) ? rawOutput.blocks : [];
  const rawOmitted = Array.isArray(rawOutput.omittedTasks) ? rawOutput.omittedTasks : [];
  const rawWarnings = Array.isArray(rawOutput.warnings) ? rawOutput.warnings : [];
  if (
    rawBlocks.length > MAX_BLOCKS ||
    rawOmitted.length > MAX_OMITTED_TASKS ||
    rawWarnings.length > MAX_WARNINGS
  ) {
    return { ok: false, status: "ai_invalid", message: "Smart Planner returned too much plan data." };
  }

  const taskMap = new Map(input.tasks.map((task) => [task.id, task]));
  const blocks = [];

  for (const [index, block] of rawBlocks.entries()) {
    if (!block || typeof block !== "object") {
      return { ok: false, status: "ai_invalid", message: "Smart Planner returned an invalid block." };
    }

    const type = text(block.type, 12);
    const taskId = block.taskId == null ? null : text(block.taskId, 120);
    const startMinute = Number(block.startMinute);
    const durationMinutes = Number(block.durationMinutes);
    const endMinute = startMinute + durationMinutes;

    if (
      !["study", "break"].includes(type) ||
      !Number.isInteger(startMinute) ||
      !Number.isInteger(durationMinutes) ||
      startMinute % 5 !== 0 ||
      durationMinutes % 5 !== 0 ||
      durationMinutes < 5 ||
      durationMinutes > 75 ||
      startMinute < input.startMinute ||
      endMinute > input.finishMinute ||
      overlapsBusyInterval(startMinute, endMinute, input.busyIntervals)
    ) {
      return { ok: false, status: "ai_invalid", message: "Smart Planner returned a block outside the available time." };
    }

    if ((type === "break" && taskId !== null) || (type === "study" && !taskMap.has(taskId))) {
      return { ok: false, status: "ai_invalid", message: "Smart Planner referenced work that was not supplied." };
    }

    const task = taskId ? taskMap.get(taskId) : null;
    blocks.push({
      type,
      taskId,
      title: text(block.title || (type === "break" ? "Break" : task?.title), 180),
      subject: type === "study" ? text(block.subject || task?.subject, 80) || null : null,
      startMinute,
      endMinute,
      durationMinutes,
      goal: text(block.goal, 240),
      reason: text(block.reason, 240),
      order: index,
    });
  }

  blocks.sort((first, second) => first.startMinute - second.startMinute || first.order - second.order);
  for (let index = 1; index < blocks.length; index += 1) {
    if (blocks[index].startMinute < blocks[index - 1].endMinute) {
      return { ok: false, status: "ai_invalid", message: "Smart Planner returned overlapping blocks." };
    }
  }

  if (status === "ready" && !blocks.some((block) => block.type === "study")) {
    return { ok: false, status: "ai_invalid", message: "Smart Planner returned no usable study blocks." };
  }

  const omittedTasks = [];
  const omittedIds = new Set();
  const scheduledTaskIds = new Set(
    blocks
      .filter((block) => block.type === "study")
      .map((block) => block.taskId)
  );
  for (const omitted of rawOmitted) {
    const taskId = text(omitted?.taskId, 120);
    const task = taskMap.get(taskId);
    if (!task || omittedIds.has(taskId) || scheduledTaskIds.has(taskId)) continue;
    omittedIds.add(taskId);
    omittedTasks.push({
      taskId,
      title: text(omitted?.title || task.title, 180),
      reason: text(omitted?.reason, 240),
      suggestedNextStep: text(omitted?.suggestedNextStep, 240),
    });
  }

  if (
    status === "ready" &&
    input.tasks.some(
      (task) => !scheduledTaskIds.has(task.id) && !omittedIds.has(task.id)
    )
  ) {
    return {
      ok: false,
      status: "ai_invalid",
      message: "Smart Planner did not explain every unscheduled task.",
    };
  }

  if (status !== "ready" && blocks.length > 0) {
    return {
      ok: false,
      status: "ai_invalid",
      message: "Smart Planner returned blocks for an unavailable plan.",
    };
  }

  return {
    ok: true,
    plan: {
      status,
      summary: text(rawOutput.summary, 280),
      blocks: blocks.map((block) => {
        const normalizedBlock = { ...block };
        delete normalizedBlock.order;
        return normalizedBlock;
      }),
      omittedTasks,
      warnings: rawWarnings.map((warning) => text(warning, 240)).filter(Boolean),
    },
  };
}

async function readSafeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function requestAnthropicPlan(input) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 22000);
  const model = process.env.ANTHROPIC_SMART_PLANNER_MODEL || "claude-sonnet-5";
  const requestBody = {
    model,
    max_tokens: 2000,
    system: SMART_PLANNER_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Build today's plan from this bounded planning context:\n${JSON.stringify(input)}`,
      },
    ],
    output_config: {
      effort: "medium",
      format: {
        type: "json_schema",
        schema: SMART_PLANNER_OUTPUT_SCHEMA,
      },
    },
  };

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    const responseJson = await readSafeJson(response);

    if (response.ok) {
      const outputText = Array.isArray(responseJson?.content)
        ? responseJson.content.find((item) => item?.type === "text")?.text
        : "";
      try {
        return { ok: true, model, output: JSON.parse(outputText || "{}") };
      } catch {
        return {
          ok: false,
          status: "ai_invalid",
          message: "Smart Planner returned an unreadable plan.",
        };
      }
    }

    if (TEMPORARY_ANTHROPIC_STATUSES.has(response.status)) {
      return {
        ok: false,
        status: "temporary_error",
        message: "Smart Planner is temporarily unavailable. Try again or use the Basic planner.",
      };
    }
    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        status: "provider_permission",
        message: "Smart Planner is not available with the current server setup.",
      };
    }
    if (
      response.status === 402 ||
      responseJson?.error?.type === "billing_error" ||
      responseJson?.error?.type === "insufficient_credits"
    ) {
      return {
        ok: false,
        status: "provider_credits",
        message: "Smart Planner is temporarily unavailable.",
      };
    }
    return {
      ok: false,
      status: "provider_unavailable",
      message: "Smart Planner is temporarily unavailable.",
    };
  } catch (error) {
    return error?.name === "AbortError"
      ? { ok: false, status: "timeout", message: "Smart Planner took too long to respond." }
      : { ok: false, status: "network_error", message: "Smart Planner could not be reached." };
  } finally {
    clearTimeout(timeout);
  }
}
