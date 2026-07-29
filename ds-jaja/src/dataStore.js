import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { battlePhases, strategyPlans } from "../public/battle-plan.js";
import { createStarterStrategies } from "./strategyLibrary.js";
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
  normalizeAllianceWeeklyEvent,
  normalizeVsScore,
  normalizeVsWeek,
  normalizeDuelLeagueGroup,
  normalizeThemeWeek,
  normalizeTemplate,
  now,
  transitionEvent,
  validateEventForPublish
} from "./domain.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const dataDir = path.join(projectRoot, "data");
const statePath = path.join(dataDir, "state.json");
const backupPath = path.join(dataDir, "state.pre-events-v1.json");
const migrationReportPath = path.join(projectRoot, "MIGRATION_REPORT.md");
let cachedState;
const subscribers = new Set();

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
  state.updatedAt = now();
  await mkdir(dataDir, { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2), "utf8");
  notifySubscribers(state);
  return state;
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
    eventStrategy: activeEvent ? state.eventStrategies[activeEvent.id] || {} : {},
    allianceWeeklyEvents: Object.values(state.allianceWeeklyEvents)
      .filter((item) => item.active)
      .sort((left, right) => `${left.date}T${left.time}`.localeCompare(`${right.date}T${right.time}`)),
    themeWeeks: Object.values(state.themeWeeks)
      .filter((theme) => user.role !== "member" || theme.status !== "archived")
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
    dailyChatDate: localDateKey(),
    myJournal: Array.isArray(state.userJournals[user.uid]) ? state.userJournals[user.uid] : [],
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
    createdAt: now()
  };
  state.privateMessages.push(message);
  state.privateMessages = state.privateMessages.slice(-5000);
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
  for (const key of Object.keys(state.dailyChats).sort().slice(0, -7)) delete state.dailyChats[key];
  await saveState();
  return message;
}

export async function saveJournalItem(input, actor) {
  const state = await getState();
  if (!actor.playerId) throw statusError(422, "Confirm your roster profile before using the journal");
  const type = ["note", "plan", "goal"].includes(input.type) ? input.type : "note";
  const title = String(input.title || "").trim().slice(0, 120);
  const text = String(input.text || "").trim().slice(0, 4000);
  if (!title || !text) throw statusError(422, "Enter a journal title and details");
  state.userJournals[actor.uid] ||= [];
  const existing = input.id && state.userJournals[actor.uid].find((item) => item.id === input.id);
  const item = existing || {
    id: newId("journal"),
    createdAt: now()
  };
  Object.assign(item, {
    type,
    title,
    text,
    vsWeekId: type === "plan" ? String(input.vsWeekId || "") : "",
    updatedAt: now()
  });
  if (!existing) state.userJournals[actor.uid].unshift(item);
  state.userJournals[actor.uid] = state.userJournals[actor.uid].slice(0, 500);
  await saveState();
  return item;
}

export async function deleteJournalItem(itemId, actor) {
  const state = await getState();
  const journal = state.userJournals[actor.uid] ||= [];
  const index = journal.findIndex((item) => item.id === itemId);
  if (index < 0) throw statusError(404, "Journal entry was not found");
  journal.splice(index, 1);
  await saveState();
  return { deleted: true };
}

