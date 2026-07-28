import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { battlePhases, strategyPlans } from "../public/battle-plan.js";
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
      secondaryAction: order.secondaryObjective ? "Support" : "Hold"
    }]));
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
    pendingResults: user.role === "member" ? [] : state.pendingResults,
    permissions: permissionsFor(user)
  };
}

export async function getOrCreateUser(firebaseUser) {
  const state = await getState();
  let user = state.users[firebaseUser.localId];
  if (!user) {
    const configuredAdmins = String(process.env.DSCC_ADMIN_UIDS || "").split(",").map((value) => value.trim()).filter(Boolean);
    user = {
      uid: firebaseUser.localId,
      email: firebaseUser.email || "",
      displayName: firebaseUser.displayName || firebaseUser.email || "Member",
      role: configuredAdmins.includes(firebaseUser.localId) ? "administrator" : "member",
      playerId: null,
      active: true,
      createdAt: now(),
      lastLoginAt: now(),
      version: 1
    };
    state.users[user.uid] = user;
    await saveState();
  } else {
    user.lastLoginAt = now();
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

export async function updateEvent(eventId, patch, actor) {
  const state = await getState();
  const event = state.events[eventId];
  if (!event) throw statusError(404, "Event was not found");
  assertVersion(event, patch.version);
  const allowed = [
    "date", "opponent", "strategyA", "strategyB", "battleTimeA", "battleTimeB",
    "scoreFor", "scoreAgainst", "outcome", "notes", "importantInstructions", "debrief"
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
  assertVersion(participant, patch.version);
  const ownFields = ["availability", "availabilityNote"];
  const officerFields = [
    "selected", "team", "rosterStatus", "availability", "availabilityNote",
    "availabilityOverride", "role", "unit", "tacticalGroup", "mapPosition", "primaryAssignment",
    "backupAssignment", "primaryUnit", "rotationUnit", "openingObjective",
    "midBattleObjective", "finalObjective", "attendance", "score", "notes", "officerNotes"
  ];
  const before = structuredClone(participant);
  const fields = selfOnly ? ownFields : officerFields;
  for (const field of fields) if (Object.hasOwn(patch, field)) participant[field] = patch[field];
  if (Object.hasOwn(patch, "score")) participant.score = Number(patch.score || 0);
  if (Object.hasOwn(patch, "availability")) {
    participant.confirmedAt = patch.availability === "Confirmed" ? now() : null;
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

export async function listAvailablePlayerProfiles() {
  const state = await getState();
  const linkedIds = new Set(Object.values(state.users).map((user) => user.playerId).filter(Boolean));
  return Object.values(state.players)
    .filter((player) => player.active && !linkedIds.has(player.id))
    .map((player) => ({ id: player.id, name: player.gameName }));
}

export async function linkOwnPlayer(userId, playerId) {
  const state = await getState();
  const user = state.users[userId];
  const player = state.players[playerId];
  if (!user || !player) throw statusError(404, "Account or player profile was not found");
  if (user.playerId) throw statusError(409, "This account is already linked to a player");
  if (Object.values(state.users).some((item) => item.uid !== userId && item.playerId === playerId)) {
    throw statusError(409, "That player is already linked to another account");
  }
  user.playerId = playerId;
  user.version += 1;
  player.userId = userId;
  player.version += 1;
  player.updatedAt = now();
  await saveState();
  return user;
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
  for (const field of ["gameName", "rank", "defaultRole", "defaultUnit", "active", "userId", "notes", "aliases"]) {
    if (Object.hasOwn(patch, field)) player[field] = patch[field];
  }
  player.updatedAt = now();
  player.version += 1;
  auditDiff(state, actor, null, "player", playerId, before, player, "player_updated");
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
  const allowedGroups = ["Unit A", "Unit B", "Unit C", "Unit D", "Strike Team", "Scout + Support", "Reserve"];
  if (!allowedGroups.includes(group)) throw statusError(422, "Choose a valid tactical group");
  const allowedFields = ["primaryObjective", "secondaryObjective", "primaryAction", "secondaryAction"];
  const patch = Object.fromEntries(Object.entries(input.patch || {}).filter(([field]) => allowedFields.includes(field)));
  const objectives = ["", "Info Center", "Field Hospital 4", "Arsenal", "Oil Refinery 1", "Field Hospital 2", "Nuclear Silo", "Field Hospital 1", "Oil Refinery 2", "Mercenary Factory", "Field Hospital 3", "Science Hub"];
  const actions = ["Secure", "Support", "Rotate", "Attack", "Contest", "Hold", "Defend"];
  for (const [field, value] of Object.entries(patch)) {
    if (field.endsWith("Objective") && !objectives.includes(value)) throw statusError(422, "Choose an objective from the battle map");
    if (field.endsWith("Action") && !actions.includes(value)) throw statusError(422, "Choose a supported strategy action");
  }
  let phase = strategy.phases.find((item) => Number(item.startMinute) === startMinute);
  if (!phase) {
    phase = { id: `phase-${startMinute}-${endMinute}`, name: `Battle phase ${startMinute}–${endMinute}`, startMinute, endMinute, instructions: "", fallbackPlan: "", groupOrders: {} };
    strategy.phases.push(phase);
  }
  phase.groupOrders ||= {};
  phase.groupOrders[group] = { ...(phase.groupOrders[group] || {}), ...patch };
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
  if (Object.hasOwn(patch, "role")) user.role = patch.role;
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
    availability: participant?.availability === "Unavailable" ? "Not available" : participant?.availability || "Pending",
    aliases: player.aliases,
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
