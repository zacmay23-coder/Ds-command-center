import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { battlePhases, strategyPlans } from "../public/battle-plan.js";
import { createStarterStrategies } from "./strategyLibrary.js";
import {
  isFirebasePersistenceEnabled,
  loadFirebaseState,
  saveFirebaseState
} from "./firebasePersistence.js";
import {
  addAudit,
  applyStrategyTemplate,
  calculateParticipation,
  createEvent,
  CURRENT_SCHEMA,
  migrateLegacyState,
  newId,
  normalizeParticipant,
  normalizePlayer,
  normalizePlayerName,
  normalizeAllianceWeeklyEvent,
  normalizeVsScore,
  normalizeVsWeek,
  normalizeDuelLeagueGroup,
  normalizeThemeWeek,
  normalizeManagedEvent,
  MANAGED_EVENT_TYPES,
  normalizeTemplate,
  now,
  transitionEvent,
  validateEventForPublish
} from "./domain.js";
import { sanitizeTextFields } from "./textSanitization.js";
import { awardAchievement, awardTopThree, goalsForUser, isFinalResultStatus, normalizeGoal, normalizePrivateJournal } from "./personalCompanion.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const dataDir = path.join(projectRoot, "data");
const statePath = path.join(dataDir, "state.json");
const backupPath = path.join(dataDir, "state.pre-events-v1.json");
const migrationReportPath = path.join(projectRoot, "MIGRATION_REPORT.md");
const primaryAdministratorEmail = "zacheryaaronmay@gmail.com";
const protectedAdministratorEmails = [
  primaryAdministratorEmail,
  "zacmay23@gmail.com"
];
let cachedState;
const subscribers = new Set();

function recoveryAdministratorEmails() {
  return new Set([
    ...protectedAdministratorEmails,
    process.env.DSCC_BOOTSTRAP_ADMIN_EMAIL,
    ...String(process.env.DSCC_RESTORE_ADMIN_EMAILS || "").split(",")
  ].map((value) => String(value || "").trim().toLowerCase()).filter(Boolean));
}

export function isRecoveryAdministrator(firebaseUser) {
  return recoveryAdministratorEmails().has(String(firebaseUser?.email || "").trim().toLowerCase());
}

export function restoreAdministratorIdentity(state, firebaseUser) {
  if (!isRecoveryAdministrator(firebaseUser)) return { user: state.users[firebaseUser.localId], changed: false };

  const email = String(firebaseUser.email || "").trim().toLowerCase();
  const matches = Object.entries(state.users).filter(([, account]) =>
    String(account.email || "").trim().toLowerCase() === email
  );
  if (!matches.length) return { user: state.users[firebaseUser.localId], changed: false };

  const current = state.users[firebaseUser.localId];
  const needsIdentityMigration = matches.some(([key, account]) =>
    key !== firebaseUser.localId || account.uid !== firebaseUser.localId
  );
  if (current && !needsIdentityMigration) return { user: current, changed: false };

  const bestMatch = matches
    .map(([, account]) => account)
    .sort((left, right) =>
      Number(Boolean(right.profileConfirmedAt)) - Number(Boolean(left.profileConfirmedAt))
      || Number(Boolean(right.playerId)) - Number(Boolean(left.playerId))
      || Number(right.version || 0) - Number(left.version || 0)
    )[0];
  const user = current || structuredClone(bestMatch);
  const staleUids = new Set(matches.map(([, account]) => account.uid).filter((uid) => uid && uid !== firebaseUser.localId));
  const linkedPlayerId = user.playerId || bestMatch.playerId || null;

  Object.assign(user, {
    uid: firebaseUser.localId,
    email: firebaseUser.email,
    role: "administrator",
    applicationRole: "administrator",
    accountStatus: "active",
    officerPermissions: ["*"],
    playerId: linkedPlayerId,
    active: true,
    version: Math.max(Number(user.version || 0), Number(bestMatch.version || 0)) + 1
  });
  if (linkedPlayerId && state.players[linkedPlayerId]) {
    state.players[linkedPlayerId].userId = firebaseUser.localId;
    user.displayName = state.players[linkedPlayerId].gameName || user.displayName;
  }
  for (const player of Object.values(state.players)) {
    if (staleUids.has(player.userId)) player.userId = firebaseUser.localId;
  }
  for (const [key, account] of matches) {
    if (key !== firebaseUser.localId && account !== user) delete state.users[key];
  }
  state.users[firebaseUser.localId] = user;
  return { user, changed: true };
}

export async function getState() {
  if (!cachedState) {
    cachedState = await loadAndMigrateState();
    ensureInteractiveStrategyTemplates(cachedState);
  }
  return cachedState;
}

function ensureInteractiveStrategyTemplates(state) {
  const phaseCopies = (plan) => battlePhases.map((phaseKey) => {
    const [startMinute, endMinute] = phaseKey.split("-").map(Number);
    const groupOrders = Object.fromEntries(Object.entries(plan.phases[phaseKey]).map(([group, order]) => [group, {
      primaryObjective: order.objective || "",
      secondaryObjective: order.secondaryObjective || "",
      primaryAction: normalizeStrategyAction(order.action),
      secondaryAction: order.secondaryObjective ? "Support" : "Hold",
      goal: order.instruction || ""
    }]));
    groupOrders.Disrupters = groupOrders.Disrupters || {
      primaryObjective: teamDisrupterObjective(plan, phaseKey),
      secondaryObjective: "",
      primaryAction: "Contest",
      secondaryAction: "Rotate",
      goal: "Disrupt enemy rotations and force defensive responses."
    };
    return { id: `phase-${phaseKey}`, name: `Battle phase ${startMinute}–${endMinute}`, startMinute, endMinute, priority: "High", instructions: "Execute the defined group orders.", fallbackPlan: "Shift to the secondary objective on command.", groupOrders };
  });
  const plans = {
    "strategy-standard-control": { name: "Standard Control & Rotation", A: strategyPlans.A, B: strategyPlans.B },
    "strategy-aggressive-center-control": { name: "Aggressive Center Control", A: strategyPlans.A, B: strategyPlans.A },
    "strategy-balanced-east-control": { name: "Balanced East Control", A: strategyPlans.B, B: strategyPlans.B }
  };
  for (const [id, definition] of Object.entries(plans)) {
    const template = state.strategyTemplates[id] ||= {
      id, name: definition.name, description: "Six-stage interactive battle strategy.", team: "Both",
      active: true, objectives: [], phases: [], structureResponsibilities: {}, defaultAssignments: {},
      notes: "", createdAt: now(), createdBy: "", updatedAt: now(), version: 1
    };
    template.groupOrdersByTeam = { A: phaseCopies(definition.A), B: phaseCopies(definition.B) };
    if (!template.phases?.length || template.phases.length !== 6) template.phases = phaseCopies(definition.A);
  }
  for (const starter of createStarterStrategies()) {
    const convert = (team) => phaseCopies({ phases: starter.teamPlans[team].phases });
    const existingByName = Object.values(state.strategyTemplates).find((item) =>
      item.name.trim().toLowerCase() === starter.name.trim().toLowerCase()
    );
    const template = state.strategyTemplates[starter.id] || existingByName || (state.strategyTemplates[starter.id] = {
      id: starter.id,
      name: starter.name,
      description: starter.goal,
      team: "Both",
      active: true,
      objectives: [],
      phases: convert("A"),
      structureResponsibilities: {},
      defaultAssignments: {},
      notes: `${starter.category} · ${starter.difficulty}`,
      createdAt: starter.createdAt,
      createdBy: "",
      updatedAt: starter.updatedAt,
      version: starter.version
    });
    template.groupOrdersByTeam = { A: convert("A"), B: convert("B") };
    if (!template.description) template.description = starter.goal;
  }
}

function teamDisrupterObjective(plan, phaseKey) {
  return plan.phases[phaseKey]?.["Strike Team"]?.secondaryObjective
    || plan.phases[phaseKey]?.["Strike Team"]?.objective
    || "Arsenal";
}

function normalizeStrategyAction(action) {
  const value = String(action || "").toLowerCase();
  if (value.includes("secure") || value.includes("capture")) return "Secure";
  if (value.includes("rotate")) return "Rotate";
  if (value.includes("attack") || value.includes("counter")) return "Attack";
  if (value.includes("contest") || value.includes("pressure")) return "Contest";
  if (value.includes("defend") || value.includes("defense")) return "Defend";
  if (value.includes("support") || value.includes("reinforce")) return "Support";
  return "Hold";
}

export async function saveState() {
  const state = await getState();
  applyGoalDeadlines(state);
  const sanitized = sanitizeTextFields(state);
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, sanitized);
  state.updatedAt = now();
  if (isFirebasePersistenceEnabled()) {
    await saveFirebaseState(state);
  } else {
    await mkdir(dataDir, { recursive: true });
    await writeFile(statePath, JSON.stringify(state, null, 2), "utf8");
  }
  notifySubscribers(state);
  return state;
}

export function applyGoalDeadlines(state) {
  const today = new Date().toISOString().slice(0, 10);
  for (const [uid, goals] of Object.entries(state.userGoals || {})) {
    if (!Array.isArray(goals)) continue;
    for (const goal of [...goals]) {
      if (goal.dueDate && goal.dueDate < today && !["completed", "archived", "missed"].includes(goal.status)) {
        goal.status = "missed";
        goal.updatedAt = now();
      }
      if (!goal.dueDate || goal.dueDate >= today || !["daily", "weekdays", "weekly"].includes(goal.recurrence)) continue;
      const nextDate = nextRecurringDate(goal.dueDate, goal.recurrence, today);
      const seriesId = goal.recurrenceSeriesId || goal.id;
      goal.recurrenceSeriesId = seriesId;
      if (goals.some((candidate) => candidate.recurrenceSeriesId === seriesId && candidate.dueDate === nextDate)) continue;
      goals.unshift(normalizeGoal({
        ...goal,
        id: "",
        ownerUid: uid,
        status: "not_started",
        currentValue: 0,
        startDate: nextDate,
        dueDate: nextDate,
        recurrenceSeriesId: seriesId,
        recurrenceFromGoalId: goal.id,
        createdAt: undefined,
        updatedAt: undefined,
        completedAt: null,
        archivedAt: null
      }, uid));
    }
  }
}

function nextRecurringDate(sourceDate, recurrence, minimumDate) {
  const next = new Date(`${sourceDate}T12:00:00Z`);
  const advance = () => {
    next.setUTCDate(next.getUTCDate() + (recurrence === "weekly" ? 7 : 1));
    if (recurrence === "weekdays") {
      while ([0, 6].includes(next.getUTCDay())) next.setUTCDate(next.getUTCDate() + 1);
    }
  };
  do advance(); while (next.toISOString().slice(0, 10) < minimumDate);
  return next.toISOString().slice(0, 10);
}

export async function sanitizeLegacyText({ dryRun = true } = {}, actor) {
  const state = await getState();
  const changes = [];
  const sanitized = sanitizeTextFields(state, { collectChanges: changes });
  if (!dryRun && changes.length) {
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, sanitized);
    addAudit(state, actor, {
      action: "legacy_text_sanitized",
      recordType: "maintenance",
      recordId: "text-sanitization",
      after: { changedValues: changes.length }
    });
    await saveState();
  }
  return {
    dryRun: Boolean(dryRun),
    changedValues: changes.length,
    affectedRecords: new Set(changes.map((item) => item.path.split(".").slice(0, 3).join("."))).size,
    paths: changes.slice(0, 100).map((item) => item.path)
  };
}

export async function migratePrivateMemberData({ dryRun = true } = {}, actor) {
  const state = await getState();
  const nextJournals = structuredClone(state.userJournals || {});
  let journalEntriesChanged = 0;
  let quarantinedEntries = 0;
  const quarantine = [];
  for (const [uid, entries] of Object.entries(nextJournals)) {
    if (!state.users[uid] || !Array.isArray(entries)) {
      quarantinedEntries += Array.isArray(entries) ? entries.length : 1;
      quarantine.push({ uid, count: Array.isArray(entries) ? entries.length : 1 });
      delete nextJournals[uid];
      continue;
    }
    nextJournals[uid] = entries.map((entry) => {
      const normalized = normalizePrivateJournal(entry, uid);
      if (JSON.stringify(firebaseComparable(normalized)) !== JSON.stringify(firebaseComparable(entry))) journalEntriesChanged += 1;
      return normalized;
    });
  }
  if (!dryRun) {
    state.privateMigrationBackups ||= {};
    state.privateMigrationBackups["journal-v1"] ||= {
      createdAt: now(),
      userJournals: structuredClone(state.userJournals || {})
    };
    state.userJournals = nextJournals;
    state.userGoals ||= {};
    state.privateDataQuarantine ||= {};
    if (quarantine.length) state.privateDataQuarantine.journals = quarantine;
    addAudit(state, actor, {
      action: "private_member_data_migrated",
      recordType: "maintenance",
      recordId: "private-member-data",
      after: { journalEntriesChanged, quarantinedEntries }
    });
    await saveState();
  }
  return {
    dryRun: Boolean(dryRun),
    journalEntriesChanged,
    quarantinedEntries,
    backupKey: dryRun ? null : "journal-v1"
  };
}