export async function scheduleLeadershipMeeting(input, actor) {
  const state = await getState();
  const category = ["strategy", "weekly"].includes(input.category) ? input.category : "";
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
  if (!["open", "voting", "archived"].includes(next.status)) throw statusError(422, "Choose a valid theme status");
  Object.assign(theme, next);
  if (Object.hasOwn(patch, "finalistIds")) {
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
  theme.submissions[actor.playerId] = {
    playerId: actor.playerId,
    text: String(input.text || "").slice(0, 4000),
    image: String(input.image || ""),
    submittedAt: now(),
    updatedAt: now()
  };
  theme.updatedAt = now();
  await saveState();
  return theme.submissions[actor.playerId];
}

export async function voteThemeWeek(themeId, finalistId, actor) {
  const state = await getState();
  const theme = state.themeWeeks[themeId];
  if (!theme || theme.status !== "voting") throw statusError(409, "Voting is not open");
  if (!actor.playerId) throw statusError(422, "Confirm your roster profile before voting");
  if (!theme.finalistIds.includes(finalistId)) throw statusError(422, "Choose a listed finalist");
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
  let user = state.users[firebaseUser.localId];
  if (!user) {
    const configuredAdmins = String(process.env.DSCC_ADMIN_UIDS || "").split(",").map((value) => value.trim()).filter(Boolean);
    const isPrimaryAdministrator = String(firebaseUser.email || "").toLowerCase() === "zacmay23@gmail.com";
    user = {
      uid: firebaseUser.localId,
      email: firebaseUser.email || "",
      displayName: firebaseUser.displayName || firebaseUser.email || "Member",
      role: configuredAdmins.includes(firebaseUser.localId) || isPrimaryAdministrator ? "administrator" : "member",
      playerId: null,
      profileConfirmedAt: null,
      profileSelection: null,
      accountPhotoUrl: firebaseUser.photoUrl || "",
      profileTitle: "Alliance Member",
      profileBio: "",
      profileSetupCompletedAt: null,
      active: true,
      createdAt: now(),
      lastLoginAt: now(),
      version: 1
    };
    state.users[user.uid] = user;
    await saveState();
  } else {
    if (String(user.email || firebaseUser.email || "").toLowerCase() === "zacmay23@gmail.com") user.role = "administrator";
    user.lastLoginAt = now();
    if (firebaseUser.photoUrl) user.accountPhotoUrl = firebaseUser.photoUrl;
  }
  return user;
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

export async function listAvailablePlayerProfiles(userId) {
  const state = await getState();
  const linkedByPlayerId = new Map(Object.values(state.users)
    .filter((user) => user.playerId)
    .map((user) => [user.playerId, user.uid]));
  const activeParticipants = state.eventParticipants[state.activeEventId] || {};
  return Object.values(state.players)
    .filter((player) => player.active)
    .map((player) => {
      const participant = activeParticipants[player.id];
      const linkedUserId = linkedByPlayerId.get(player.id) || null;
      return {
        id: player.id,
        name: player.gameName,
        rank: player.rank,
        team: participant?.team || player.defaultTeam || "Reserve",
        unit: participant?.tacticalGroup || player.defaultTacticalGroup || "Reserve",
        profileImage: player.profileImage || "",
        linkStatus: linkedUserId === userId ? "current" : linkedUserId ? "linked" : "available"
      };
    })
    .sort((left, right) =>
      ["current", "available", "linked"].indexOf(left.linkStatus) - ["current", "available", "linked"].indexOf(right.linkStatus)
      || left.name.localeCompare(right.name)
    );
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
  user.playerId = playerId;
  user.profileConfirmedAt = now();
  const participant = state.eventParticipants[state.activeEventId]?.[playerId];
  user.profileSelection = {
    playerId,
    playerName: player.gameName,
    rank: player.rank,
    team: participant?.team || player.defaultTeam || "Reserve",
    unit: participant?.tacticalGroup || player.defaultTacticalGroup || "Reserve",
    confirmedAt: user.profileConfirmedAt
  };
  user.version += 1;
  player.userId = userId;
  player.version += 1;
  player.updatedAt = now();
  addAudit(state, user, {
    action: "profile_link_confirmed",
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
  for (const field of ["gameName", "rank", "defaultRole", "defaultSelected", "defaultTeam", "defaultUnit", "defaultTacticalGroup", "active", "userId", "notes", "aliases", "profileImage", "profileImageFit", "profileImagePosition"]) {
    if (Object.hasOwn(patch, field)) player[field] = patch[field];
  }
  if (String(player.profileImage || "").length > 750000) throw statusError(422, "Profile image is too large");
  if (player.profileImage && !/^data:image\/(jpeg|png|webp|gif);base64,/.test(player.profileImage)) {
    throw statusError(422, "Choose a supported profile image");
  }
  if (Object.hasOwn(patch, "gameName")) {
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
  addAudit(state, actor, { eventId, action: "strategy_order_updated", recordType: "eventStrategy", recordId: team, field: `${input.phase}.${group}`, after: patch });
  await saveState();
  return strategy;
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
  if (actor.role !== "administrator" && user.role === "administrator") throw statusError(403, "Only an administrator can change an administrator account");
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
  const invalidScores = scores.filter((entry) => !Number.isFinite(Number(entry.score)) || Number(entry.score) < 0).map((entry) => entry.playerName);
  const result = week.dailyResults?.[date];
  const missingTeamResult = !result || (!Number(result.ourScore) && !Number(result.opponentScore));
  return {
    weekId,
    date,
    passed: !missingPlayers.length && !duplicatePlayers.length && !invalidScores.length && !missingTeamResult,
    expectedPlayers: activePlayers.length,
    submittedScores: scores.length,
    missingPlayers,
    duplicatePlayers,
    invalidScores,
    missingTeamResult,
    published: Boolean(week.publishedDays?.[date])
  };
}

export async function publishVsDay(weekId, date, actor) {
  const state = await getState();
  const audit = await auditVsDay(weekId, date);
  if (!audit.passed) throw statusError(409, "VS day cannot be published until its Administration audit passes");
  const week = state.vsWeeks[weekId];
  if (week.publishedDays?.[date]) return week.publishedDays[date];
  week.publishedDays ||= {};
  week.publishedDays[date] = {
    publishedAt: now(),
    publishedBy: actor.uid,
    audit: structuredClone(audit)
  };
  addAudit(state, actor, {
    action: "vs_day_published",
    recordType: "vsDay",
    recordId: `${weekId}:${date}`,
    after: { date, duelLeagueGroupId: week.duelLeagueGroupId, duelLeagueWeek: week.duelLeagueWeek, audit }
  });
  await saveState();
  return week.publishedDays[date];
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
  let input;
  try {
    input = JSON.parse(await readFile(statePath, "utf8"));
  } catch {
    input = { members: [], battles: [], settings: {} };
  }
  const { state, report } = migrateLegacyState(input);
  if (input.schema !== CURRENT_SCHEMA) {
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
  const { notes, ...safe } = player;
  return safe;
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
  return {
    ...theme,
    submissions,
    comments,
    tally,
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
