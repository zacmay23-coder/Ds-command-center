import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const dataDir = path.join(projectRoot, "data");
const statePath = path.join(dataDir, "state.json");

const TEAM_LIMIT = 30;
const STARTER_LIMIT = 20;
const SUB_LIMIT = 10;

const defaultState = {
  schema: "dscc-readable-v1",
  updatedAt: new Date().toISOString(),
  settings: {
    strategyA: "Standard Control & Rotation",
    strategyB: "Standard Control & Rotation"
  },
  members: [],
  users: [],
  auditLogs: [],
  pendingResults: [],
  battles: []
};

let cachedState;

export async function getState() {
  if (!cachedState) {
    cachedState = await loadState();
  }

  return cachedState;
}

export async function replaceState(nextState) {
  cachedState = normalizeState(nextState);
  return saveState();
}

export async function saveState() {
  const state = await getState();
  state.updatedAt = new Date().toISOString();
  await mkdir(dataDir, { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2), "utf8");
  return state;
}

export async function updateMember(memberId, patch) {
  const state = await getState();
  const member = state.members.find((item) => item.id === memberId);

  if (!member) {
    throw new Error(`Member ${memberId} was not found`);
  }

  assertVersion(member, patch?.expectedVersion);
  const nextMember = { ...member, ...pickMemberFields(patch) };
  nextMember.name = String(nextMember.name).trim();
  validateMemberName(nextMember.name, state, memberId);
  validateRosterCapacity(state, member, nextMember);
  Object.assign(member, nextMember);
  member.version = Number(member.version || 0) + 1;
  member.updatedAt = new Date().toISOString();

  for (const result of state.pendingResults) {
    if (result.memberId === memberId) result.name = member.name;
  }

  return saveState();
}

export async function ensureUser(firebaseUser, displayName = "", initialRole = "member") {
  const state = await getState();
  const uid = String(firebaseUser.localId || firebaseUser.uid || "");
  let user = state.users.find((item) => item.uid === uid);
  const now = new Date().toISOString();

  if (!user) {
    user = {
      uid,
      email: String(firebaseUser.email || ""),
      displayName: String(displayName || firebaseUser.displayName || firebaseUser.email || "").trim(),
      role: ["member", "officer", "administrator"].includes(initialRole) ? initialRole : "member",
      playerId: "",
      active: true,
      createdAt: now,
      lastLoginAt: now
    };
    state.users.push(user);
    await saveState();
  } else if (initialRole === "administrator" && user.role !== "administrator") {
    user.role = "administrator";
    user.active = true;
    user.lastLoginAt = now;
    await saveState();
  } else if (displayName && !user.displayName) {
    user.displayName = String(displayName).trim();
    user.lastLoginAt = now;
    await saveState();
  } else if (!user.lastLoginAt || Date.now() - Date.parse(user.lastLoginAt) > 60 * 60 * 1000) {
    user.lastLoginAt = now;
    await saveState();
  }

  return user;
}

export async function updateUser(userId, patch, actor) {
  const state = await getState();
  const user = state.users.find((item) => item.uid === userId);
  if (!user) throw new Error("User record was not found");

  const nextRole = Object.hasOwn(patch || {}, "role") ? String(patch.role) : user.role;
  if (!["member", "officer", "administrator"].includes(nextRole)) {
    throw new Error("Choose a valid application role");
  }
  const playerId = Object.hasOwn(patch || {}, "playerId") ? String(patch.playerId || "") : user.playerId;
  if (playerId && !state.members.some((member) => member.id === playerId)) {
    throw new Error("Choose a valid player record");
  }
  if (playerId && state.users.some((item) => item.uid !== userId && item.playerId === playerId)) {
    throw new Error("That player record is already linked to another user");
  }

  Object.assign(user, pick(patch, ["displayName", "active"]), { role: nextRole, playerId });
  addAuditLog(state, actor, "user.updated", { userId, role: nextRole, playerId });
  return saveState();
}

export async function linkOwnPlayer(userId, playerId) {
  const state = await getState();
  const user = state.users.find((item) => item.uid === userId);
  if (!user) throw new Error("User record was not found");
  if (user.playerId) throw new Error("Your account is already linked. Contact an administrator to change it.");

  const member = state.members.find((item) => item.id === String(playerId || ""));
  if (!member) throw new Error("Choose a valid roster profile");
  if (state.users.some((item) => item.uid !== userId && item.playerId === member.id)) {
    throw new Error("That roster profile is already linked to another account");
  }

  user.playerId = member.id;
  addAuditLog(state, user, "user.player-linked", { userId, playerId: member.id });
  await saveState();
  return user;
}