function firebaseComparable(value) {
  if (Array.isArray(value)) {
    const items = value.map(firebaseComparable).filter((item) => item !== undefined);
    return items.length ? items : undefined;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .map(([key, item]) => [key, firebaseComparable(item)])
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  return value === null || value === undefined ? undefined : value;
}

export function subscribe(listener) {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

export async function getClientState(user) {
  const state = await getState();
  const visibleEvents = Object.values(state.events)
    .filter((event) => user.role !== "member" || event.status !== "draft")
    .sort((left, right) => right.date.localeCompare(left.date));
  const activeEvent = chooseActiveEvent(state, user);
  const participants = activeEvent ? Object.values(state.eventParticipants[activeEvent.id] || {}) : [];
  return {
    schema: state.schema,
    updatedAt: state.updatedAt,
    me: user,
    activeEventId: activeEvent?.id || null,
    activeEvent,
    events: visibleEvents,
    players: Object.values(state.players).map(publicPlayer),
    rosterAccounts: Object.values(state.players).map((player) => {
      const account = Object.values(state.users).find((item) => item.playerId === player.id);
      const safe = {
        playerId: player.id,
        registered: Boolean(account),
        registrationStatus: !player.active ? "Inactive" : account ? "Registered" : "Not Registered",
        accountActive: Boolean(account?.active),
        accountRole: account?.role || "member",
        profileComplete: Boolean(account?.profileSetupCompletedAt),
        profileTitle: account?.profileTitle || ""
      };
      return ["officer", "administrator"].includes(user.role) ? {
        ...safe,
        uid: account?.uid || null,
        email: account?.email || "",
        displayName: account?.displayName || "",
        lastActiveAt: account?.lastLoginAt || account?.updatedAt || null,
        thpUpdatedBy: player.thpUpdatedBy || null,
        thpVerifiedBy: player.thpVerifiedBy || null,
        nameHistory: player.previousPlayerNames || []
      } : safe;
    }),
    participants: participants.map((participant) => publicParticipant(participant, user)),
    members: Object.values(state.players).map((player) => legacyMemberProjection(
      player,
      activeEvent ? state.eventParticipants[activeEvent.id]?.[player.id] : null
    )),
    settings: activeEvent ? {
      strategyA: activeEvent.strategyA,
      strategyB: activeEvent.strategyB,
      battleTimeA: activeEvent.battleTimeA,
      battleTimeB: activeEvent.battleTimeB
    } : {
      strategyA: "Standard Control & Rotation",
      strategyB: "Standard Control & Rotation",
      battleTimeA: "9:00",
      battleTimeB: "9:00"
    },
    battles: visibleEvents.filter((event) => event.status === "archived").map((event) =>
      legacyBattleProjection(event, state.eventParticipants[event.id] || {})
    ),
    strategyTemplates: user.role === "member" ? [] : Object.values(state.strategyTemplates).filter((template) => template.active),
    eventStrategy: activeEvent ? mapStrategyForUser(state, activeEvent.id, user) : {},
    eventMap: activeEvent ? mapPlanForUser(state, activeEvent.id, user) : null,
    allianceWeeklyEvents: Object.values(state.allianceWeeklyEvents)
      .filter((item) => item.active)
      .sort((left, right) => `${left.date}T${left.time}`.localeCompare(`${right.date}T${right.time}`)),
    themeWeeks: Object.values(state.themeWeeks)
      .filter((theme) => theme.status !== "archived")
      .sort((left, right) => right.weekOf.localeCompare(left.weekOf))
      .map((theme) => publicThemeWeek(theme, user)),
    archivedThemeWeeks: Object.values(state.themeWeeks)
      .filter((theme) => theme.status === "archived")
      .sort((left, right) => right.weekOf.localeCompare(left.weekOf))
      .map((theme) => publicThemeWeek(theme, user)),
    memberNotices: state.memberNotices.filter((notice) => user.role !== "member" || notice.playerId === user.playerId),
    officerQuestions: state.officerQuestions.filter((question) => user.role !== "member" || question.playerId === user.playerId),
    announcements: state.announcements.map((announcement) => ({
      ...announcement,
      createdByName: announcementAuthorName(state, announcement),
      replies: (announcement.replies || []).map((reply) => ({
        ...reply,
        playerName: state.players[reply.playerId]?.gameName || "Alliance member",
        profileImage: state.players[reply.playerId]?.profileImage || ""
      })),
      helpfulCount: Object.keys(announcement.helpful || {}).length,
      markedHelpful: user.playerId ? Boolean(announcement.helpful?.[user.playerId]) : false,
      acknowledgedAt: user.playerId ? announcement.acknowledgements?.[user.playerId] || null : null,
      acknowledgements: undefined,
      helpful: undefined
    })),
    messageRecipients: Object.values(state.users)
      .filter((account) => account.active && account.playerId && account.uid !== user.uid)
      .map((account) => ({
        uid: account.uid,
        playerId: account.playerId,
        name: state.players[account.playerId]?.gameName || account.displayName || "Alliance member",
        profileImage: state.players[account.playerId]?.profileImage || ""
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    privateMessages: state.privateMessages
      .filter((message) => message.senderUid === user.uid || message.recipientUid === user.uid)
      .slice(-500)
      .map((message) => publicPrivateMessage(state, message, user)),
    dailyChat: (state.dailyChats[localDateKey()] || []).slice(-300).map((message) => ({
      ...message,
      playerName: state.players[message.playerId]?.gameName || "Alliance member",
      profileImage: state.players[message.playerId]?.profileImage || ""
    })),
    dailyChatHistory: Object.fromEntries(Object.entries(state.dailyChats || {}).map(([date, messages]) => [date,
      messages.slice(-300).map((message) => ({
        ...message,
        playerName: state.players[message.playerId]?.gameName || "Alliance member",
        profileImage: state.players[message.playerId]?.profileImage || ""
      }))
    ])),
    dailyChatDate: localDateKey(),
    myJournal: (Array.isArray(state.userJournals[user.uid]) ? state.userJournals[user.uid] : [])
      .map((item) => normalizePrivateJournal(item, user.uid)),
    myGoals: goalsForUser(state.userGoals, user.uid),
    myAchievements: Array.isArray(state.userAchievements?.[user.uid]) ? state.userAchievements[user.uid] : [],
    achievementDefinitions: user.role === "administrator" ? state.achievementDefinitions || {} : undefined,
    leadership: ["officer", "administrator"].includes(user.role) ? publicLeadership(state, user) : undefined,
    officerRecipients: Object.values(state.users)
      .filter((account) => account.active && ["officer", "administrator"].includes(account.role))
      .map((account) => ({ uid: account.uid, displayName: account.displayName, role: account.role })),
    pendingResults: user.role === "member" ? [] : state.pendingResults,
    vsScores: [...state.vsScores].sort((left, right) =>
      right.date.localeCompare(left.date) || Number(right.score) - Number(left.score)
    ),
    vsWeeks: Object.values(state.vsWeeks).sort((left, right) => right.beginDate.localeCompare(left.beginDate)),
    duelLeagueGroups: Object.values(state.duelLeagueGroups).sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    permissions: permissionsFor(user)
  };
}

export async function addMemberNotice(input, actor) {
  const state = await getState();
  if (!actor.playerId) throw statusError(422, "Confirm your roster profile before posting a notice");
  const notice = {
    id: newId("notice"),
    playerId: actor.playerId,
    eventType: String(input.eventType || "Alliance event"),
    message: String(input.message || "").trim().slice(0, 300),
    date: new Date().toISOString().slice(0, 10),
    createdAt: now()
  };
  if (!notice.message) throw statusError(422, "Enter a short availability notice");
  state.memberNotices.unshift(notice);
  state.memberNotices = state.memberNotices.slice(0, 500);
  await saveState();
  return notice;
}

export async function addOfficerQuestion(input, actor) {
  const state = await getState();
  if (!actor.playerId) throw statusError(422, "Confirm your roster profile before asking a question");
  const recipient = String(input.recipient || "administrator");
  if (recipient !== "administrator" && !state.users[recipient]) throw statusError(422, "Choose a valid officer");
  const question = {
    id: newId("question"),
    playerId: actor.playerId,
    recipient,
    message: String(input.message || "").trim().slice(0, 600),
    status: "open",
    createdAt: now()
  };
  if (!question.message) throw statusError(422, "Enter your question");
  state.officerQuestions.unshift(question);
  state.officerQuestions = state.officerQuestions.slice(0, 1000);
  await saveState();
  return question;
}

export async function addAnnouncement(input, actor) {
  const state = await getState();
  const announcement = {
    id: newId("announcement"),
    title: String(input.title || "").trim().slice(0, 120),
    summary: String(input.summary || "").trim().slice(0, 1200),
    attachment: String(input.attachment || ""),
    attachmentName: String(input.attachmentName || "").slice(0, 160),
    body: String(input.body || input.summary || "").trim().slice(0, 4000),
    priority: ["critical", "high", "normal", "low"].includes(String(input.priority || "").toLowerCase()) ? String(input.priority).toLowerCase() : "normal",
    pinned: Boolean(input.pinned),
    status: "published",
    audienceType: "all",
    audienceIds: [],
    relatedEventId: String(input.relatedEventId || ""),
    expiresAt: String(input.expiresAt || ""),
    acknowledgements: {},
    replies: [],
    helpful: {},
    createdAt: now(),
    createdBy: actor.uid
  };
  if (!announcement.title || !announcement.summary) throw statusError(422, "Enter an announcement title and summary");
  state.announcements.unshift(announcement);
  await saveState();
  return announcement;
}

export async function updateAnnouncement(announcementId, input, actor) {
  const state = await getState();
  const announcement = state.announcements.find((item) => item.id === announcementId);
  if (!announcement) throw statusError(404, "Announcement was not found");
  const priority = String(input.priority ?? announcement.priority ?? "normal").toLowerCase();
  const patch = {
    title: String(input.title ?? announcement.title).trim().slice(0, 120),
    summary: String(input.summary ?? announcement.summary).trim().slice(0, 280),
    body: String(input.body ?? announcement.body ?? announcement.summary).trim().slice(0, 4000),
    priority: ["critical", "high", "normal", "low"].includes(priority) ? priority : "normal",
    pinned: input.pinned === undefined ? Boolean(announcement.pinned) : Boolean(input.pinned),
    expiresAt: String(input.expiresAt ?? announcement.expiresAt ?? ""),
    status: ["published", "archived"].includes(input.status) ? input.status : announcement.status || "published",
    updatedAt: now(),
    updatedBy: actor.uid
  };
  if (!patch.title || !patch.summary) throw statusError(422, "Enter an announcement title and summary");
  Object.assign(announcement, patch);
  await saveState();
  return announcement;
}

export async function acknowledgeAnnouncement(announcementId, actor) {
  const state = await getState();
  const announcement = state.announcements.find((item) => item.id === announcementId);
  if (!announcement) throw statusError(404, "Announcement was not found");
  if (!actor.playerId) throw statusError(422, "Confirm your roster profile first");
  announcement.acknowledgements ||= {};
  announcement.acknowledgements[actor.playerId] = now();
  await saveState();
  return { acknowledgedAt: announcement.acknowledgements[actor.playerId] };
}

export async function replyToAnnouncement(announcementId, input, actor) {
  const state = await getState();
  const announcement = state.announcements.find((item) => item.id === announcementId);
  if (!announcement) throw statusError(404, "Announcement was not found");
  if (!actor.playerId) throw statusError(422, "Confirm your roster profile before replying");
  const text = String(input.text || "").trim().slice(0, 500);
  if (!text) throw statusError(422, "Enter a reply");
  announcement.replies ||= [];
  const reply = {
    id: newId("announcement-reply"),
    playerId: actor.playerId,
    text,
    createdAt: now()
  };
  announcement.replies.push(reply);
  announcement.replies = announcement.replies.slice(-250);
  await saveState();
  return reply;
}

export async function toggleAnnouncementHelpful(announcementId, actor) {
  const state = await getState();
  const announcement = state.announcements.find((item) => item.id === announcementId);
  if (!announcement) throw statusError(404, "Announcement was not found");
  if (!actor.playerId) throw statusError(422, "Confirm your roster profile before giving feedback");
  announcement.helpful ||= {};
  if (announcement.helpful[actor.playerId]) delete announcement.helpful[actor.playerId];
  else announcement.helpful[actor.playerId] = now();
  await saveState();
  return {
    markedHelpful: Boolean(announcement.helpful[actor.playerId]),
    helpfulCount: Object.keys(announcement.helpful).length
  };
}

export async function deleteAnnouncement(announcementId) {
  const state = await getState();
  const index = state.announcements.findIndex((item) => item.id === announcementId);
  if (index < 0) throw statusError(404, "Announcement was not found");
  state.announcements.splice(index, 1);
  await saveState();
  return { deleted: true };
}

export async function sendPrivateMessage(input, actor) {
  const state = await getState();
  if (!actor.playerId) throw statusError(422, "Confirm your roster profile before messaging");
  const recipientUid = String(input.recipientUid || "");
  const recipient = state.users[recipientUid];
  if (!recipient?.active || !recipient.playerId || recipientUid === actor.uid) {
    throw statusError(422, "Choose another registered member");
  }
  const text = String(input.text || "").trim().slice(0, 1000);
  if (!text) throw statusError(422, "Enter a message");
  const message = {
    id: newId("private-message"),
    senderUid: actor.uid,
    recipientUid,
    text,
    priority: ["officer", "administrator"].includes(actor.role) && ["standard", "important", "action_required", "assignment_change", "event_reminder"].includes(input.priority) ? input.priority : "standard",
    readAtByRecipient: null,
    createdAt: now()
  };
  state.privateMessages.push(message);
  state.privateMessages = state.privateMessages.slice(-5000);
  await saveState();
  return publicPrivateMessage(state, message, actor);
}

export async function markPrivateMessageRead(messageId, actor) {
  const state = await getState();
  const message = state.privateMessages.find((item) => item.id === messageId && item.recipientUid === actor.uid);
  if (!message) throw statusError(404, "Private message was not found");
  message.readAtByRecipient ||= now();
  await saveState();
  return publicPrivateMessage(state, message, actor);
}

export async function postDailyChatMessage(input, actor) {
  const state = await getState();
  if (!actor.playerId) throw statusError(422, "Confirm your roster profile before chatting");
  const text = String(input.text || "").trim().slice(0, 500);
  if (!text) throw statusError(422, "Enter a chat message");
  const date = localDateKey();
  state.dailyChats[date] ||= [];
  const message = {
    id: newId("daily-chat"),
    playerId: actor.playerId,
    text,
    createdAt: now()
  };
  state.dailyChats[date].push(message);
  state.dailyChats[date] = state.dailyChats[date].slice(-500);
  await saveState();
  return message;
}

export async function saveJournalItem(input, actor) {
  const state = await getState();
  if (!actor.playerId) throw statusError(422, "Confirm your roster profile before using the journal");
  state.userJournals[actor.uid] ||= [];
  const existing = input.id && state.userJournals[actor.uid].find((item) => item.id === input.id);
  if (input.id && !existing) throw statusError(404, "Journal entry was not found");
  const item = normalizePrivateJournal({ ...existing, ...input, body: input.body ?? input.text, entryType: input.entryType || input.type }, actor.uid);
  if (!item.title || !item.body) throw statusError(422, "Enter a journal title and details");
  if (!existing) state.userJournals[actor.uid].unshift(item);
  else Object.assign(existing, item);
  state.userJournals[actor.uid] = state.userJournals[actor.uid].slice(0, 500);
  await saveState();
  return item;
}

export async function saveGoal(input, actor) {
  const state = await getState();
  if (!actor.playerId) throw statusError(422, "Confirm your roster profile before creating goals");
  state.userGoals ||= {};
  state.userGoals[actor.uid] ||= [];
  const existing = input.id && state.userGoals[actor.uid].find((item) => item.id === input.id);
  if (input.id && !existing) throw statusError(404, "Goal was not found");
  const goal = normalizeGoal(input, actor.uid, existing);
  if (existing) Object.assign(existing, goal);
  else state.userGoals[actor.uid].unshift(goal);
  await saveState();
  return goal;
}

export async function deleteGoal(goalId, actor) {
  const state = await getState();
  state.userGoals ||= {};
  state.userGoals[actor.uid] ||= [];
  const goals = state.userGoals[actor.uid];
  const index = goals.findIndex((goal) => goal.id === goalId && goal.ownerUid === actor.uid);
  if (index < 0) throw statusError(404, "Goal was not found");
  goals.splice(index, 1);
  for (const entry of state.userJournals?.[actor.uid] || []) {
    entry.goalIds = (entry.goalIds || []).filter((id) => id !== goalId);
  }
  await saveState();
  return { deleted: true };
}

export async function updateAchievement(achievementId, input, actor) {
  const state = await getState();
  const achievements = state.userAchievements?.[actor.uid] || [];
  const achievement = achievements.find((item) => item.id === achievementId && item.userUid === actor.uid);
  if (!achievement) throw statusError(404, "Achievement was not found");
  if (input.seen === true && !achievement.seenAt) achievement.seenAt = now();
  if (input.dismissed === true && !achievement.dismissedAt) achievement.dismissedAt = now();
  if (input.dismissed === false) achievement.dismissedAt = null;
  await saveState();
  return achievement;
}

export async function updateAchievementDefinitions(input, actor) {
  const state = await getState();
  state.achievementDefinitions ||= {};
  state.achievementDefinitions.vsDailyThreshold = Math.max(0, Number(input.vsDailyThreshold || 0));
  state.achievementDefinitions.vsWeeklyThreshold = Math.max(0, Number(input.vsWeeklyThreshold || 0));
  state.achievementDefinitions.topThreeEnabled = input.topThreeEnabled !== false;
  state.achievementDefinitions.publicAnnouncements = Boolean(input.publicAnnouncements);
  state.achievementDefinitions.icon = ["star", "trophy", "shield", "trend"].includes(input.icon) ? input.icon : "star";
  state.achievementDefinitions.badgeStyle = ["gold", "blue", "success"].includes(input.badgeStyle) ? input.badgeStyle : "gold";
  state.achievementDefinitions.messageTemplate = String(input.messageTemplate || "You reached {value} in {event}.").slice(0, 240);
  state.achievementDefinitions.updatedAt = now();
  state.achievementDefinitions.updatedBy = actor.uid;
  const existingRules = Object.fromEntries((state.achievementDefinitions.rules || []).map((rule) => [rule.key, rule]));
  const rule = (key, title, category, triggerType, enabled, thresholdRules = null) => ({
    id: existingRules[key]?.id || `achievement-definition-${key}`,
    key, title, category, triggerType, enabled, audience: "private",
    placementRules: triggerType === "placement" ? [1, 2, 3] : null,
    thresholdRules,
    icon: state.achievementDefinitions.icon,
    badgeStyle: state.achievementDefinitions.badgeStyle,
    priority: "informational",
    createdAt: existingRules[key]?.createdAt || state.achievementDefinitions.updatedAt,
    updatedAt: state.achievementDefinitions.updatedAt
  });
  state.achievementDefinitions.rules = [
    rule("theme_week_top_three", "Theme Week top three", "theme_week", "placement", state.achievementDefinitions.topThreeEnabled),
    rule("vs_daily_top_three", "VS daily top three", "vs_daily", "placement", state.achievementDefinitions.topThreeEnabled),
    rule("vs_weekly_top_three", "VS weekly top three", "vs_weekly", "placement", state.achievementDefinitions.topThreeEnabled),
    rule("vs_daily_threshold", "VS daily threshold", "vs_daily", "threshold", state.achievementDefinitions.vsDailyThreshold > 0, { minimum: state.achievementDefinitions.vsDailyThreshold }),
    rule("vs_weekly_threshold", "VS weekly threshold", "vs_weekly", "threshold", state.achievementDefinitions.vsWeeklyThreshold > 0, { minimum: state.achievementDefinitions.vsWeeklyThreshold })
  ];
  addAudit(state, actor, { action: "achievement_definitions_updated", recordType: "achievementDefinition", recordId: "global", after: { ...state.achievementDefinitions, updatedBy: actor.uid } });
  await saveState();
  return state.achievementDefinitions;
}

export async function deleteJournalItem(itemId, actor) {
  const state = await getState();
  const journal = state.userJournals[actor.uid] ||= [];
  const index = journal.findIndex((item) => item.id === itemId);
  if (index < 0) throw statusError(404, "Journal entry was not found");
  journal.splice(index, 1);
  for (const goal of state.userGoals?.[actor.uid] || []) {
    if (goal.relatedJournalId === itemId) goal.relatedJournalId = "";
  }
  await saveState();
  return { deleted: true };
}

export async function scheduleLeadershipMeeting(input, actor) {
  const state = await getState();
  const category = ["strategy", "weekly", "other"].includes(input.category) ? input.category : "";
  if (!category) throw statusError(422, "Choose a valid leadership meeting");
  const date = String(input.date || "");
  const time = String(input.time || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    throw statusError(422, "Choose a valid meeting date and time");
  }
  state.leadership.meetings ||= {};
  const existing = state.leadership.meetings[category];
  state.leadership.meetings[category] = {
    id: existing?.id || newId("leadership-meeting"),
    category,
    date,
    time,
    durationMinutes: 20,
    agenda: String(input.agenda || "").trim().slice(0, 1200),
    scheduledBy: actor.uid,
    updatedAt: now()
  };
  await saveState();
  return state.leadership.meetings[category];
}

export async function addLeadershipPost(input, actor) {
  const state = await getState();
  const category = ["roles", "strategy", "improvements", "weekly"].includes(input.category) ? input.category : "";
  if (!category) throw statusError(422, "Choose a valid leadership category");
  const text = String(input.text || "").trim().slice(0, 2000);
  if (!text) throw statusError(422, "Enter a leadership note or message");
  const post = {
    id: newId("leadership-post"),
    category,
    playerId: actor.playerId || "",
    userId: actor.uid,
    text,
    createdAt: now()
  };
  state.leadership.posts ||= [];
  state.leadership.posts.push(post);
  state.leadership.posts = state.leadership.posts.slice(-2000);
  await saveState();
  return post;
}

export async function requestLeadershipMeeting(input, actor) {
  const state = await getState();
  const category = ["roles", "strategy", "improvements", "weekly"].includes(input.category) ? input.category : "";
  if (!category) throw statusError(422, "Choose a valid leadership category");
  const recipientUid = String(input.recipientUid || "all");
  if (recipientUid !== "all") {
    const recipient = state.users[recipientUid];
    if (!recipient?.active || !["officer", "administrator"].includes(recipient.role)) {
      throw statusError(422, "Choose a valid officer or administrator");
    }
  }
  const topic = String(input.topic || "").trim().slice(0, 500);
  if (!topic) throw statusError(422, "Enter a reason or topic for the meeting request");
  state.leadership.requests ||= [];
  const request = {
    id: newId("meeting-request"),
    category,
    recipientUid,
    requestedBy: actor.uid,
    topic,
    createdAt: now()
  };
  state.leadership.requests.unshift(request);
  state.leadership.requests = state.leadership.requests.slice(0, 1000);
  await saveState();
  return request;
}

export async function deleteLeadershipPost(postId, actor) {
  const state = await getState();
  const index = (state.leadership.posts || []).findIndex((post) => post.id === postId);
  if (index < 0) throw statusError(404, "Leadership entry was not found");
  const post = state.leadership.posts[index];
  if (post.userId !== actor.uid && actor.role !== "administrator") {
    throw statusError(403, "Only the author or an administrator can delete this entry");
  }
  state.leadership.posts.splice(index, 1);
  await saveState();
  return { deleted: true };
}

function publicLeadership(state, viewer) {
  return {
    meetings: state.leadership.meetings || {},
    posts: (state.leadership.posts || []).map((post) => ({
      ...post,
      playerName: state.players[post.playerId]?.gameName || state.users[post.userId]?.displayName || "Leader",
      profileImage: state.players[post.playerId]?.profileImage || ""
    })),
    requests: (state.leadership.requests || [])
      .filter((request) => request.recipientUid === "all" || request.recipientUid === viewer.uid || request.requestedBy === viewer.uid)
      .map((request) => ({
        ...request,
        requestedByName: state.users[request.requestedBy]?.playerId
          ? state.players[state.users[request.requestedBy].playerId]?.gameName
          : state.users[request.requestedBy]?.displayName || "Leader",
        recipientName: request.recipientUid === "all"
          ? "All officers and administrators"
          : state.users[request.recipientUid]?.playerId
            ? state.players[state.users[request.recipientUid].playerId]?.gameName
            : state.users[request.recipientUid]?.displayName || "Leader"
      }))
  };
}

function announcementAuthorName(state, announcement) {
  const account = state.users[announcement.createdBy];
  const playerName = account?.playerId ? state.players[account.playerId]?.gameName : "";
  return playerName || account?.displayName || "EWAR Officer";
}

function publicPrivateMessage(state, message, viewer) {
  const sender = state.users[message.senderUid];
  const recipient = state.users[message.recipientUid];
  const senderPlayer = sender?.playerId ? state.players[sender.playerId] : null;
  const recipientPlayer = recipient?.playerId ? state.players[recipient.playerId] : null;
  return {
    ...message,
    direction: message.senderUid === viewer.uid ? "sent" : "received",
    senderName: senderPlayer?.gameName || sender?.displayName || "Alliance member",
    senderRole: sender?.role || "member",
    recipientName: recipientPlayer?.gameName || recipient?.displayName || "Alliance member"
  };
}

function localDateKey() {
  return new Date().toLocaleDateString("en-CA");
}

export async function createAllianceWeeklyEvent(input, actor) {
  const state = await getState();
  const event = normalizeAllianceWeeklyEvent({
    ...input,
    id: newId("alliance-event"),
    createdBy: actor.uid,
    createdAt: now(),
    updatedAt: now()
  });
  if (!["MG", "ZS", "Shark", "Blimp", "Shark Blimp", "Other"].includes(event.name)) throw statusError(422, "Choose a supported alliance event");
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(event.time)) throw statusError(422, "Choose a valid 24-hour time");
  state.allianceWeeklyEvents[event.id] = event;
  await saveState();
  return event;
}

export async function deleteAllianceWeeklyEvent(eventId) {
  const state = await getState();
  if (!state.allianceWeeklyEvents[eventId]) throw statusError(404, "Alliance event was not found");
  delete state.allianceWeeklyEvents[eventId];
  await saveState();
  return { deleted: true };
}

export async function updateAllianceWeeklyEvent(eventId, patch, actor) {
  const state = await getState();
  const event = state.allianceWeeklyEvents[eventId];
  if (!event) throw statusError(404, "Alliance event was not found");
  const before = structuredClone(event);
  const next = { ...event };
  for (const field of ["name", "date", "time", "overview"]) {
    if (Object.hasOwn(patch, field)) next[field] = String(patch[field]).trim();
  }
  if (!["MG", "ZS", "Shark", "Blimp", "Shark Blimp", "Other"].includes(next.name)) throw statusError(422, "Choose a supported alliance event");
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(next.time)) throw statusError(422, "Choose a valid 24-hour time");
  if (!next.date) throw statusError(422, "Choose an event date");
  Object.assign(event, next);
  event.updatedAt = now();
  addAudit(state, actor, { action: "alliance_event_updated", recordType: "allianceWeeklyEvent", recordId: eventId, before, after: event });
  await saveState();
  return event;
}

export async function createThemeWeek(input, actor) {
  const state = await getState();
  const theme = normalizeThemeWeek({
    ...input,
    id: newId("theme"),
    createdBy: actor.uid,
    createdAt: now(),
    updatedAt: now()
  });
  state.themeWeeks[theme.id] = theme;
  await saveState();
  return theme;
}

export async function updateThemeWeek(themeId, patch, actor) {
  const state = await getState();
  const theme = state.themeWeeks[themeId];
  if (!theme) throw statusError(404, "Theme week was not found");
  const next = { ...theme };
  for (const field of ["title", "weekOf", "description", "rules", "status"]) {
    if (Object.hasOwn(patch, field)) next[field] = String(patch[field]);
  }
  if (!next.title.trim()) throw statusError(422, "Enter a theme title");
  if (!next.weekOf) throw statusError(422, "Choose the theme week date");
  if (!["open", "finalists", "voting", "finalized", "archived"].includes(next.status)) throw statusError(422, "Choose a valid theme status");
  if (Object.hasOwn(patch, "status") && patch.status !== theme.status) {
    const allowedNext = { open: ["finalists"], finalists: ["open", "voting"], voting: ["finalized"], finalized: ["archived"], archived: [] };
    if (!allowedNext[theme.status]?.includes(patch.status)) throw statusError(409, `Theme Week cannot move from ${theme.status} to ${patch.status}`);
  }
  if (next.status === "voting" && !(theme.finalistIds || []).length) throw statusError(409, "Select finalists before opening voting");
  if (next.status === "finalized" && !Object.keys(theme.votes || {}).length) throw statusError(409, "At least one member vote is required before finalizing");
  Object.assign(theme, next);
  if (Object.hasOwn(patch, "finalistIds")) {
    if (theme.status !== "finalists") throw statusError(409, "Finalists can only be selected during the finalist stage");
    theme.finalistIds = [...new Set(patch.finalistIds)].filter((id) => theme.submissions[id]);
  }
  theme.updatedAt = now();
  addAudit(state, actor, { action: "theme_week_updated", recordType: "themeWeek", recordId: themeId, after: patch });
  await saveState();
  return theme;
}

export async function submitThemeEntry(themeId, input, actor) {
  const state = await getState();
  const theme = state.themeWeeks[themeId];
  if (!theme || theme.status !== "open") throw statusError(409, "This theme week is not accepting submissions");
  if (!actor.playerId || !state.players[actor.playerId]) throw statusError(422, "Confirm your roster profile before submitting");
  const image = validateThemeImage(input.image || theme.submissions[actor.playerId]?.image);
  theme.submissions[actor.playerId] = {
    playerId: actor.playerId,
    text: String(input.text || "").slice(0, 4000),
    image,
    submittedAt: now(),
    updatedAt: now()
  };
  theme.updatedAt = now();
  await saveState();
  return theme.submissions[actor.playerId];
}

export async function submitThemeEntryForPlayer(themeId, input, actor) {
  const state = await getState();
  const theme = state.themeWeeks[themeId];
  if (!theme || theme.status !== "open") throw statusError(409, "This theme week is not accepting submissions");
  const playerId = String(input.playerId || "");
  if (!state.players[playerId]?.active) throw statusError(422, "Choose an active Master Roster member");
  const image = validateThemeImage(input.image || theme.submissions[playerId]?.image);
  theme.submissions[playerId] = {
    playerId,
    text: String(input.text || "").trim().slice(0, 4000),
    image,
    submittedAt: theme.submissions[playerId]?.submittedAt || now(),
    updatedAt: now(),
    submittedByOfficer: actor.uid
  };
  theme.updatedAt = now();
  if (next.status === "finalized" && theme.status === "finalized") {
    const counts = Object.values(theme.votes || {}).reduce((result, playerId) => {
      result[playerId] = (result[playerId] || 0) + 1;
      return result;
    }, {});
    const ranking = (theme.finalistIds || []).map((playerId) => ({ playerId, value: counts[playerId] || 0 }))
      .sort((a, b) => b.value - a.value);
    for (const submission of Object.values(theme.submissions || {})) {
      const account = Object.values(state.users || {}).find((user) => user.playerId === submission.playerId);
      const priorAchievements = account ? state.userAchievements?.[account.uid] || [] : [];
      const currentPlacement = ranking.findIndex((record) => record.playerId === submission.playerId) + 1;
      const priorPlacements = priorAchievements
        .filter((item) => item.eventType === "theme_week" && item.placement)
        .map((item) => Number(item.placement));
      if (!priorAchievements.some((item) => item.eventType === "theme_week")) {
        awardAchievement(state, submission.playerId, {
          key: "theme_week_first_submission", eventId: theme.id, eventType: "theme_week", periodId: theme.weekOf,
          title: "First Theme Week submission", message: `You completed your first published Theme Week entry in ${theme.title}.`
        });
      }
      if (currentPlacement === 1 && priorPlacements[0] === 1) {
        awardAchievement(state, submission.playerId, {
          key: "theme_week_winning_streak", eventId: theme.id, eventType: "theme_week", periodId: theme.weekOf,
          placement: 1, title: "Theme Week winning streak", message: `You earned another first-place finish in ${theme.title}.`
        });
      }
      if (currentPlacement > 0 && priorPlacements.length && currentPlacement < Math.min(...priorPlacements)) {
        awardAchievement(state, submission.playerId, {
          key: "theme_week_improved_placement", eventId: theme.id, eventType: "theme_week", periodId: theme.weekOf,
          placement: currentPlacement, value: Math.min(...priorPlacements) - currentPlacement,
          title: "Most improved Theme Week placement", message: `You improved to placement ${currentPlacement} in ${theme.title}.`
        });
      }
    }
    if (state.achievementDefinitions?.topThreeEnabled !== false) awardTopThree(state, ranking, {
      type: "theme_week", label: "Theme Week", eventId: theme.id, periodId: theme.weekOf,
      message: (record, placement) => `Your submission placed ${placement} in ${theme.title} with ${record.value} vote${record.value === 1 ? "" : "s"}.`
    });
    for (const submission of Object.values(theme.submissions || {})) {
      awardAchievement(state, submission.playerId, {
        key: "theme_week_participant", eventId: theme.id, eventType: "theme_week", periodId: theme.weekOf,
        title: "Theme Week participant", message: `You submitted an entry for ${theme.title}.`
      });
    }
  }
  await saveState();
  return theme.submissions[playerId];
}

function validateThemeImage(value) {
  const image = String(value || "");
  if (!image) throw statusError(422, "Attach a profile-picture submission");
  if (image.length > 750000) throw statusError(422, "Theme submission image is too large");
  if (!/^data:image\/(jpeg|png|webp|gif);base64,/.test(image)) throw statusError(422, "Choose a JPG, PNG, WebP, or GIF submission");
  return image;
}

export async function voteThemeWeek(themeId, finalistId, actor) {
  const state = await getState();
  const theme = state.themeWeeks[themeId];
  if (!theme || theme.status !== "voting") throw statusError(409, "Voting is not open");
  if (!actor.playerId) throw statusError(422, "Confirm your roster profile before voting");
  if (!theme.finalistIds.includes(finalistId)) throw statusError(422, "Choose a listed finalist");
  if (theme.votes[actor.playerId]) throw statusError(409, "You have already used your one vote for this Theme Week");
  theme.votes[actor.playerId] = finalistId;
  theme.updatedAt = now();
  await saveState();
  return { finalistId };
}

export async function commentThemeWeek(themeId, text, actor) {
  const state = await getState();
  const theme = state.themeWeeks[themeId];
  if (!theme || theme.status === "archived") throw statusError(409, "This theme-week discussion is archived");
  if (!actor.playerId) throw statusError(422, "Confirm your roster profile before commenting");
  theme.comments.push({ id: newId("comment"), playerId: actor.playerId, text: String(text || "").trim().slice(0, 500), createdAt: now() });
  theme.updatedAt = now();
  await saveState();
  return theme.comments.at(-1);
}

export async function acknowledgeThemeWeek(themeId, actor) {
  const state = await getState();
  const theme = state.themeWeeks[themeId];
  if (!theme) throw statusError(404, "Theme week was not found");
  if (!actor.playerId) throw statusError(422, "Confirm your roster profile before acknowledging");
  theme.acknowledgements[actor.playerId] = now();
  await saveState();
  return { acknowledgedAt: theme.acknowledgements[actor.playerId] };
}

export async function deleteThemeWeek(themeId) {
  const state = await getState();
  if (!state.themeWeeks[themeId]) throw statusError(404, "Theme week was not found");
  delete state.themeWeeks[themeId];
  await saveState();
  return { deleted: true };
}

export async function getOrCreateUser(firebaseUser) {
  const state = await getState();
  const shouldRestoreAdministrator = isRecoveryAdministrator(firebaseUser);
  const restoredIdentity = restoreAdministratorIdentity(state, firebaseUser);
  let user = restoredIdentity.user;
  if (!user) {
    const configuredAdmins = String(process.env.DSCC_ADMIN_UIDS || "").split(",").map((value) => value.trim()).filter(Boolean);
    user = {
      uid: firebaseUser.localId,
      email: firebaseUser.email || "",
      displayName: firebaseUser.displayName || firebaseUser.email || "Member",
      role: configuredAdmins.includes(firebaseUser.localId) || shouldRestoreAdministrator ? "administrator" : "member",
      applicationRole: configuredAdmins.includes(firebaseUser.localId) || shouldRestoreAdministrator ? "administrator" : "member",
      accountStatus: configuredAdmins.includes(firebaseUser.localId) || shouldRestoreAdministrator ? "active" : "pending",
      officerPermissions: configuredAdmins.includes(firebaseUser.localId) || shouldRestoreAdministrator ? ["*"] : [],
      playerId: null,
      profileConfirmedAt: null,
      profileSelection: null,
      accountPhotoUrl: firebaseUser.photoUrl || "",
      profileTitle: "Alliance Member",
      profileBio: "",
      profileSetupCompletedAt: null,
      active: configuredAdmins.includes(firebaseUser.localId) || shouldRestoreAdministrator,
      createdAt: now(),
      lastLoginAt: now(),
      version: 1
    };
    state.users[user.uid] = user;
    await saveState();
  } else {
    let restoredAdministrator = restoredIdentity.changed;
    if (shouldRestoreAdministrator && (user.role !== "administrator" || !user.active)) {
      user.role = "administrator";
      user.applicationRole = "administrator";
      user.accountStatus = "active";
      user.officerPermissions = ["*"];
      user.active = true;
      user.version = Number(user.version || 0) + 1;
      restoredAdministrator = true;
    }
    if (firebaseUser.email) user.email = firebaseUser.email;
    user.lastLoginAt = now();
    if (firebaseUser.photoUrl) user.accountPhotoUrl = firebaseUser.photoUrl;
    if (restoredAdministrator) await saveState();
  }
  return user;
}

export async function listManagedEvents(user, filters = {}) {
  const state = await getState();
  return Object.values(state.managedEvents || {})
    .filter((event) => user.role !== "member" || (event.visibility === "members" && event.status !== "draft" && event.status !== "cancelled"))
    .filter((event) => !filters.type || event.type === filters.type)
    .filter((event) => !filters.status || event.status === filters.status)
    .sort((a, b) => String(b.startDate || b.createdAt).localeCompare(String(a.startDate || a.createdAt)));
}

export async function getManagedEvent(eventId, user) {
  const state = await getState();
  const event = state.managedEvents?.[eventId];
  if (!event || (user.role === "member" && (event.status === "draft" || event.visibility !== "members"))) throw statusError(404, "Event was not found");
  return event;
}

export async function createManagedEvent(input, actor, idempotencyKey = "") {
  const state = await getState();
  if (!MANAGED_EVENT_TYPES.includes(input.type)) throw validationError({ type: "Choose a supported event type." });
  const key = String(idempotencyKey || input.idempotencyKey || "").slice(0, 160);
  if (key && state.eventIdempotency?.[actor.uid]?.[key]) return state.managedEvents[state.eventIdempotency[actor.uid][key]];
  rejectProtectedEventFields(input);
  const timestamp = now();
  const event = normalizeManagedEvent({
    ...input, id: newId("evt"), status: "draft", active: false,
    createdBy: actor.uid, createdByName: actor.displayName || "", createdAt: timestamp,
    updatedBy: actor.uid, updatedByName: actor.displayName || "", updatedAt: timestamp,
    publishedBy: null, publishedAt: null, version: 1
  });
  validateManagedEvent(event, false);
  state.managedEvents[event.id] = event;
  if (key) {
    state.eventIdempotency[actor.uid] ||= {};
    state.eventIdempotency[actor.uid][key] = event.id;
  }
  addAudit(state, actor, { eventId: event.id, action: "event.created", recordType: "event", recordId: event.id, after: event });
  if (input.action === "publish") return transitionManagedEvent(event.id, "publish", actor, { expectedVersion: event.version });
  await saveState();
  return event;
}

export async function updateManagedEvent(eventId, input, actor) {
  const state = await getState();
  const event = state.managedEvents?.[eventId];
  if (!event) throw statusError(404, "Event was not found");
  const expectedVersion = Number(input.expectedVersion ?? input.version);
  if (!Number.isFinite(expectedVersion) || expectedVersion !== event.version) throw Object.assign(statusError(409, "The event changed in another session."), { latest: event });
  const patch = input.patch && typeof input.patch === "object" ? input.patch : input;
  rejectProtectedEventFields(patch);
  const allowed = ["title", "visibility", "startDate", "endDate", "serverTime", "timezone", "summary", "description", "details"];
  const candidate = normalizeManagedEvent({ ...event, ...Object.fromEntries(allowed.filter((key) => Object.hasOwn(patch, key)).map((key) => [key, patch[key]])) });
  validateManagedEvent(candidate, event.status !== "draft");
  Object.assign(event, candidate, { updatedAt: now(), updatedBy: actor.uid, updatedByName: actor.displayName || "", version: event.version + 1 });
  addAudit(state, actor, { eventId, action: "event.edited", recordType: "event", recordId: eventId });
  await saveState();
  return event;
}

export async function transitionManagedEvent(eventId, action, actor, input = {}) {
  const state = await getState();
  const event = state.managedEvents?.[eventId];
  if (!event) throw statusError(404, "Event was not found");
  if (input.expectedVersion !== undefined && Number(input.expectedVersion) !== event.version) throw Object.assign(statusError(409, "The event changed in another session."), { latest: event });
  const transitions = { publish: ["draft", "scheduled"], activate: ["scheduled"], complete: ["active"], archive: ["completed"], cancel: ["draft", "scheduled", "active"] };
  if (!transitions[action]?.includes(event.status)) {
    if ((action === "publish" && ["scheduled", "active"].includes(event.status)) || (action === "activate" && event.status === "active")) return event;
    throw statusError(409, `A ${event.status} event cannot be ${action}d.`);
  }
  if (action === "publish") validateManagedEvent(event, true);
  if (action === "activate") {
    const conflictingId = state.activeEventsByType[event.type];
    if (conflictingId && conflictingId !== eventId) throw Object.assign(statusError(409, `Another ${event.type} event is active.`), { latest: state.managedEvents[conflictingId] });
  }
  const timestamp = now();
  const next = { publish: "scheduled", activate: "active", complete: "completed", archive: "archived", cancel: "cancelled" }[action];
  event.status = next; event.active = next === "active"; event.updatedAt = timestamp; event.updatedBy = actor.uid; event.version += 1;
  if (action === "publish") {
    event.publishedAt ||= timestamp; event.publishedBy ||= actor.uid;
    if (event.type === "desertStorm") publishMapSnapshot(state, event, actor);
    upsertEventBriefings(state, event);
  }
  if (action === "activate") state.activeEventsByType[event.type] = eventId;
  if (["complete", "archive", "cancel"].includes(action) && state.activeEventsByType[event.type] === eventId) delete state.activeEventsByType[event.type];
  if (action === "complete") event.closedAt = timestamp;
  if (action === "archive") event.archivedAt = timestamp;
  if (action === "cancel") event.cancelledAt = timestamp;
  addAudit(state, actor, { eventId, action: `event.${action}`, recordType: "event", recordId: eventId, after: next });
  await saveState();
  return event;
}

export async function deleteManagedEvent(eventId, actor) {
  const state = await getState();
  const event = state.managedEvents?.[eventId];
  if (!event) throw statusError(404, "Event was not found");
  if (actor.role !== "administrator") throw statusError(403, "Only an administrator can permanently delete events.");
  if (event.status !== "draft") throw statusError(409, "Only drafts or test records can be permanently deleted.");
  delete state.managedEvents[eventId]; delete state.eventBriefings[eventId];
  addAudit(state, actor, { eventId, action: "event.deleted", recordType: "event", recordId: eventId, before: event });
  await saveState(); return event;
}

function rejectProtectedEventFields(input) {
  const protectedFields = ["id", "status", "active", "createdBy", "createdAt", "updatedBy", "updatedAt", "publishedBy", "publishedAt", "closedAt", "archivedAt", "cancelledAt", "version", "role", "permissions"];
  const supplied = protectedFields.filter((field) => Object.hasOwn(input, field));
  if (supplied.length) throw validationError(Object.fromEntries(supplied.map((field) => [field, "This field is controlled by the server."])));
}

function validateManagedEvent(event, publishing) {
  const fields = {};
  if (!event.title || event.title.length > 160) fields.title = "Enter an event title (160 characters maximum).";
  if (event.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(event.startDate)) fields.startDate = "Use a valid YYYY-MM-DD date.";
  if (publishing && !event.startDate) fields.startDate = "An event date is required before publishing.";
  const d = event.details || {};
  if (publishing && event.type === "desertStorm") {
    if (!d.teamA?.serverTime) fields["details.teamA.serverTime"] = "Team A time is required.";
    if (!d.teamA?.strategyId) fields["details.teamA.strategyId"] = "Team A strategy is required.";
    if (!d.teamB?.serverTime) fields["details.teamB.serverTime"] = "Team B time is required.";
    if (!d.teamB?.strategyId) fields["details.teamB.strategyId"] = "Team B strategy is required.";
  }
  if (publishing && event.type === "themeWeek" && (!d.rules || !event.description)) fields["details.rules"] = "Description and rules are required.";
  if (publishing && event.type === "allianceEvent" && (!d.category || !d.serverTime || !event.summary)) fields.details = "Category, server time, and overview are required.";
  if (publishing && event.type === "vsWeek" && (!d.duelLeagueCode || !d.duelLeagueWeek || !d.opponent || !d.opponentServer || !d.opponentMembers)) fields.details = "Complete all VS week fields before publishing.";
  if (Object.keys(fields).length) throw validationError(fields);
}

function validationError(fields) {
  return Object.assign(statusError(422, "The event could not be saved."), { details: { error: "VALIDATION_FAILED", message: "The event could not be saved.", fields } });
}

function upsertEventBriefings(state, event) {
  state.eventBriefings[event.id] ||= {};
  for (const user of Object.values(state.users)) {
    if (!user.active || user.status === "pending") continue;
    const prior = state.eventBriefings[event.id][user.uid];
    state.eventBriefings[event.id][user.uid] = { id: `${event.id}:${user.uid}`, eventId: event.id, memberUid: user.uid, eventVersion: event.version + 1, updated: Boolean(prior), updatedAt: now() };
  }
}

export async function listEvents(user) {
  return (await getClientState(user)).events;
}

export async function getEventBundle(eventId, user) {
  const state = await getState();
  const event = state.events[eventId];
  if (!event || (user.role === "member" && event.status === "draft")) throw statusError(404, "Event was not found");
  return {
    event,
    participants: Object.values(state.eventParticipants[eventId] || {}).map((participant) => publicParticipant(participant, user)),
    strategy: state.eventStrategies[eventId] || {},
    validation: validateEventForPublish(event, Object.values(state.eventParticipants[eventId] || {}))
  };
}

export async function addEvent(input, actor) {
  const state = await getState();
  const event = createEvent(state, input, actor);
  addAudit(state, actor, { eventId: event.id, action: "event_created", recordType: "event", recordId: event.id, after: event });
  await saveState();
  return event;
}

export async function duplicateEvent(eventId, input, actor) {
  const state = await getState();
  if (!state.events[eventId]) throw statusError(404, "Event was not found");
  const event = createEvent(state, input, actor, eventId);
  addAudit(state, actor, { eventId: event.id, action: "event_duplicated", recordType: "event", recordId: event.id, before: eventId, after: event.id });
  await saveState();
  return event;
}

export async function deleteDraftEvent(eventId, actor) {
  const state = await getState();
  const event = state.events[eventId];
  if (!event) throw statusError(404, "Draft event was not found");
  if (event.status !== "draft") throw statusError(409, "Only draft battle plans can be deleted");
  delete state.events[eventId];
  delete state.eventParticipants[eventId];
  delete state.eventStrategies[eventId];
  delete state.strategyVersions[eventId];
  delete state.auditLogs[eventId];
  if (state.activeEventId === eventId) state.activeEventId = null;
  addAudit(state, actor, { action: "event_draft_deleted", recordType: "event", recordId: eventId, before: event });
  await saveState();
  return event;
}

export async function updateEvent(eventId, patch, actor) {
  const state = await getState();
  const event = state.events[eventId];
  if (!event) throw statusError(404, "Event was not found");
  assertVersion(event, patch.version);
  const allowed = [
    "date", "opponent", "strategyA", "strategyB", "battleTimeA", "battleTimeB",
    "scoreFor", "scoreAgainst", "outcome", "notes", "importantInstructions", "debrief", "setupPublishedAt"
  ];
  const before = structuredClone(event);
  for (const field of allowed) if (Object.hasOwn(patch, field)) event[field] = patch[field];
  const scheduleChanged = ["date", "battleTimeA", "battleTimeB"].some((field) =>
    Object.hasOwn(patch, field) && String(before[field] || "") !== String(event[field] || "")
  );
  if (scheduleChanged && event.status !== "draft") {
    event.scheduleChange = {
      previousDate: before.date,
      previousBattleTimeA: before.battleTimeA,
      previousBattleTimeB: before.battleTimeB,
      changedAt: now(),
      changedBy: actor.uid
    };
    for (const participant of Object.values(state.eventParticipants[eventId] || {})) {
      if (!participant.selected) continue;
      participant.availability = "Pending";
      participant.availabilityNote = "";
      participant.updatedAt = now();
      participant.updatedBy = actor.uid;
      participant.version = Number(participant.version || 1) + 1;
    }
  }
  event.scoreFor = Number(event.scoreFor || 0);
  event.scoreAgainst = Number(event.scoreAgainst || 0);
  event.updatedAt = now();
  event.updatedBy = actor.uid;
  event.version += 1;
  auditDiff(state, actor, eventId, "event", eventId, before, event, "event_updated");
  await saveState();
  return event;
}

export async function changeEventStatus(eventId, action, actor, reason = "") {
  const state = await getState();
  const before = structuredClone(state.events[eventId]);
  const event = transitionEvent(state, eventId, action, actor, reason);
  if (action === "archive") captureHistoricalEventSnapshots(state, eventId);
  if (action === "archive") updateParticipationGoals(state);
  addAudit(state, actor, {
    eventId, action: `event_${action}ed`, recordType: "event", recordId: eventId,
    before: before?.status, after: event.status, reason
  });
  await saveState();
  return event;
}

export async function updateEventParticipant(eventId, playerId, patch, actor, selfOnly = false) {
  const state = await getState();
  const participant = state.eventParticipants[eventId]?.[playerId];
  if (!participant) throw statusError(404, "Event participant was not found");
  if (!selfOnly && !state.events[eventId]?.setupPublishedAt) throw statusError(409, "Publish Team A/B times and strategies in Create before editing the weekly roster");
  assertVersion(participant, patch.version);
  const ownFields = ["availability", "availabilityNote"];
  const officerFields = [
    "selected", "team", "rosterStatus", "availability", "availabilityNote",
    "availabilityOverride", "role", "unit", "tacticalGroup", "unitLeader", "mapPosition", "primaryAssignment",
    "backupAssignment", "primaryUnit", "rotationUnit", "openingObjective",
    "midBattleObjective", "finalObjective", "attendance", "score", "notes", "officerNotes"
  ];
  const before = structuredClone(participant);
  const fields = selfOnly ? ownFields : officerFields;
  for (const field of fields) if (Object.hasOwn(patch, field)) participant[field] = patch[field];
  if (!selfOnly) {
    const player = state.players[playerId];
    const defaultFields = {
      selected: "defaultSelected",
      team: "defaultTeam",
      rosterStatus: "defaultRole",
      unit: "defaultUnit",
      tacticalGroup: "defaultTacticalGroup"
    };
    if (player) {
      for (const [participantField, playerField] of Object.entries(defaultFields)) {
        if (Object.hasOwn(patch, participantField)) player[playerField] = participant[participantField];
      }
      player.updatedAt = now();
      player.version += 1;
    }
  }
  if (Object.hasOwn(patch, "tacticalGroup") || Object.hasOwn(patch, "team")) {
    const strategy = state.eventStrategies[eventId]?.[participant.team];
    const opening = [...(strategy?.phases || [])].sort((left, right) => Number(left.startMinute) - Number(right.startMinute))[0];
    const order = opening?.groupOrders?.[participant.tacticalGroup];
    if (order) {
      participant.unit = order.primaryObjective || "Unassigned";
      participant.primaryUnit = order.primaryObjective || "";
      participant.rotationUnit = order.secondaryObjective || "";
      participant.primaryAssignment = order.primaryAction || "";
      participant.backupAssignment = order.secondaryAction || "";
      participant.openingObjective = order.primaryObjective || "";
      if (state.players[playerId]) state.players[playerId].defaultUnit = participant.unit;
    }
  }
  if (Object.hasOwn(patch, "score")) participant.score = Number(patch.score || 0);
  if (Object.hasOwn(patch, "availability")) {
    participant.confirmedAt = patch.availability === "Confirmed" ? now() : null;
  }
  if (Object.hasOwn(patch, "availabilityNote") && state.players[playerId]) {
    state.players[playerId].availabilityGuidance = String(participant.availabilityNote || "").slice(0, 180);
    state.players[playerId].updatedAt = now();
  }
  participant.updatedAt = now();
  participant.updatedBy = actor.uid;
  participant.version += 1;
  auditDiff(state, actor, eventId, "participant", playerId, before, participant, selfOnly ? "availability_changed" : "participant_updated");
  await saveState();
  return publicParticipant(participant, actor);
}

export async function listPlayers(user) {
  const players = Object.values((await getState()).players);
  return user?.role === "member" ? players.map(publicPlayer) : players;
}

export async function listUsers() {
  return Object.values((await getState()).users);
}

export const OFFICER_PERMISSIONS = ["manageRoster", "manageEvents", "manageStrategies", "manageMap", "manageVsScores", "manageBriefings", "viewAdministration", "manageAccountAccess", "manageOfficerPermissions"];

export async function listAdminAccounts() {
  const state = await getState();
  return Object.values(state.users).map((user) => adminAccountProjection(state, user));
}

export async function getAdminAccount(userId) {
  const state = await getState();
  const user = state.users[userId];
  if (!user) throw statusError(404, "Account was not found");
  return adminAccountProjection(state, user);
}

export async function updateAdminAccount(userId, input, actor) {
  const state = await getState();
  const user = state.users[userId];
  if (!user) throw statusError(404, "Account was not found");
  if (actor.role !== "administrator") throw statusError(403, "Administrator access is required");
  if (Number(input.expectedVersion) !== Number(user.version)) throw Object.assign(statusError(409, "The account changed in another session"), { latest: adminAccountProjection(state, user) });
  const before = structuredClone(user);
  const nextRole = input.applicationRole ?? input.role;
  const nextStatus = input.accountStatus;
  const nextPlayerId = input.playerId === undefined ? user.playerId : (input.playerId || null);
  if (nextRole !== undefined && !["member", "officer", "administrator"].includes(nextRole)) throw statusError(422, "Choose a valid application role");
  if (nextStatus !== undefined && !["pending", "active", "suspended", "revoked"].includes(nextStatus)) throw statusError(422, "Choose a valid account status");
  if (nextPlayerId && !state.players[nextPlayerId]) throw statusError(404, "Roster member was not found");
  if (nextPlayerId && Object.values(state.users).some((item) => item.uid !== userId && item.playerId === nextPlayerId)) throw statusError(409, "That roster member is already linked to another account");
  const removesAdmin = user.role === "administrator" && ((nextRole && nextRole !== "administrator") || ["suspended", "revoked"].includes(nextStatus));
  const activeAdmins = Object.values(state.users).filter((item) => item.role === "administrator" && item.active && item.accountStatus !== "revoked");
  if (removesAdmin && activeAdmins.length <= 1) throw statusError(409, "The final active administrator cannot be removed");
  if (isRecoveryAdministrator(user) && removesAdmin && input.confirmProtectedAdministrator !== true) throw statusError(409, "Protected administrator changes require explicit confirmation");
  if (isRecoveryAdministrator(user) && nextPlayerId !== user.playerId && input.confirmProtectedAdministrator !== true) throw statusError(409, "Protected administrator roster changes require explicit confirmation");
  if (user.role !== "administrator" && nextRole === "administrator" && input.confirmAdministratorPromotion !== true) throw statusError(409, "Administrator promotion requires explicit confirmation");
  if (nextPlayerId !== user.playerId) {
    if (user.playerId && state.players[user.playerId]?.userId === userId) state.players[user.playerId].userId = null;
    user.playerId = nextPlayerId;
    if (nextPlayerId) state.players[nextPlayerId].userId = userId;
  }
  if (nextRole !== undefined) { user.role = nextRole; user.applicationRole = nextRole; }
  if (Array.isArray(input.officerPermissions)) {
    const invalid = input.officerPermissions.filter((item) => !OFFICER_PERMISSIONS.includes(item));
    if (invalid.length) throw statusError(422, `Unsupported officer permission: ${invalid[0]}`);
    user.officerPermissions = user.role === "administrator" ? ["*"] : user.role === "officer" ? [...new Set(input.officerPermissions)] : [];
  } else if (nextRole === "member") user.officerPermissions = [];
  else if (nextRole === "administrator") user.officerPermissions = ["*"];
  if (nextStatus !== undefined) user.accountStatus = nextStatus;
  user.active = user.accountStatus === "active";
  if (nextPlayerId && user.accountStatus === "active") {
    const player = state.players[nextPlayerId];
    user.requestedPlayerId = null;
    user.profileConfirmedAt ||= now();
    user.profileSelection = { ...(user.profileSelection || {}), playerId: nextPlayerId, playerName: player.gameName, rank: player.rank, approvalStatus: "approved", approvedAt: now() };
  } else if (!nextPlayerId) {
    user.requestedPlayerId = null;
    user.profileConfirmedAt = null;
    user.profileSelection = user.profileSelection ? { ...user.profileSelection, approvalStatus: user.accountStatus === "revoked" ? "rejected" : "unlinked", reviewedAt: now() } : null;
  }
  if (Object.hasOwn(input, "administrativeNotes")) user.administrativeNotes = String(input.administrativeNotes || "").slice(0, 1000);
  user.reviewedBy = actor.uid; user.reviewedAt = now(); user.version += 1;
  addAudit(state, actor, { action: "account.permissions.updated", recordType: "user", recordId: userId, before: { role: before.role, permissions: before.officerPermissions, status: before.accountStatus, playerId: before.playerId }, after: { role: user.role, permissions: user.officerPermissions, status: user.accountStatus, playerId: user.playerId } });
  await saveState();
  return adminAccountProjection(state, user);
}

export async function reviewSignup(userId, action, input, actor) {
  const state = await getState();
  const user = state.users[userId];
  if (!user) throw statusError(404, "Signup was not found");
  const role = action === "approve-officer" ? "officer" : "member";
  return updateAdminAccount(userId, {
    expectedVersion: input.expectedVersion,
    applicationRole: role,
    officerPermissions: role === "officer" ? (input.officerPermissions || OFFICER_PERMISSIONS.slice(0, 6)) : [],
    accountStatus: action === "reject" ? "revoked" : "active",
    playerId: action === "reject" ? null : (input.playerId || user.requestedPlayerId),
    administrativeNotes: input.administrativeNotes
  }, actor);
}

function adminAccountProjection(state, user) {
  const player = user.playerId ? state.players[user.playerId] : user.requestedPlayerId ? state.players[user.requestedPlayerId] : null;
  return { ...user, applicationRole: user.role, accountStatus: user.accountStatus || (user.active ? "active" : "suspended"), officerPermissions: user.officerPermissions || [], linkStatus: user.playerId ? "linked" : user.requestedPlayerId ? "pending" : "unlinked", member: player ? { id: player.id, inGameName: player.gameName, profileImageUrl: player.profileImage || "", allianceRank: player.rank, memberStatus: player.active ? "active" : "inactive" } : null };
}

export async function listAvailablePlayerProfiles(userId) {
  const state = await getState();
  const requestedName = normalizePlayerName(state.users[userId]?.displayName || "");
  const linkedByPlayerId = new Map(Object.values(state.users)
    .filter((user) => user.playerId)
    .map((user) => [user.playerId, user.uid]));
  const activeParticipants = state.eventParticipants[state.activeEventId] || {};
  const profiles = Object.values(state.players)
    .filter((player) => player.active)
    .map((player) => {
      const participant = activeParticipants[player.id];
      const linkedUserId = linkedByPlayerId.get(player.id) || null;
      const knownNames = [player.gameName, ...(player.aliases || []), ...(player.previousPlayerNames || []).map((item) => item.name)];
      return {
        id: player.id,
        name: player.gameName,
        rank: player.rank,
        team: participant?.team || player.defaultTeam || "Reserve",
        unit: participant?.tacticalGroup || player.defaultTacticalGroup || "Reserve",
        profileImage: player.profileImage || "",
        linkStatus: linkedUserId === userId ? "current" : linkedUserId ? "linked" : "available",
        exactNameMatch: Boolean(requestedName && knownNames.some((name) => normalizePlayerName(name) === requestedName))
      };
    });
  const availableMatches = profiles.filter((item) => item.exactNameMatch && item.linkStatus !== "linked");
  return profiles.map((item) => ({
      ...item,
      matchStatus: item.exactNameMatch ? (availableMatches.length === 1 ? "suggested" : "needs_review") : "none"
    }))
    .sort((left, right) =>
      Number(right.matchStatus === "suggested") - Number(left.matchStatus === "suggested")
      || ["current", "available", "linked"].indexOf(left.linkStatus) - ["current", "available", "linked"].indexOf(right.linkStatus)
      || left.name.localeCompare(right.name)
    );
}

function captureHistoricalEventSnapshots(state, eventId) {
  for (const participant of Object.values(state.eventParticipants[eventId] || {})) {
    const player = state.players[participant.playerId];
    participant.historicalSnapshot ||= {
      playerNameAtEvent: player?.gameName || participant.playerName || "Alliance member",
      thpAtEvent: Number(player?.thp || 0),
      teamAtEvent: participant.team,
      roleAtEvent: participant.rosterStatus,
      capturedAt: now()
    };
  }
  state.eventMapSnapshots[eventId] ||= {};
  if (!Object.keys(state.eventMapSnapshots[eventId]).length) {
    state.eventMapSnapshots[eventId].legacy = structuredClone({
      ...buildEventMapPlan(state, eventId, { status: "archived", version: 1 }),
      publicationVersion: "legacy",
      publishedAt: state.events[eventId]?.publishedAt || now(),
      archivedAt: now()
    });
  }
}

export async function updateEventParticipantsBatch(eventId, assignments, actor) {
  const state = await getState();
  const event = state.events[eventId];
  if (!event) throw statusError(404, "Event was not found");
  if (!event.setupPublishedAt) throw statusError(409, "Publish Team A/B times and strategies before assigning the roster");
  if (!Array.isArray(assignments) || !assignments.length || assignments.length > 100) throw statusError(422, "Choose between 1 and 100 assignment changes");
  const allowed = new Set(["selected", "team", "rosterStatus", "availability", "role", "unit", "tacticalGroup", "unitLeader"]);
  const changed = [];
  for (const change of assignments) {
    const memberId = String(change.memberId || change.playerId || "");
    const player = state.players[memberId];
    const participant = state.eventParticipants[eventId]?.[memberId];
    if (!player || !participant) throw statusError(422, `Roster member ${memberId || "unknown"} is not available for this event`);
    if (!player.active && change.selected !== false) throw statusError(409, `${player.gameName} is inactive`);
    const before = structuredClone(participant);
    for (const [field, value] of Object.entries(change.patch || {})) if (allowed.has(field)) participant[field] = value;
    if (Object.hasOwn(change.patch || {}, "availability")) participant.confirmedAt = participant.availability === "Confirmed" ? now() : null;
    if (Object.hasOwn(change.patch || {}, "tacticalGroup") || Object.hasOwn(change.patch || {}, "team")) {
      const strategy = state.eventStrategies[eventId]?.[participant.team];
      const opening = [...(strategy?.phases || [])].sort((left, right) => Number(left.startMinute) - Number(right.startMinute))[0];
      const order = opening?.groupOrders?.[participant.tacticalGroup];
      if (order) {
        participant.unit = order.primaryObjective || "Unassigned";
        participant.primaryUnit = order.primaryObjective || "";
        participant.rotationUnit = order.secondaryObjective || "";
        participant.primaryAssignment = order.primaryAction || "";
        participant.backupAssignment = order.secondaryAction || "";
      }
    }
    participant.updatedAt = now();
    participant.updatedBy = actor.uid;
    participant.version = Number(participant.version || 1) + 1;
    for (const [participantField, playerField] of Object.entries({ selected: "defaultSelected", team: "defaultTeam", rosterStatus: "defaultRole", unit: "defaultUnit", tacticalGroup: "defaultTacticalGroup" })) {
      if (Object.hasOwn(change.patch || {}, participantField)) player[playerField] = participant[participantField];
    }
    player.updatedAt = now();
    player.version = Number(player.version || 1) + 1;
    auditDiff(state, actor, eventId, "participant", memberId, before, participant, "participant_batch_updated");
    changed.push(publicParticipant(participant, actor));
  }
  const selected = Object.values(state.eventParticipants[eventId] || {}).filter((item) => item.selected);
  const warnings = [];
  for (const team of ["A", "B"]) {
    const teamMembers = selected.filter((item) => item.team === team);
    const starters = teamMembers.filter((item) => item.rosterStatus === "Starter");
    const substitutes = teamMembers.filter((item) => item.rosterStatus === "Sub");
    if (teamMembers.length > 30) warnings.push(`Team ${team} exceeds 30 sign-ups`);
    if (starters.length > 20) warnings.push(`Team ${team} exceeds 20 starters`);
    if (substitutes.length > 10) warnings.push(`Team ${team} exceeds 10 substitutes`);
  }
  await saveState();
  return { changed, warnings };
}

export async function linkOwnPlayer(userId, playerId) {
  const state = await getState();
  const user = state.users[userId];
  const player = state.players[playerId];
  if (!user || !player) throw statusError(404, "Account or player profile was not found");
  if (user.playerId && user.playerId !== playerId) throw statusError(409, "An administrator must change an existing player link");
  if (Object.values(state.users).some((item) => item.uid !== userId && item.playerId === playerId)) {
    throw statusError(409, "That player is already linked to another account");
  }
  if (user.playerId === playerId && user.accountStatus === "active") return user;
  user.requestedPlayerId = playerId;
  user.profileConfirmedAt = null;
  const participant = state.eventParticipants[state.activeEventId]?.[playerId];
  user.profileSelection = {
    playerId,
    playerName: player.gameName,
    rank: player.rank,
    team: participant?.team || player.defaultTeam || "Reserve",
    unit: participant?.tacticalGroup || player.defaultTacticalGroup || "Reserve",
    requestedAt: now(),
    approvalStatus: "pending"
  };
  user.accountStatus = "pending";
  user.active = false;
  user.version += 1;
  addAudit(state, user, {
    action: "signup.profile.requested",
    recordType: "user",
    recordId: userId,
    after: user.profileSelection
  });
  await saveState();
  return user;
}

export async function updateOwnProfile(userId, patch) {
  const state = await getState();
  const user = state.users[userId];
  if (!user) throw statusError(404, "User account was not found");
  const player = user.playerId ? state.players[user.playerId] : null;
  if (!player) throw statusError(409, "Confirm a Master Directory profile before designing your account");
  if (Object.hasOwn(patch, "gameName")) {
    const nextName = String(patch.gameName || "").normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, 80);
    if (!nextName) throw statusError(422, "Enter your current in-game name");
    const normalized = normalizePlayerName(nextName);
    const conflict = Object.values(state.players).find((item) => item.id !== player.id && normalizePlayerName(item.gameName) === normalized);
    if (conflict) throw statusError(409, "That in-game name matches another roster record. Ask an officer to review the link.");
    if (nextName !== player.gameName) {
      player.previousPlayerNames ||= [];
      player.previousPlayerNames.push({ name: player.gameName, changedAt: now(), changedBy: userId, changeType: "member_update" });
      player.aliases = [...new Set([...(player.aliases || []), player.gameName])];
      player.gameName = nextName;
      user.displayName = nextName;
      if (user.profileSelection) user.profileSelection.playerName = nextName;
      for (const participants of Object.values(state.eventParticipants)) if (participants[player.id]) participants[player.id].playerName = nextName;
    }
  }
  if (Object.hasOwn(patch, "thp")) {
    const thp = Number(patch.thp);
    if (!Number.isFinite(thp) || thp < 0 || thp > 1_000_000_000_000_000) throw statusError(422, "Enter a valid THP value between 0 and 1 quadrillion");
    player.thp = Math.round(thp);
    player.thpUpdatedAt = now();
    player.thpUpdatedBy = userId;
    player.thpVerifiedAt = null;
    player.thpVerifiedBy = null;
  }
  if (Object.hasOwn(patch, "profileTitle")) user.profileTitle = String(patch.profileTitle || "").slice(0, 60);
  if (Object.hasOwn(patch, "profileBio")) user.profileBio = String(patch.profileBio || "").slice(0, 400);
  if (Object.hasOwn(patch, "profileImageFit")) {
    if (!["cover", "contain"].includes(patch.profileImageFit)) throw statusError(422, "Choose a valid image fit");
    player.profileImageFit = patch.profileImageFit;
  }
  if (Object.hasOwn(patch, "profileImagePosition")) {
    if (!["center", "top", "bottom", "left", "right"].includes(patch.profileImagePosition)) throw statusError(422, "Choose a valid image position");
    player.profileImagePosition = patch.profileImagePosition;
  }
  if (patch.useAccountPhoto) {
    if (!user.accountPhotoUrl) throw statusError(422, "This Firebase account does not provide a profile picture");
    player.profileImage = user.accountPhotoUrl;
  }
  if (Object.hasOwn(patch, "profileImage")) {
    const profileImage = String(patch.profileImage || "");
    if (profileImage.length > 750000) throw statusError(422, "Profile image is too large");
    if (profileImage && !/^data:image\/(jpeg|png|webp|gif);base64,/.test(profileImage)) {
      throw statusError(422, "Choose a JPG, PNG, WebP, or GIF profile image");
    }
    player.profileImage = profileImage;
  }
  user.version += 1;
  if (String(user.profileTitle || "").trim() && String(user.profileBio || "").trim()) {
    user.profileSetupCompletedAt ||= now();
  }
  player.version += 1;
  player.updatedAt = now();
  addAudit(state, user, { action: "own_profile_updated", recordType: "user", recordId: userId, after: { profileTitle: user.profileTitle } });
  await saveState();
  return getClientState(user);
}

export async function getDataQuality() {
  const state = await getState();
  const players = Object.values(state.players);
  const duplicateNames = players.filter((player, index) =>
    players.findIndex((candidate) => candidate.gameName.trim().toLowerCase() === player.gameName.trim().toLowerCase()) !== index
  ).map((player) => player.gameName);
  const validTeams = new Set(["A", "B", "Reserve"]);
  const validUnits = new Set([
    "Unassigned", "Oil Refinery 1", "Oil Refinery 2", "Field Hospital 1",
    "Field Hospital 2", "Field Hospital 3", "Field Hospital 4", "Info Center",
    "Arsenal", "Nuclear Silo", "Mercenary Factory", "Science Hub"
  ]);
  const participants = Object.values(state.eventParticipants).flatMap((records) => Object.values(records));
  return {
    duplicatePlayerNames: duplicateNames,
    unlinkedUsers: Object.values(state.users).filter((user) => !user.playerId).map((user) => user.email),
    missingStableIds: players.filter((player) => !player.id).map((player) => player.gameName),
    missingHistoricalAttendance: participants.filter((participant) => {
      const event = state.events[participant.eventId];
      return event?.status === "archived" && participant.selected && !participant.attendance;
    }).map((participant) => `${participant.playerName} · ${state.events[participant.eventId]?.date}`),
    invalidTeams: participants.filter((participant) => !validTeams.has(participant.team)).map((participant) => participant.playerName),
    invalidUnits: participants.filter((participant) => !validUnits.has(participant.unit)).map((participant) => participant.playerName),
    eventsMissingResults: Object.values(state.events).filter((event) =>
      ["completed", "archived"].includes(event.status) && event.scoreFor === 0 && event.scoreAgainst === 0
    ).map((event) => event.id),
    inactiveAssignedPlayers: participants.filter((participant) =>
      participant.selected && state.players[participant.playerId]?.active === false
    ).map((participant) => participant.playerName),
    unmatchedScreenshotResults: state.pendingResults.filter((result) => !state.players[result.memberId]).map((result) => result.name)
  };
}

export async function addPlayer(input, actor) {
  const state = await getState();
  const id = input.id || newId("player");
  if (state.players[id]) throw statusError(409, "Player ID already exists");
  const normalizedName = normalizePlayerName(input.gameName || input.name);
  if (Object.values(state.players).some((player) => normalizePlayerName(player.gameName) === normalizedName)) throw statusError(409, "A roster member with that normalized player name already exists");
  const player = normalizePlayer({ ...input, id, createdAt: now(), updatedAt: now() });
  state.players[id] = player;
  for (const eventId of Object.keys(state.events)) {
    state.eventParticipants[eventId] ||= {};
    state.eventParticipants[eventId][id] = normalizeParticipant({ eventId, playerId: id, playerName: player.gameName });
  }
  addAudit(state, actor, { action: "player_created", recordType: "player", recordId: id, after: player });
  await saveState();
  return player;
}

export async function updatePlayer(playerId, patch, actor) {
  const state = await getState();
  const player = state.players[playerId];
  if (!player) throw statusError(404, "Player was not found");
  assertVersion(player, patch.version);
  const before = structuredClone(player);
  for (const field of ["gameName", "rank", "defaultRole", "defaultSelected", "defaultTeam", "defaultUnit", "defaultTacticalGroup", "active", "userId", "notes", "aliases", "profileImage", "profileImageFit", "profileImagePosition", "thp"]) {
    if (Object.hasOwn(patch, field)) player[field] = patch[field];
  }
  if (Object.hasOwn(patch, "thp")) {
    const thp = Number(player.thp);
    if (!Number.isFinite(thp) || thp < 0 || thp > 1_000_000_000_000_000) throw statusError(422, "Enter a valid THP value between 0 and 1 quadrillion");
    player.thp = Math.round(thp);
    player.thpUpdatedAt = now();
    player.thpUpdatedBy = actor.uid;
    if (patch.verifyThp) {
      player.thpVerifiedAt = now();
      player.thpVerifiedBy = actor.uid;
    }
  }
  if (String(player.profileImage || "").length > 750000) throw statusError(422, "Profile image is too large");
  if (player.profileImage && !/^data:image\/(jpeg|png|webp|gif);base64,/.test(player.profileImage)) {
    throw statusError(422, "Choose a supported profile image");
  }
  if (Object.hasOwn(patch, "gameName")) {
    player.gameName = String(player.gameName || "").normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, 80);
    if (!player.gameName) throw statusError(422, "Enter a player name");
    if (Object.values(state.players).some((item) => item.id !== playerId && normalizePlayerName(item.gameName) === normalizePlayerName(player.gameName))) throw statusError(409, "That player name matches another roster record");
    if (player.gameName !== before.gameName) {
      player.previousPlayerNames ||= [];
      player.previousPlayerNames.push({ name: before.gameName, changedAt: now(), changedBy: actor.uid, changeType: "officer_correction" });
      player.aliases = [...new Set([...(player.aliases || []), before.gameName])];
      const linkedAccount = Object.values(state.users).find((item) => item.playerId === playerId);
      if (linkedAccount) {
        linkedAccount.displayName = player.gameName;
        if (linkedAccount.profileSelection) linkedAccount.profileSelection.playerName = player.gameName;
        linkedAccount.version = Number(linkedAccount.version || 1) + 1;
      }
    }
    for (const participants of Object.values(state.eventParticipants)) {
      if (participants[playerId]) participants[playerId].playerName = player.gameName;
    }
  }
  player.updatedAt = now();
  player.version += 1;
  auditDiff(state, actor, null, "player", playerId, before, player, "player_updated");
  await saveState();
  return player;
}

export async function deletePlayerProfile(playerId, actor) {
  const state = await getState();
  const player = state.players[playerId];
  if (!player) throw statusError(404, "Player was not found");
  delete state.players[playerId];
  for (const user of Object.values(state.users)) {
    if (user.playerId === playerId) {
      user.playerId = null;
      user.profileConfirmedAt = null;
      user.version += 1;
    }
  }
  for (const [eventId, participants] of Object.entries(state.eventParticipants)) {
    if (state.events[eventId]?.status !== "archived") delete participants[playerId];
  }
  addAudit(state, actor, { action: "player_deleted", recordType: "player", recordId: playerId, before: player });
  await saveState();
  return player;
}

export async function getParticipation(filters) {
  return calculateParticipation(await getState(), filters);
}

export async function getPlayerHistory(playerId, user) {
  const state = await getState();
  const player = state.players[playerId];
  if (!player) throw statusError(404, "Player was not found");
  const events = Object.values(state.events).sort((a, b) => b.date.localeCompare(a.date))
    .map((event) => ({ event, participant: state.eventParticipants[event.id]?.[playerId] }))
    .filter(({ participant }) => participant?.selected)
    .map(({ event, participant }) => ({
      event,
      participant: user.role === "member" ? publicParticipant(participant, user) : participant
    }));
  return { player: publicPlayer(player), statistics: calculateParticipation(state).find((item) => item.playerId === playerId), events };
}

export async function listStrategyTemplates() {
  return Object.values((await getState()).strategyTemplates);
}

export async function addStrategyTemplate(input, actor) {
  const state = await getState();
  const template = normalizeTemplate({ ...input, id: newId("strategy"), createdBy: actor.uid });
  state.strategyTemplates[template.id] = template;
  addAudit(state, actor, { action: "strategy_template_created", recordType: "strategyTemplate", recordId: template.id, after: template });
  await saveState();
  return template;
}

export async function updateStrategyTemplate(templateId, patch, actor) {
  const state = await getState();
  const template = state.strategyTemplates[templateId];
  if (!template) throw statusError(404, "Strategy template was not found");
  assertVersion(template, patch.version);
  const before = structuredClone(template);
  for (const field of ["name", "description", "team", "active", "objectives", "phases", "structureResponsibilities", "defaultAssignments", "notes"]) {
    if (Object.hasOwn(patch, field)) template[field] = patch[field];
  }
  template.updatedAt = now();
  template.version += 1;
  addAudit(state, actor, { action: "strategy_template_updated", recordType: "strategyTemplate", recordId: template.id, before, after: template });
  await saveState();
  return template;
}

export async function applyTemplate(eventId, templateId, team, actor) {
  const state = await getState();
  const result = applyStrategyTemplate(state, eventId, templateId, team, actor);
  updateMapDraft(state, eventId, actor);
  addAudit(state, actor, { eventId, action: "strategy_applied", recordType: "eventStrategy", recordId: team, after: templateId });
  await saveState();
  return result;
}

export async function updateAppliedStrategyOrder(eventId, team, input, actor) {
  const state = await getState();
  const strategy = state.eventStrategies[eventId]?.[team];
  if (!strategy) throw statusError(404, "Apply a strategy template before adjusting group orders");
  const [startMinute, endMinute] = String(input.phase || "").split("-").map(Number);
  if (!Number.isFinite(startMinute) || !Number.isFinite(endMinute)) throw statusError(422, "Choose a valid battle phase");
  const group = String(input.group || "");
  const allowedGroups = ["Unit A", "Unit B", "Unit C", "Unit D", "Strike Team", "Scout + Support", "Disrupters", "Reserve"];
  if (!allowedGroups.includes(group)) throw statusError(422, "Choose a valid tactical group");
  const allowedFields = ["primaryObjective", "secondaryObjective", "primaryAction", "secondaryAction", "goal"];
  const patch = Object.fromEntries(Object.entries(input.patch || {}).filter(([field]) => allowedFields.includes(field)));
  const objectives = ["", "Info Center", "Field Hospital 4", "Arsenal", "Oil Refinery 1", "Field Hospital 2", "Nuclear Silo", "Field Hospital 1", "Oil Refinery 2", "Mercenary Factory", "Field Hospital 3", "Science Hub"];
  const actions = ["Secure", "Support", "Rotate", "Attack", "Contest", "Hold", "Defend"];
  for (const [field, value] of Object.entries(patch)) {
    if (field.endsWith("Objective") && !objectives.includes(value)) throw statusError(422, "Choose an objective from the battle map");
    if (field.endsWith("Action") && !actions.includes(value)) throw statusError(422, "Choose a supported strategy action");
    if (field === "goal" && String(value).length > 240) throw statusError(422, "Keep the group goal under 240 characters");
  }
  let phase = strategy.phases.find((item) => Number(item.startMinute) === startMinute);
  if (!phase) {
    phase = { id: `phase-${startMinute}-${endMinute}`, name: `Battle phase ${startMinute}–${endMinute}`, startMinute, endMinute, instructions: "", fallbackPlan: "", groupOrders: {} };
    strategy.phases.push(phase);
  }
  phase.groupOrders ||= {};
  phase.groupOrders[group] = { ...(phase.groupOrders[group] || {}), ...patch };
  if (startMinute === 0) {
    for (const participant of Object.values(state.eventParticipants[eventId] || {})) {
      if (participant.team !== team || participant.tacticalGroup !== group) continue;
      const order = phase.groupOrders[group];
      participant.unit = order.primaryObjective || "Unassigned";
      participant.primaryUnit = order.primaryObjective || "";
      participant.rotationUnit = order.secondaryObjective || "";
      participant.primaryAssignment = order.primaryAction || "";
      participant.backupAssignment = order.secondaryAction || "";
      participant.openingObjective = order.primaryObjective || "";
      participant.updatedAt = now();
    }
  }
  strategy.updatedAt = now();
  strategy.updatedBy = actor.uid;
  updateMapDraft(state, eventId, actor);
  addAudit(state, actor, { eventId, action: "strategy_order_updated", recordType: "eventStrategy", recordId: team, field: `${input.phase}.${group}`, after: patch });
  await saveState();
  return strategy;
}

function updateMapDraft(state, eventId, actor) {
  state.eventMapDrafts[eventId] = buildEventMapPlan(state, eventId, {
    status: "draft", updatedAt: now(), updatedBy: actor.uid,
    version: Number(state.eventMapDrafts[eventId]?.version || 0) + 1
  });
}

function publishMapSnapshot(state, managedEvent, actor) {
  const legacyEventId = managedEvent.legacyRef?.collection === "events" ? managedEvent.legacyRef.id : managedEvent.id;
  const plan = buildEventMapPlan(state, legacyEventId, {
    status: "published", updatedAt: now(), updatedBy: actor.uid,
    version: Number(state.eventMapDrafts[legacyEventId]?.version || 0) + 1
  });
  validateEventMapPlan(state, legacyEventId, plan);
  state.eventMapDrafts[legacyEventId] = plan;
  state.eventMapSnapshots[legacyEventId] ||= {};
  const publicationVersion = String(managedEvent.version + 1);
  state.eventMapSnapshots[legacyEventId][publicationVersion] = structuredClone({
    ...plan, status: "published", publicationVersion, publishedAt: now(), publishedBy: actor.uid
  });
  managedEvent.details = { ...managedEvent.details, mapPlanVersion: plan.version, mapPublicationVersion: publicationVersion };
}

function buildEventMapPlan(state, eventId, metadata = {}) {
  const teams = {};
  for (const team of ["A", "B"]) {
    const strategy = structuredClone(state.eventStrategies[eventId]?.[team] || {});
    teams[team] = {
      strategyId: strategy.templateId || strategy.id || state.events[eventId]?.[`strategy${team}`] || "",
      strategyName: strategy.name || state.events[eventId]?.[`strategy${team}`] || "",
      phases: strategy.phases || [],
      participantIds: Object.values(state.eventParticipants[eventId] || {}).filter((item) => item.selected && item.team === team).map((item) => item.playerId)
    };
  }
  return {
    version: Number(metadata.version || 1), mapDefinitionId: "desert-storm-standard-v1", eventId,
    status: metadata.status || "draft", teams, updatedAt: metadata.updatedAt || now(), updatedBy: metadata.updatedBy || ""
  };
}

function validateEventMapPlan(state, eventId, plan) {
  const structures = new Set(["Info Center", "Field Hospital 4", "Arsenal", "Oil Refinery 1", "Field Hospital 2", "Nuclear Silo", "Field Hospital 1", "Oil Refinery 2", "Mercenary Factory", "Field Hospital 3", "Science Hub"]);
  const actions = new Set(["Secure", "Support", "Rotate", "Attack", "Contest", "Hold", "Defend", "Capture", "Pressure", "Reinforce", "Disrupt", "Delay", "Finish", "Ignore"]);
  for (const [team, definition] of Object.entries(plan.teams || {})) {
    if (!["A", "B"].includes(team)) throw statusError(422, "The map contains an invalid DS team");
    for (const phase of definition.phases || []) {
      if (Number(phase.startMinute) < 0 || Number(phase.endMinute) > 30 || Number(phase.endMinute) <= Number(phase.startMinute)) throw statusError(422, "The map contains an invalid battle phase");
      for (const order of Object.values(phase.groupOrders || {})) {
        for (const field of ["primaryObjective", "secondaryObjective"]) if (order[field] && !structures.has(order[field])) throw statusError(422, `Unknown map structure: ${order[field]}`);
        for (const field of ["primaryAction", "secondaryAction"]) if (order[field] && !actions.has(order[field])) throw statusError(422, `Unsupported map action: ${order[field]}`);
      }
    }
    for (const playerId of definition.participantIds || []) if (!state.eventParticipants[eventId]?.[playerId]) throw statusError(422, "The map references an unknown event participant");
  }
}

function latestMapSnapshot(state, eventId) {
  return Object.values(state.eventMapSnapshots?.[eventId] || {}).sort((a, b) => Number(b.publicationVersion) - Number(a.publicationVersion))[0] || null;
}

function mapPlanForUser(state, eventId, user) {
  return user.role === "member" ? latestMapSnapshot(state, eventId) || buildEventMapPlan(state, eventId, { status: "published" }) : state.eventMapDrafts?.[eventId] || buildEventMapPlan(state, eventId);
}

function mapStrategyForUser(state, eventId, user) {
  const plan = mapPlanForUser(state, eventId, user);
  if (plan?.teams) return Object.fromEntries(Object.entries(plan.teams).map(([team, value]) => [team, { id: value.strategyId, name: value.strategyName, phases: value.phases || [] }]));
  return state.eventStrategies[eventId] || {};
}

export async function getAudit(eventId) {
  const state = await getState();
  const entries = eventId
    ? Object.values(state.auditLogs[eventId] || {})
    : Object.values(state.auditLogs).flatMap((records) => Object.values(records));
  return entries.sort((left, right) => right.timestamp.localeCompare(left.timestamp));
}

export async function updateUser(userId, patch, actor) {
  const state = await getState();
  const user = state.users[userId];
  if (!user) throw statusError(404, "User was not found");
  const before = structuredClone(user);
  if (actor.role !== "administrator") throw statusError(403, "Only an administrator can change account authorization");
  if (Object.hasOwn(patch, "role")) {
    if (!["member", "officer", "administrator"].includes(patch.role)) throw statusError(422, "Choose a valid role");
    if (actor.role !== "administrator" && patch.role === "administrator") throw statusError(403, "Only an administrator can grant administrator access");
    user.role = patch.role;
  }
  if (Object.hasOwn(patch, "playerId")) {
    const nextPlayerId = patch.playerId || null;
    if (nextPlayerId && !state.players[nextPlayerId]) throw statusError(404, "Player was not found");
    if (nextPlayerId) {
      const linkedUser = Object.values(state.users).find((item) => item.uid !== userId && item.playerId === nextPlayerId);
      if (linkedUser) throw statusError(409, "That player is already linked to another account");
    }
    if (user.playerId && state.players[user.playerId]?.userId === userId) {
      state.players[user.playerId].userId = null;
    }
    user.playerId = nextPlayerId;
    user.profileConfirmedAt = null;
    user.profileSelection = null;
    if (nextPlayerId) state.players[nextPlayerId].userId = userId;
  }
  if (Object.hasOwn(patch, "active")) user.active = Boolean(patch.active);
  user.version += 1;
  addAudit(state, actor, { action: "user_role_changed", recordType: "user", recordId: userId, before, after: user });
  await saveState();
  return user;
}

// Compatibility methods retained for screenshot import and the pre-event client.
export async function updateMember(memberId, patch) {
  const state = await getState();
  const eventId = state.activeEventId;
  return updateEventParticipant(eventId, memberId, mapLegacyParticipantPatch(patch), { uid: "legacy-client", role: "officer", displayName: "Legacy client" });
}

export async function updateSettings(patch) {
  const state = await getState();
  return updateEvent(state.activeEventId, patch, { uid: "legacy-client", role: "officer", displayName: "Legacy client" });
}

export async function replaceState() {
  throw statusError(410, "Whole-state replacement is disabled; use targeted event APIs");
}

export async function resetWeek() {
  throw statusError(410, "Weekly reset was replaced by Create Next Battle");
}

export async function archiveBattle(payload) {
  const state = await getState();
  await updateEvent(state.activeEventId, payload, { uid: "legacy-client", role: "officer", displayName: "Legacy client" });
  const event = state.events[state.activeEventId];
  if (event.status === "draft") await changeEventStatus(event.id, "publish", { uid: "legacy-client", role: "officer" }, "Legacy archive workflow");
  if (event.status === "published") await changeEventStatus(event.id, "start", { uid: "legacy-client", role: "officer" });
  if (event.status === "in_progress") await changeEventStatus(event.id, "complete", { uid: "legacy-client", role: "officer" });
  return changeEventStatus(event.id, "archive", { uid: "legacy-client", role: "officer" });
}

export async function deleteBattle(eventId) {
  const state = await getState();
  if (!state.events[eventId]) throw statusError(404, "Archived event was not found");
  delete state.events[eventId];
  delete state.eventParticipants[eventId];
  delete state.eventStrategies[eventId];
  await saveState();
  return state;
}

export async function clearBattleHistory() {
  const state = await getState();
  for (const event of Object.values(state.events)) {
    if (event.status === "archived") {
      delete state.events[event.id];
      delete state.eventParticipants[event.id];
    }
  }
  await saveState();
  return state;
}

export async function applyResultScreenshotMatches(matches, team) {
  const state = await getState();
  for (const match of matches) {
    const player = state.players[match.memberId];
    if (!player) continue;
    upsertPendingResult(state, { memberId: player.id, name: player.gameName, rank: player.rank, team, score: match.score, attendance: "Present", notes: "Imported from results screenshot", sourceLine: match.sourceLine });
  }
  return saveState();
}

export async function applyResultMatchFix(fix) {
  const state = await getState();
  const player = state.players[fix.memberId];
  if (!player) throw statusError(422, "Choose a valid roster member");
  upsertPendingResult(state, { memberId: player.id, name: player.gameName, rank: player.rank, team: fix.team, score: fix.score, attendance: "Present", notes: "Imported from screenshot match fix", sourceLine: fix.alias });
  return saveState();
}

export async function saveVsScore(input, actor) {
  const state = await getState();
  const player = state.players[String(input.playerId || "")];
  if (!player) throw statusError(422, "Choose a valid roster member");
  const date = String(input.date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw statusError(422, "Choose a valid VS score date");
  const vsWeekId = String(input.vsWeekId || "");
  if (vsWeekId) {
    const week = state.vsWeeks[vsWeekId];
    if (!week) throw statusError(422, "Choose a valid VS week");
    const start = new Date(`${week.beginDate}T12:00:00`);
    const validDates = Array.from({ length: 6 }, (_, offset) => {
      const day = new Date(start);
      day.setDate(day.getDate() + offset);
      return day.toISOString().slice(0, 10);
    });
    if (!validDates.includes(date)) throw statusError(422, "Choose Monday through Saturday in this VS week");
    if (week.publishedDays?.[date]) throw statusError(409, "Published daily VS scores are read-only");
  }
  const score = Number(input.score);
  if (!Number.isFinite(score) || score < 0) throw statusError(422, "Enter a valid VS score");
  const existing = state.vsScores.find((item) => item.date === date && item.playerId === player.id && item.vsWeekId === vsWeekId);
  const next = normalizeVsScore({
    ...existing,
    date,
    vsWeekId,
    playerId: player.id,
    playerName: player.gameName,
    score,
    hasScore: true,
    source: input.source,
    sourceLine: input.sourceLine,
    createdBy: existing?.createdBy || actor.uid,
    updatedAt: now()
  });
  if (existing) Object.assign(existing, next);
  else state.vsScores.push(next);
  addAudit(state, actor, { action: existing ? "vs_score_updated" : "vs_score_created", recordType: "vsScore", recordId: next.id, after: next });
  await saveState();
  return next;
}

export async function createVsWeek(input, actor) {
  const state = await getState();
  const beginDate = String(input.beginDate || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(beginDate)) throw statusError(422, "Choose a valid VS week begin date");
  if (new Date(`${beginDate}T12:00:00`).getDay() !== 1) throw statusError(422, "VS week must begin on a Monday");
  if (Object.values(state.vsWeeks).some((item) => item.beginDate === beginDate)) throw statusError(409, "A VS week already begins on that Monday");
  if (!String(input.opponent || "").trim()) throw statusError(422, "Enter the weekly VS opponent");
  if (!String(input.server || "").trim()) throw statusError(422, "Enter the opponent server");
  if (Number(input.opponentMembers || 0) < 1) throw statusError(422, "Enter the opponent member count");
  const duelLeagueCode = String(input.duelLeagueCode || "").trim().toUpperCase();
  if (!/^[A-Z]+\d+$/i.test(duelLeagueCode)) throw statusError(422, "Enter a Duel League code such as S35");
  const duelLeagueWeek = Number(input.duelLeagueWeek || 0);
  let group = Object.values(state.duelLeagueGroups).find((item) => item.code === duelLeagueCode && !item.archived);
  if (!group) {
    group = normalizeDuelLeagueGroup({ code: duelLeagueCode, rankings: [], id: newId("duel-group"), createdBy: actor.uid });
    state.duelLeagueGroups[group.id] = group;
    addAudit(state, actor, { action: "duel_group_created_from_vs_week", recordType: "duelLeagueGroup", recordId: group.id, after: group });
  }
  const duelLeagueGroupId = group.id;
  if (![1, 2, 3, 4].includes(duelLeagueWeek)) throw statusError(422, "Choose Duel League week 1, 2, 3, or 4");
  if (Object.values(state.vsWeeks).some((item) => item.duelLeagueGroupId === duelLeagueGroupId && item.duelLeagueWeek === duelLeagueWeek)) {
    throw statusError(409, `Week ${duelLeagueWeek}/4 is already assigned to ${group.code}`);
  }
  const week = normalizeVsWeek({ ...input, duelLeagueGroupId, id: newId("vs-week"), createdBy: actor.uid, createdAt: now(), updatedAt: now() });
  state.vsWeeks[week.id] = week;
  addAudit(state, actor, { action: "vs_week_created", recordType: "vsWeek", recordId: week.id, after: week });
  await saveState();
  return week;
}

export async function updateVsWeekStandings(weekId, standings, actor) {
  const state = await getState();
  const week = state.vsWeeks[weekId];
  if (!week) throw statusError(404, "VS week was not found");
  if (Object.keys(week.publishedDays || {}).length) throw statusError(409, "Standings for a published VS week are read-only");
  const normalized = normalizeVsWeek({ standings }).standings;
  if (!normalized.length) throw statusError(422, "No Duel League standings could be extracted");
  week.standings = normalized.slice(0, 16).map((row, index) => ({ ...row, rank: index + 1 }));
  week.updatedAt = now();
  addAudit(state, actor, { action: "vs_week_standings_imported", recordType: "vsWeek", recordId: week.id, after: { standings: week.standings } });
  await saveState();
  return week;
}

export async function clearVsWeekStandings(weekId, actor) {
  const state = await getState();
  const week = state.vsWeeks[weekId];
  if (!week) throw statusError(404, "VS week was not found");
  if (Object.keys(week.publishedDays || {}).length) throw statusError(409, "Standings for a published VS week are read-only");
  const before = structuredClone(week.standings || []);
  week.standings = [];
  week.updatedAt = now();
  addAudit(state, actor, { action: "vs_week_standings_cleared", recordType: "vsWeek", recordId: week.id, before, after: { standings: [] } });
  await saveState();
  return week;
}

export async function archiveDuelLeagueGroup(groupId, actor) {
  const state = await getState();
  const group = state.duelLeagueGroups[groupId];
  if (!group) throw statusError(404, "Duel League grouping set was not found");
  const weeks = Object.values(state.vsWeeks).filter((week) => week.duelLeagueGroupId === groupId);
  const slots = new Set(weeks.map((week) => week.duelLeagueWeek));
  if (slots.size !== 4) throw statusError(409, "Assign all four VS weeks before archiving this Duel League cycle");
  group.archived = true;
  group.updatedAt = now();
  addAudit(state, actor, { action: "duel_group_archived", recordType: "duelLeagueGroup", recordId: group.id, after: group });
  await saveState();
  return group;
}

export async function updateVsDayResult(weekId, input, actor) {
  const state = await getState();
  const week = state.vsWeeks[weekId];
  if (!week) throw statusError(404, "VS week was not found");
  const date = String(input.date || "");
  const validDates = Array.from({ length: 6 }, (_, offset) => {
    const day = new Date(`${week.beginDate}T12:00:00`);
    day.setDate(day.getDate() + offset);
    return day.toISOString().slice(0, 10);
  });
  if (!validDates.includes(date)) throw statusError(422, "Choose Monday through Saturday in this VS week");
  if (week.publishedDays?.[date]) throw statusError(409, "Published daily VS results are read-only");
  const ourScore = Math.max(0, Number(input.ourScore || 0));
  const opponentScore = Math.max(0, Number(input.opponentScore || 0));
  week.dailyResults[date] = { ourScore, opponentScore, updatedAt: now(), updatedBy: actor.uid };
  week.updatedAt = now();
  addAudit(state, actor, { action: "vs_day_result_updated", recordType: "vsWeek", recordId: week.id, after: { date, ...week.dailyResults[date] } });
  await saveState();
  return week;
}

export async function auditVsDay(weekId, date) {
  const state = await getState();
  const week = state.vsWeeks[weekId];
  if (!week) throw statusError(404, "VS week was not found");
  const validDates = Array.from({ length: 6 }, (_, offset) => {
    const day = new Date(`${week.beginDate}T12:00:00`);
    day.setDate(day.getDate() + offset);
    return day.toISOString().slice(0, 10);
  });
  if (!validDates.includes(date)) throw statusError(422, "Choose a valid day in this VS week");
  const activePlayers = Object.values(state.players).filter((player) => player.active !== false);
  const scores = state.vsScores.filter((entry) => entry.vsWeekId === weekId && entry.date === date);
  const counts = new Map();
  for (const score of scores) counts.set(score.playerId, (counts.get(score.playerId) || 0) + 1);
  const missingPlayers = activePlayers.filter((player) => !counts.has(player.id)).map((player) => ({ id: player.id, name: player.gameName }));
  const duplicatePlayers = [...counts.entries()].filter(([, count]) => count > 1).map(([playerId, count]) => ({
    id: playerId,
    name: state.players[playerId]?.gameName || playerId,
    count
  }));
  const invalidScores = scores.filter((entry) => entry.hasScore === false || !Number.isFinite(Number(entry.score)) || Number(entry.score) < 0).map((entry) => entry.playerName);
  const zeroScores = scores.filter((entry) => entry.hasScore !== false && Number(entry.score) === 0).map((entry) => entry.playerName);
  const result = week.dailyResults?.[date];
  const missingTeamResult = !result;
  return {
    weekId,
    date,
    passed: !duplicatePlayers.length && !invalidScores.length && !missingTeamResult,
    publishable: !duplicatePlayers.length && !invalidScores.length && !missingTeamResult,
    hasWarnings: Boolean(missingPlayers.length || zeroScores.length),
    expectedPlayers: activePlayers.length,
    submittedScores: scores.length,
    missingPlayers,
    duplicatePlayers,
    invalidScores,
    zeroScores,
    missingTeamResult,
    published: Boolean(week.publishedDays?.[date])
  };
}

export async function publishVsDay(weekId, date, actor) {
  const state = await getState();
  const audit = await auditVsDay(weekId, date);
  if (!audit.publishable) throw statusError(409, "Resolve duplicate, invalid, or missing team-result issues before publishing");
  const week = state.vsWeeks[weekId];
  if (week.publishedDays?.[date]) return week.publishedDays[date];
  week.publishedDays ||= {};
  week.publishedDays[date] = {
    publishedAt: now(),
    publishedBy: actor.uid,
    audit: structuredClone(audit)
  };
  const ranking = state.vsScores.filter((score) => score.vsWeekId === weekId && score.date === date)
    .map((score) => ({ playerId: score.playerId, value: Number(score.score || 0) }))
    .sort((a, b) => b.value - a.value);
  if (state.achievementDefinitions?.topThreeEnabled !== false) awardTopThree(state, ranking, {
    type: "vs_daily", label: "VS Daily", eventId: weekId, periodId: date,
    message: (record, placement) => `You finished ${placement} in the ${date} VS standings with ${record.value.toLocaleString()} points.`
  });
  if (state.achievementDefinitions?.publicAnnouncements && ranking.length && !state.announcements.some((item) => item.sourceKey === `vs-top-three:${weekId}:${date}`)) {
    state.announcements.unshift({
      id: newId("announcement"), sourceKey: `vs-top-three:${weekId}:${date}`,
      title: `VS top performers Â· ${date}`,
      summary: ranking.slice(0, 3).map((record, index) => `${index + 1}. ${state.players[record.playerId]?.gameName || "Alliance member"}`).join("\n"),
      attachment: "", attachmentName: "", acknowledgements: {}, replies: [], helpful: {},
      createdAt: now(), createdBy: actor.uid
    });
  }
  for (const record of ranking) {
    const priorPublishedScores = state.vsScores.filter((score) => score.playerId === record.playerId && score.date < date)
      .filter((score) => state.vsWeeks[score.vsWeekId]?.publishedDays?.[score.date])
      .sort((left, right) => String(left.date).localeCompare(String(right.date)));
    const previousBest = priorPublishedScores.reduce((best, score) => Math.max(best, Number(score.score || 0)), 0);
    if (!priorPublishedScores.length) awardAchievement(state, record.playerId, {
      key: "vs_daily_first_submission", eventId: weekId, eventType: "vs_daily", periodId: date,
      value: record.value, title: "First published VS score", message: `Your first published VS score was ${record.value.toLocaleString()} points.`
    });
    if (record.value > previousBest) awardAchievement(state, record.playerId, {
      key: "vs_daily_personal_record", eventId: weekId, eventType: "vs_daily", periodId: date,
      value: record.value, title: "New VS daily record",
      message: `You set a new published daily record with ${record.value.toLocaleString()} points.`
    });
    const currentOffset = Math.round((new Date(`${date}T12:00:00Z`) - new Date(`${week.beginDate}T12:00:00Z`)) / 86400000);
    const previousMatchingScore = Object.values(state.vsWeeks || {})
      .filter((candidate) => candidate.id !== weekId && candidate.beginDate < week.beginDate)
      .sort((left, right) => String(right.beginDate).localeCompare(String(left.beginDate)))
      .map((candidate) => {
        const matchingDate = new Date(`${candidate.beginDate}T12:00:00Z`);
        matchingDate.setUTCDate(matchingDate.getUTCDate() + currentOffset);
        const key = matchingDate.toISOString().slice(0, 10);
        if (!candidate.publishedDays?.[key]) return null;
        return state.vsScores.find((score) => score.vsWeekId === candidate.id && score.playerId === record.playerId && score.date === key);
      })
      .find(Boolean);
    if (previousMatchingScore && record.value > Number(previousMatchingScore.score || 0)) awardAchievement(state, record.playerId, {
      key: "vs_daily_matching_day_improvement", eventId: weekId, eventType: "vs_daily", periodId: date,
      value: record.value - Number(previousMatchingScore.score || 0), title: "VS day improvement",
      message: `You improved this VS day by ${(record.value - Number(previousMatchingScore.score || 0)).toLocaleString()} points over the prior matching day.`
    });
    const publishedDateSet = new Set([...priorPublishedScores.map((score) => score.date), date]);
    let streak = 0;
    const cursor = new Date(`${date}T12:00:00Z`);
    while (publishedDateSet.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    if (streak >= 3) awardAchievement(state, record.playerId, {
      key: `vs_daily_streak_${streak}`, eventId: weekId, eventType: "vs_daily", periodId: date,
      value: streak, title: `${streak}-day VS scoring streak`, message: `You recorded published VS scores on ${streak} consecutive days.`
    });
    const dailyThreshold = Number(state.achievementDefinitions?.vsDailyThreshold || 80_000_000);
    if (dailyThreshold > 0 && record.value >= dailyThreshold) awardAchievement(state, record.playerId, {
      key: `vs_daily_threshold_${dailyThreshold}`, eventId: weekId, eventType: "vs_daily", periodId: date,
      value: record.value, title: "VS daily milestone", message: `You reached ${record.value.toLocaleString()} points in a published VS day.`
    });
  }
  const expectedDates = Array.from({ length: 6 }, (_, offset) => {
    const day = new Date(`${week.beginDate}T12:00:00`);
    day.setDate(day.getDate() + offset);
    return day.toISOString().slice(0, 10);
  });
  if (expectedDates.every((day) => week.publishedDays?.[day])) {
    const totals = new Map();
    for (const score of state.vsScores.filter((item) => item.vsWeekId === weekId && expectedDates.includes(item.date))) {
      totals.set(score.playerId, (totals.get(score.playerId) || 0) + Number(score.score || 0));
    }
    const weeklyRanking = [...totals.entries()].map(([playerId, value]) => ({ playerId, value })).sort((a, b) => b.value - a.value);
    if (state.achievementDefinitions?.topThreeEnabled !== false) awardTopThree(state, weeklyRanking, {
      type: "vs_weekly", label: "VS Weekly", eventId: weekId, periodId: week.beginDate,
      message: (record, placement) => `You finished ${placement} for the VS week with ${record.value.toLocaleString()} points.`
    });
    const weeklyImprovements = [];
    for (const record of weeklyRanking) {
      const priorPublishedWeeklyTotals = Object.values(state.vsWeeks || {})
        .filter((candidate) => candidate.id !== weekId && candidate.beginDate < week.beginDate)
        .sort((left, right) => String(left.beginDate).localeCompare(String(right.beginDate)))
        .map((candidate) => {
          const publishedDates = Object.keys(candidate.publishedDays || {});
          if (publishedDates.length < 6) return null;
          return state.vsScores
            .filter((item) => item.vsWeekId === candidate.id && item.playerId === record.playerId && publishedDates.includes(item.date))
            .reduce((sum, item) => sum + Number(item.score || 0), 0);
        })
        .filter((value) => value !== null);
      const priorBest = priorPublishedWeeklyTotals.length ? Math.max(...priorPublishedWeeklyTotals) : 0;
      const priorMostRecent = priorPublishedWeeklyTotals.at(-1) || 0;
      if (record.value > priorBest) awardAchievement(state, record.playerId, {
        key: "vs_weekly_personal_record", eventId: weekId, eventType: "vs_weekly", periodId: week.beginDate,
        value: record.value, title: "New VS weekly record",
        message: `You set a new published weekly record with ${record.value.toLocaleString()} points.`
      });
      if (priorMostRecent > 0 && record.value > priorMostRecent) awardAchievement(state, record.playerId, {
        key: "vs_weekly_improvement", eventId: weekId, eventType: "vs_weekly", periodId: week.beginDate,
        value: record.value - priorMostRecent, title: "VS weekly improvement",
        message: `You improved by ${(record.value - priorMostRecent).toLocaleString()} points over your previous published week.`
      });
      if (priorMostRecent > 0 && record.value > priorMostRecent) {
        weeklyImprovements.push({ playerId: record.playerId, value: record.value - priorMostRecent });
      }
      const weeklyThreshold = Number(state.achievementDefinitions?.vsWeeklyThreshold || 500_000_000);
      if (weeklyThreshold > 0 && record.value >= weeklyThreshold) awardAchievement(state, record.playerId, {
        key: `vs_weekly_threshold_${weeklyThreshold}`, eventId: weekId, eventType: "vs_weekly", periodId: week.beginDate,
        value: record.value, title: "VS weekly milestone", message: `You reached ${record.value.toLocaleString()} points in the published VS week.`
      });
      const submissions = state.vsScores.filter((item) => item.vsWeekId === weekId && item.playerId === record.playerId && expectedDates.includes(item.date));
      if (new Set(submissions.map((item) => item.date)).size === 6) awardAchievement(state, record.playerId, {
        key: "vs_weekly_complete_submissions", eventId: weekId, eventType: "vs_weekly", periodId: week.beginDate,
        value: record.value, title: "Complete VS week", message: "You submitted a published score for every VS day this week."
      });
    }
    const highestImprovement = weeklyImprovements.sort((left, right) => right.value - left.value)[0];
    if (highestImprovement) awardAchievement(state, highestImprovement.playerId, {
      key: "vs_weekly_highest_improvement", eventId: weekId, eventType: "vs_weekly", periodId: week.beginDate,
      value: highestImprovement.value, title: "Highest VS weekly improvement",
      message: `You posted the alliance's highest week-over-week improvement: ${highestImprovement.value.toLocaleString()} points.`
    });
  }
  updateVsGoals(state, week, weekId, date, ranking);
  addAudit(state, actor, {
    action: "vs_day_published",
    recordType: "vsDay",
    recordId: `${weekId}:${date}`,
    after: { date, duelLeagueGroupId: week.duelLeagueGroupId, duelLeagueWeek: week.duelLeagueWeek, audit }
  });
  await saveState();
  return week.publishedDays[date];
}

export function updateVsGoals(state, week, weekId, date, ranking) {
  for (const account of Object.values(state.users || {})) {
    if (!account.playerId) continue;
    const dailyScore = ranking.find((record) => record.playerId === account.playerId)?.value || 0;
    const weeklyScore = state.vsScores.filter((score) => score.vsWeekId === weekId && score.playerId === account.playerId)
      .filter((score) => week.publishedDays?.[score.date]).reduce((sum, score) => sum + Number(score.score || 0), 0);
    for (const goal of state.userGoals?.[account.uid] || []) {
      if (goal.progressSource !== "automatic" && goal.progressMode !== "automatic") continue;
      if (goal.goalType === "vs_daily" && (!goal.dueDate || goal.dueDate === date)) {
        goal.currentValue = dailyScore;
        goal.updatedAt = now();
      }
      if (goal.goalType === "vs_weekly") {
        goal.currentValue = weeklyScore;
        goal.updatedAt = now();
      }
      if (Number(goal.targetValue) > 0 && Number(goal.currentValue) >= Number(goal.targetValue)) {
        goal.status = "completed";
        goal.completedAt ||= now();
      }
    }
  }
}

export function updateParticipationGoals(state) {
  for (const account of Object.values(state.users || {})) {
    if (!account.playerId) continue;
    const archivedIds = Object.values(state.events || {}).filter((event) => event.status === "archived").map((event) => event.id);
    const records = archivedIds.map((id) => state.eventParticipants[id]?.[account.playerId]).filter(Boolean);
    const attendance = records.filter((record) => ["Present", "Late"].includes(record.attendance)).length;
    const confirmations = records.filter((record) => record.availability === "Confirmed" || record.confirmedAt).length;
    for (const goal of state.userGoals?.[account.uid] || []) {
      if (goal.progressSource !== "automatic") continue;
      if (goal.automationMetric === "attendance") goal.currentValue = attendance;
      if (goal.automationMetric === "confirmation") goal.currentValue = confirmations;
      if (["attendance", "confirmation"].includes(goal.automationMetric)) {
        goal.updatedAt = now();
        if (Number(goal.targetValue) > 0 && Number(goal.currentValue) >= Number(goal.targetValue)) {
          goal.status = "completed";
          goal.completedAt ||= now();
        }
      }
    }
  }
}

export async function deleteVsWeek(weekId, actor) {
  const state = await getState();
  const week = state.vsWeeks[weekId];
  if (!week) throw statusError(404, "VS week was not found");
  if (Object.keys(week.publishedDays || {}).length) throw statusError(409, "A VS week with published daily history cannot be deleted");
  delete state.vsWeeks[weekId];
  state.vsScores = state.vsScores.filter((score) => score.vsWeekId !== weekId);
  addAudit(state, actor, { action: "vs_week_deleted", recordType: "vsWeek", recordId: weekId, before: week });
  await saveState();
  return week;
}

export async function applyVsScreenshotMatches(matches, date, actor, vsWeekId = "") {
  for (const match of matches) {
    await saveVsScore({ date, vsWeekId, playerId: match.memberId, score: match.score, source: "screenshot", sourceLine: match.sourceLine }, actor);
  }
}

export async function deleteVsScore(scoreId, actor) {
  const state = await getState();
  const index = state.vsScores.findIndex((item) => item.id === scoreId);
  if (index < 0) throw statusError(404, "VS score was not found");
  const target = state.vsScores[index];
  if (state.vsWeeks[target.vsWeekId]?.publishedDays?.[target.date]) throw statusError(409, "Published daily VS scores are read-only");
  const [removed] = state.vsScores.splice(index, 1);
  addAudit(state, actor, { action: "vs_score_deleted", recordType: "vsScore", recordId: scoreId, before: removed });
  await saveState();
  return removed;
}

async function loadAndMigrateState() {
  await mkdir(dataDir, { recursive: true });
  const firebaseInput = await loadFirebaseState();
  let input = firebaseInput;
  if (!input) {
    try {
      input = JSON.parse(await readFile(statePath, "utf8"));
    } catch {
      input = { members: [], battles: [], settings: {} };
    }
  }
  const { state, report } = migrateLegacyState(input);
  if (firebaseInput && input.schema !== CURRENT_SCHEMA) {
    await saveFirebaseState(state);
  } else if (!firebaseInput && isFirebasePersistenceEnabled()) {
    await saveFirebaseState(state);
  } else if (input.schema !== CURRENT_SCHEMA) {
    try {
      await copyFile(statePath, backupPath);
    } catch {}
    await writeFile(statePath, JSON.stringify(state, null, 2), "utf8");
    await writeFile(migrationReportPath, renderMigrationReport(report), "utf8");
  }
  return state;
}

function chooseActiveEvent(state, user) {
  const selected = state.events[state.activeEventId];
  if (selected && (user.role !== "member" || selected.status !== "draft")) return selected;
  return Object.values(state.events).filter((event) => user.role !== "member" || event.status !== "draft")
    .sort((left, right) => right.date.localeCompare(left.date))[0] || null;
}

function publicPlayer(player) {
  const { notes, userId, thpUpdatedBy, thpVerifiedBy, ...safe } = player;
  return {
    ...safe,
    previousPlayerNames: (player.previousPlayerNames || []).map(({ name, changedAt, changeType }) => ({ name, changedAt, changeType }))
  };
}

function publicParticipant(participant, user) {
  if (user.role !== "member") return participant;
  const { officerNotes, ...safe } = participant;
  return safe;
}

function publicThemeWeek(theme, user) {
  const state = cachedState;
  const submissions = Object.fromEntries(Object.entries(theme.submissions || {}).map(([playerId, entry]) => [
    playerId,
    {
      ...entry,
      playerName: state?.players?.[playerId]?.gameName || "Alliance member",
      profileImage: state?.players?.[playerId]?.profileImage || ""
    }
  ]));
  const comments = (theme.comments || []).map((comment) => ({
    ...comment,
    playerName: state?.players?.[comment.playerId]?.gameName || "Alliance member",
    profileImage: state?.players?.[comment.playerId]?.profileImage || ""
  }));
  const tally = Object.values(theme.votes || {}).reduce((counts, playerId) => {
    counts[playerId] = (counts[playerId] || 0) + 1;
    return counts;
  }, {});
  const resultsVisible = ["finalized", "archived"].includes(theme.status);
  const rankings = resultsVisible
    ? (theme.finalistIds || []).map((playerId) => ({
      playerId,
      votes: tally[playerId] || 0,
      playerName: state?.players?.[playerId]?.gameName || "Alliance member",
      profileImage: state?.players?.[playerId]?.profileImage || "",
      submissionImage: submissions[playerId]?.image || ""
    })).sort((left, right) => right.votes - left.votes || left.playerName.localeCompare(right.playerName))
    : [];
  return {
    ...theme,
    submissions,
    comments,
    tally: resultsVisible ? tally : undefined,
    rankings,
    winner: rankings[0] || null,
    myVote: user.playerId ? theme.votes?.[user.playerId] || null : null,
    acknowledgedAt: user.playerId ? theme.acknowledgements?.[user.playerId] || null : null,
    votes: undefined,
    acknowledgements: undefined
  };
}

function legacyMemberProjection(player, participant) {
  return {
    id: player.id,
    name: player.gameName,
    rank: player.rank,
    selected: Boolean(participant?.selected),
    team: participant?.team || "Reserve",
    type: participant?.rosterStatus || player.defaultRole || "Sub",
    unit: participant?.unit || player.defaultUnit || "Unassigned",
    tacticalGroup: participant?.tacticalGroup || player.defaultTacticalGroup || "Reserve",
    unitLeader: Boolean(participant?.unitLeader),
    availability: participant?.availability === "Unavailable" ? "Not available" : participant?.availability || "Pending",
    aliases: player.aliases,
    profileImage: player.profileImage || "",
    availabilityGuidance: player.availabilityGuidance || "",
    weekScore: Number(participant?.score || 0),
    weekAttendance: participant?.attendance || "",
    weekNotes: participant?.notes || ""
  };
}

function legacyBattleProjection(event, participants) {
  return {
    ...event,
    players: Object.values(participants).filter((participant) => participant.selected).map((participant) => ({
      id: participant.playerId,
      name: participant.playerName,
      team: participant.team,
      type: participant.rosterStatus,
      unit: participant.unit,
      availability: participant.availability,
      attendance: participant.attendance,
      score: participant.score,
      notes: participant.notes,
      source: "event"
    }))
  };
}

function permissionsFor(user) {
  return {
    isMember: user.role === "member",
    isOfficer: ["officer", "administrator"].includes(user.role),
    isAdministrator: user.role === "administrator",
    canManageEvents: ["officer", "administrator"].includes(user.role),
    canManageUsers: user.role === "administrator"
  };
}

function assertVersion(record, suppliedVersion) {
  if (suppliedVersion === undefined) return;
  if (Number(suppliedVersion) !== Number(record.version)) {
    const error = statusError(409, "This record changed after you opened it. The latest value has been loaded; retry if your change is still needed.");
    error.latest = record;
    throw error;
  }
}

function auditDiff(state, actor, eventId, recordType, recordId, before, after, action) {
  for (const field of Object.keys(after)) {
    if (JSON.stringify(before?.[field]) === JSON.stringify(after[field])) continue;
    if (["updatedAt", "updatedBy", "version"].includes(field)) continue;
    addAudit(state, actor, { eventId, action, recordType, recordId, field, before: before?.[field], after: after[field] });
  }
}

function mapLegacyParticipantPatch(patch) {
  const mapped = { ...patch };
  if (Object.hasOwn(mapped, "type")) {
    mapped.rosterStatus = mapped.type;
    mapped.role = mapped.type;
    delete mapped.type;
  }
  if (Object.hasOwn(mapped, "weekAttendance")) {
    mapped.attendance = mapped.weekAttendance;
    delete mapped.weekAttendance;
  }
  if (Object.hasOwn(mapped, "weekScore")) {
    mapped.score = mapped.weekScore;
    delete mapped.weekScore;
  }
  if (Object.hasOwn(mapped, "weekNotes")) {
    mapped.notes = mapped.weekNotes;
    delete mapped.weekNotes;
  }
  return mapped;
}

function upsertPendingResult(state, result) {
  const normalized = { ...result, team: result.team === "B" ? "B" : "A", score: Number(result.score || 0) };
  const existing = state.pendingResults.find((item) => item.memberId === normalized.memberId && item.team === normalized.team);
  if (existing) Object.assign(existing, normalized);
  else state.pendingResults.push(normalized);
}

function notifySubscribers(state) {
  const message = { type: "state_updated", updatedAt: state.updatedAt, activeEventId: state.activeEventId };
  for (const listener of subscribers) listener(message);
}

function renderMigrationReport(report = {}) {
  return `# Migration Report\n\n- Migration: ${report.migrationId || "none"}\n- Completed: ${report.completedAt || "not run"}\n- Players migrated: ${report.playersMigrated || 0}\n- Events migrated: ${report.eventsMigrated || 0}\n- Participants migrated: ${report.participantsMigrated || 0}\n- Records skipped: ${report.recordsSkipped || 0}\n- Duplicate names: ${(report.duplicateNames || []).join(", ") || "None"}\n- Missing identifiers: ${(report.missingIdentifiers || []).join(", ") || "None"}\n- Invalid values: ${(report.invalidValues || []).join(", ") || "None"}\n- Manual review: ${(report.manualReview || []).join(", ") || "None"}\n\nThe migration is idempotent and will not recreate existing event records.\n`;
}

function statusError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}
