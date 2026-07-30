import { randomUUID } from "node:crypto";

export const GOAL_TYPES = ["daily", "weekly", "vs_daily", "vs_weekly", "desert_storm", "theme_week", "alliance_event", "personal", "custom"];
export const GOAL_STATUSES = ["not_started", "in_progress", "completed", "paused", "missed", "archived"];
export const PROGRESS_MODES = ["checkbox", "numeric", "percentage", "count", "score", "manual", "automatic"];

export function isFinalResultStatus(type, status) {
  if (type === "theme_week") return ["finalized", "archived"].includes(status);
  if (type === "vs_day") return status === "published";
  if (type === "vs_week") return status === "finalized";
  return false;
}

export function normalizePrivateJournal(item, ownerUid) {
  const entryType = String(item.entryType || item.type || "general");
  const body = String(item.body ?? item.text ?? "").slice(0, 8000);
  return {
    id: String(item.id || `journal-${randomUUID()}`),
    ownerUid,
    title: String(item.title || "").slice(0, 120),
    body,
    entryType,
    text: body,
    type: entryType,
    vsWeekId: String(item.vsWeekId || ""),
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString(),
    eventId: String(item.eventId || ""),
    goalIds: Array.isArray(item.goalIds) ? item.goalIds.map(String) : [],
    tags: Array.isArray(item.tags) ? item.tags.map(String).slice(0, 20) : [],
    isPinned: Boolean(item.isPinned),
    archivedAt: item.archivedAt || null,
    reminderAt: item.reminderAt || null
  };
}

export function normalizeGoal(input, ownerUid, existing = {}) {
  const timestamp = new Date().toISOString();
  const status = GOAL_STATUSES.includes(input.status) ? input.status : existing.status || "not_started";
  const goal = {
    id: existing.id || String(input.id || `goal-${randomUUID()}`),
    ownerUid,
    title: String(input.title || existing.title || "").trim().slice(0, 140),
    description: String(input.description ?? existing.description ?? "").trim().slice(0, 2000),
    goalType: GOAL_TYPES.includes(input.goalType) ? input.goalType : existing.goalType || "custom",
    status,
    progressMode: PROGRESS_MODES.includes(input.progressMode) ? input.progressMode : existing.progressMode || "checkbox",
    currentValue: Number(input.currentValue ?? existing.currentValue ?? 0),
    targetValue: Math.max(0, Number(input.targetValue ?? existing.targetValue ?? 1)),
    unit: String(input.unit ?? existing.unit ?? "").slice(0, 40),
    startDate: String(input.startDate ?? existing.startDate ?? ""),
    dueDate: String(input.dueDate ?? existing.dueDate ?? ""),
    relatedEventId: String(input.relatedEventId ?? existing.relatedEventId ?? ""),
    relatedJournalId: String(input.relatedJournalId ?? existing.relatedJournalId ?? ""),
    recurrence: input.recurrence ?? existing.recurrence ?? null,
    recurrenceSeriesId: String(input.recurrenceSeriesId ?? existing.recurrenceSeriesId ?? ""),
    recurrenceFromGoalId: String(input.recurrenceFromGoalId ?? existing.recurrenceFromGoalId ?? ""),
    priority: ["critical", "high", "normal", "informational"].includes(input.priority) ? input.priority : existing.priority || "normal",
    progressSource: input.progressSource === "automatic" ? "automatic" : "manual",
    automationMetric: ["vs_score", "attendance", "confirmation"].includes(input.automationMetric) ? input.automationMetric : existing.automationMetric || "",
    createdAt: existing.createdAt || timestamp,
    updatedAt: timestamp,
    completedAt: status === "completed" ? existing.completedAt || timestamp : null,
    archivedAt: status === "archived" ? existing.archivedAt || timestamp : null
  };
  if (!goal.title) throw Object.assign(new Error("Enter a goal title"), { statusCode: 422 });
  return goal;
}

export function goalsForUser(userGoals, uid) {
  return Array.isArray(userGoals?.[uid]) ? userGoals[uid].filter((goal) => goal.ownerUid === uid) : [];
}

export function isGoalRelevant(goal, date, vsWeek = null) {
  if (["archived", "missed"].includes(goal.status)) return false;
  if (goal.status === "completed") return true;
  const day = typeof date === "string" ? date : date.toISOString().slice(0, 10);
  if (goal.goalType === "daily" || goal.goalType === "vs_daily") return (!goal.startDate || goal.startDate <= day) && (!goal.dueDate || goal.dueDate >= day);
  if (goal.goalType === "vs_weekly" && vsWeek) {
    const end = new Date(`${vsWeek.beginDate}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 6);
    return day >= vsWeek.beginDate && day <= end.toISOString().slice(0, 10);
  }
  return (!goal.startDate || goal.startDate <= day) && (!goal.dueDate || goal.dueDate >= day);
}

export function awardTopThree(state, ranking, context) {
  state.userAchievements ||= {};
  const awarded = [];
  ranking.slice(0, 3).forEach((record, index) => {
    const account = Object.values(state.users || {}).find((user) => user.playerId === record.playerId);
    if (!account) return;
    const placement = index + 1;
    const achievementKey = `${context.type}_top_${placement}`;
    const idempotencyKey = `${achievementKey}:${account.uid}:${context.eventId}:${context.periodId}`;
    state.userAchievements[account.uid] ||= [];
    if (state.userAchievements[account.uid].some((item) => item.idempotencyKey === idempotencyKey)) return;
    const achievement = {
      id: `achievement-${randomUUID()}`,
      idempotencyKey,
      achievementKey,
      userUid: account.uid,
      eventId: context.eventId,
      eventType: context.type,
      periodId: context.periodId,
      placement,
      measuredValue: Number(record.value || 0),
      title: `${context.label} · ${placement}${placement === 1 ? "st" : placement === 2 ? "nd" : "rd"} place`,
      message: context.message(record, placement),
      icon: state.achievementDefinitions?.icon || "trophy",
      badgeStyle: state.achievementDefinitions?.badgeStyle || "gold",
      earnedAt: new Date().toISOString(),
      seenAt: null,
      dismissedAt: null,
      metadata: {}
    };
    state.userAchievements[account.uid].unshift(achievement);
    awarded.push(achievement);
  });
  return awarded;
}

export function awardAchievement(state, playerId, definition) {
  const account = Object.values(state.users || {}).find((user) => user.playerId === playerId);
  if (!account) return null;
  state.userAchievements ||= {};
  state.userAchievements[account.uid] ||= [];
  const idempotencyKey = `${definition.key}:${account.uid}:${definition.eventId}:${definition.periodId}`;
  if (state.userAchievements[account.uid].some((item) => item.idempotencyKey === idempotencyKey)) return null;
  const achievement = {
    id: `achievement-${randomUUID()}`, idempotencyKey, achievementKey: definition.key,
    userUid: account.uid, eventId: definition.eventId, eventType: definition.eventType,
    periodId: definition.periodId, placement: definition.placement || null,
    measuredValue: Number(definition.value || 0), title: definition.title, message: definition.message,
    icon: definition.icon || state.achievementDefinitions?.icon || "star",
    badgeStyle: definition.badgeStyle || state.achievementDefinitions?.badgeStyle || "gold",
    earnedAt: new Date().toISOString(), seenAt: null, dismissedAt: null, metadata: definition.metadata || {}
  };
  state.userAchievements[account.uid].unshift(achievement);
  return achievement;
}