export async function updateOwnAvailability(user, patch, expectedVersion) {
  const state = await getState();
  if (!user.playerId) throw new Error("Your account is not linked to a player record");
  const member = state.members.find((item) => item.id === user.playerId);
  if (!member) throw new Error("Your linked player record was not found");
  assertVersion(member, expectedVersion);

  Object.assign(member, pick(patch, ["availability", "availabilityNote"]));
  member.version = Number(member.version || 0) + 1;
  member.updatedAt = new Date().toISOString();
  return saveState();
}

export async function addMember(input) {
  const state = await getState();
  const name = String(input?.name || "").trim();
  validateMemberName(name, state);
  state.members.push(normalizeMember({
    id: `member-${randomUUID()}`,
    name,
    rank: String(input?.rank || "").trim()
  }));
  return saveState();
}

export async function deleteMember(memberId) {
  const state = await getState();
  const index = state.members.findIndex((member) => member.id === memberId);
  if (index < 0) throw new Error(`Member ${memberId} was not found`);
  state.members.splice(index, 1);
  state.pendingResults = state.pendingResults.filter((result) => result.memberId !== memberId);
  return saveState();
}

export async function updateSettings(patch) {
  const state = await getState();
  state.settings = {
    ...state.settings,
    ...pick(patch, ["strategyA", "strategyB"])
  };

  return saveState();
}

export async function applyResultScreenshotMatches(matches, team) {
  const state = await getState();
  const resultTeam = normalizeTeam(team);

  for (const match of matches) {
    const member = state.members.find((item) => item.id === match.memberId);
    if (!member) continue;

    upsertPendingResult(state, {
      memberId: member.id,
      name: member.name,
      rank: member.rank,
      team: resultTeam,
      score: match.score,
      attendance: "Present",
      notes: "Imported from results screenshot",
      sourceLine: match.sourceLine
    });
  }

  return saveState();
}

export async function applyResultMatchFix(fix) {
  const state = await getState();
  const member = state.members.find((item) => item.id === fix.memberId);
  const resultTeam = normalizeTeam(fix.team);

  if (!member) {
    throw new Error("Choose a valid roster member for this result");
  }

  upsertPendingResult(state, {
    memberId: member.id,
    name: member.name,
    rank: member.rank,
    team: resultTeam,
    score: fix.score,
    attendance: "Present",
    notes: "Imported from screenshot match fix",
    sourceLine: fix.alias || fix.ocrName || fix.sourceLine
  });
  addAlias(member, fix.alias || fix.ocrName || fix.sourceLine);
  return saveState();
}

export async function resetWeek() {
  const state = await getState();

  for (const member of state.members) {
    member.selected = false;
    member.team = "Reserve";
    member.type = "Sub";
    member.unit = "Unassigned";
    member.availability = "Pending";
    member.weekScore = 0;
    member.weekAttendance = "";
    member.weekNotes = "";
  }
  state.pendingResults = [];

  return saveState();
}

export async function archiveBattle(payload) {
  const state = await getState();
  const selectedMembers = state.members.filter((member) => member.selected);
  const selectedPlayers = selectedMembers.map((member) => ({
    id: member.id,
    name: member.name,
    rank: member.rank,
    team: member.team,
    type: member.type,
    unit: member.unit,
    availability: member.availability,
    attendance: member.weekAttendance || "",
    score: Number(member.weekScore || 0),
    notes: member.weekNotes || "",
    source: "manual",
    countedInStats: true
  }));
  const selectedIds = new Set(selectedMembers.map((member) => member.id));
  const importedPlayers = state.pendingResults.map((result) => ({
    id: result.memberId,
    name: result.name,
    rank: result.rank,
    team: result.team,
    type: "",
    unit: "",
    availability: "",
    attendance: result.attendance || "Present",
    score: Number(result.score || 0),
    notes: result.notes || "",
    source: "screenshot",
    countedInStats: selectedIds.has(result.memberId)
  }));
  const importedIds = new Set(importedPlayers.map((player) => player.id));
  const players = [
    ...importedPlayers,
    ...selectedPlayers.filter((player) => !importedIds.has(player.id))
  ];

  if (!players.length) {
    throw new Error("Import results or select players before archiving a battle");
  }

  const battle = {
    id: `battle-${Date.now()}`,
    date: payload.date || new Date().toISOString().slice(0, 10),
    opponent: payload.opponent || "Unknown opponent",
    outcome: payload.outcome || "Undecided",
    scoreFor: Number(payload.scoreFor || 0),
    scoreAgainst: Number(payload.scoreAgainst || 0),
    notes: payload.notes || "",
    strategyA: state.settings.strategyA,
    strategyB: state.settings.strategyB,
    players
  };

  for (const member of selectedMembers) {
    member.weeks = Number(member.weeks || 0) + 1;
    if (member.availability === "Confirmed") member.confirmed = Number(member.confirmed || 0) + 1;
    if (["Present", "Late"].includes(member.weekAttendance)) member.attended = Number(member.attended || 0) + 1;
    if (member.weekAttendance === "No-show") member.noShows = Number(member.noShows || 0) + 1;
    member.weekScore = 0;
    member.weekAttendance = "";
    member.weekNotes = "";
  }

  state.battles.unshift(battle);
  state.pendingResults = [];
  return saveState();
}

export async function deleteBattle(battleId) {
  const state = await getState();
  const index = state.battles.findIndex((battle) => battle.id === battleId);
  if (index < 0) throw new Error(`Archived battle ${battleId} was not found`);

  const [battle] = state.battles.splice(index, 1);
  for (const player of battle.players || []) {
    const countedInStats = player.countedInStats ?? player.source !== "screenshot";
    if (!countedInStats) continue;
    const member = state.members.find((item) => item.id === player.id);
    if (!member) continue;

    member.weeks = Math.max(0, Number(member.weeks || 0) - 1);
    if (player.availability === "Confirmed") {
      member.confirmed = Math.max(0, Number(member.confirmed || 0) - 1);
    }
    if (["Present", "Late"].includes(player.attendance)) {
      member.attended = Math.max(0, Number(member.attended || 0) - 1);
    }
    if (player.attendance === "No-show") {
      member.noShows = Math.max(0, Number(member.noShows || 0) - 1);
    }
  }

  return saveState();
}

function normalizeState(input) {
  const state = {
    ...defaultState,
    ...input,
    settings: {
      ...defaultState.settings,
      ...(input?.settings || {})
    },
    members: Array.isArray(input?.members) ? input.members.map(normalizeMember) : [],
    users: Array.isArray(input?.users) ? input.users.map(normalizeUser) : [],
    auditLogs: Array.isArray(input?.auditLogs) ? input.auditLogs : [],
    pendingResults: Array.isArray(input?.pendingResults) ? input.pendingResults.map(normalizePendingResult) : [],
    battles: Array.isArray(input?.battles) ? input.battles : []
  };

  return state;
}

async function loadState() {
  try {
    const raw = await readFile(statePath, "utf8");
    return normalizeState(JSON.parse(raw));
  } catch {
    await mkdir(dataDir, { recursive: true });
    await writeFile(statePath, JSON.stringify(defaultState, null, 2), "utf8");
    return structuredClone(defaultState);
  }
}

function normalizeMember(member) {
  return {
    id: String(member.id),
    name: String(member.name || "Unnamed member"),
    rank: String(member.rank || ""),
    selected: Boolean(member.selected),
    team: member.team || "Reserve",
    type: member.type || "Sub",
    unit: member.unit || "Unassigned",
    availability: member.availability || "Pending",
    availabilityNote: String(member.availabilityNote || ""),
    version: Number(member.version || 0),
    updatedAt: member.updatedAt || "",
    weeks: Number(member.weeks || 0),
    confirmed: Number(member.confirmed || 0),
    attended: Number(member.attended || 0),
    noShows: Number(member.noShows || 0),
    aliases: Array.isArray(member.aliases) ? member.aliases.map(String) : [],
    weekScore: Number(member.weekScore || 0),
    weekAttendance: member.weekAttendance || "",
    weekNotes: member.weekNotes || ""
  };
}

function addAlias(member, alias) {
  const cleaned = String(alias || "").trim();
  if (!cleaned) return;

  member.aliases = Array.isArray(member.aliases) ? member.aliases : [];
  const exists = member.aliases.some((item) => item.toLowerCase() === cleaned.toLowerCase());

  if (!exists && cleaned.toLowerCase() !== member.name.toLowerCase()) {
    member.aliases.push(cleaned);
  }
}

function normalizePendingResult(result) {
  return {
    memberId: String(result.memberId || result.id || ""),
    name: String(result.name || "Unknown player"),
    rank: String(result.rank || ""),
    team: normalizeTeam(result.team),
    score: Number(result.score || 0),
    attendance: result.attendance || "Present",
    notes: result.notes || "",
    sourceLine: result.sourceLine || ""
  };
}

function upsertPendingResult(state, result) {
  state.pendingResults = Array.isArray(state.pendingResults) ? state.pendingResults : [];
  const normalized = normalizePendingResult(result);
  const existing = state.pendingResults.find((item) => item.memberId === normalized.memberId && item.team === normalized.team);

  if (existing) {
    Object.assign(existing, normalized);
  } else {
    state.pendingResults.push(normalized);
  }
}

function normalizeTeam(team) {
  return team === "B" ? "B" : "A";
}

function pickMemberFields(patch) {
  return pick(patch, [
    "name",
    "selected",
    "team",
    "type",
    "unit",
    "availability",
    "availabilityNote",
    "weekScore",
    "weekAttendance",
    "weekNotes"
  ]);
}

function normalizeUser(user) {
  return {
    uid: String(user.uid || ""),
    email: String(user.email || ""),
    displayName: String(user.displayName || ""),
    role: ["member", "officer", "administrator"].includes(user.role) ? user.role : "member",
    playerId: String(user.playerId || ""),
    active: user.active !== false,
    createdAt: user.createdAt || new Date().toISOString(),
    lastLoginAt: user.lastLoginAt || ""
  };
}

function assertVersion(record, expectedVersion) {
  if (expectedVersion === undefined || expectedVersion === null) return;
  if (Number(expectedVersion) !== Number(record.version || 0)) {
    const error = new Error("This record changed after you loaded it. Review the latest value and retry.");
    error.code = "EDIT_CONFLICT";
    throw error;
  }
}

function addAuditLog(state, actor, action, details) {
  state.auditLogs.unshift({
    id: `audit-${randomUUID()}`,
    actorUid: actor?.uid || actor?.localId || "",
    action,
    details,
    createdAt: new Date().toISOString()
  });
  state.auditLogs = state.auditLogs.slice(0, 1000);
}

function validateMemberName(value, state, currentMemberId = "") {
  const name = String(value || "").trim();
  if (!name) throw new Error("Member name is required");
  if (name.length > 80) throw new Error("Member name must be 80 characters or fewer");
  const duplicate = state.members.some(
    (member) => member.id !== currentMemberId && member.name.trim().toLowerCase() === name.toLowerCase()
  );
  if (duplicate) throw new Error("A member with that name already exists");
}

function pick(source, allowedFields) {
  const output = {};

  for (const field of allowedFields) {
    if (Object.hasOwn(source || {}, field)) {
      output[field] = source[field];
    }
  }

  return output;
}

function validateRosterCapacity(state, currentMember, nextMember) {
  if (!nextMember.selected || nextMember.team === "Reserve") {
    return;
  }

  const teamMembers = state.members.filter((member) => {
    if (member.id === currentMember.id) return false;
    return member.selected && member.team === nextMember.team;
  });

  const total = teamMembers.length + 1;
  const starters = teamMembers.filter((member) => member.type === "Starter").length + (nextMember.type === "Starter" ? 1 : 0);
  const subs = teamMembers.filter((member) => member.type === "Sub").length + (nextMember.type === "Sub" ? 1 : 0);

  if (total > TEAM_LIMIT) {
    throw new Error(`Team ${nextMember.team} is limited to ${TEAM_LIMIT} players`);
  }

  if (starters > STARTER_LIMIT) {
    throw new Error(`Team ${nextMember.team} is limited to ${STARTER_LIMIT} starters`);
  }

  if (subs > SUB_LIMIT) {
    throw new Error(`Team ${nextMember.team} is limited to ${SUB_LIMIT} substitutes`);
  }
}
