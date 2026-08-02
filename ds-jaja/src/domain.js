import { randomUUID } from "node:crypto";
import { normalizeRole, ROLES } from "./permissions.js";
import { EVENT_STATUSES, SERVER_TIMES, UNITS, validateEventForPublish, validatePhases } from "./validation.js";

export const CURRENT_SCHEMA = "dscc-events-v3";
export const MIGRATION_ID = "legacy-weekly-to-events-v1";
const TACTICAL_GROUPS = ["Unit A", "Unit B", "Unit C", "Unit D", "Strike Team", "Scout + Support", "Disrupters", "Reserve"];

export function newId(prefix) {
  return `${prefix}-${randomUUID()}`;
}

export function now() {
  return new Date().toISOString();
}

export function migrateLegacyState(input, actor = {}) {
  if (input?.schema === CURRENT_SCHEMA) return { state: normalizeState(input), report: input.migrations?.[MIGRATION_ID]?.report };

  const timestamp = now();
  const legacyMembers = Array.isArray(input?.members) ? input.members : [];
  const players = Object.fromEntries(legacyMembers.map((member) => [String(member.id), {
    id: String(member.id),
    gameName: String(member.name || "Unnamed player"),
    rank: String(member.rank || ""),
    defaultRole: member.type || "Sub",
    defaultSelected: Boolean(member.selected),
    defaultTeam: ["A", "B"].includes(member.team) ? member.team : "Reserve",
    defaultUnit: UNITS.includes(member.unit) ? member.unit : "Unassigned",
    defaultTacticalGroup: TACTICAL_GROUPS.includes(member.unit) ? member.unit : "Reserve",
    active: true,
    userId: null,
    notes: "",
    aliases: Array.isArray(member.aliases) ? member.aliases : [],
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1
  }]));
  const events = {};
  const eventParticipants = {};
  const legacyBattles = Array.isArray(input?.battles) ? input.battles : [];

  for (const battle of legacyBattles) {
    const eventId = stableLegacyEventId(battle.id || `${battle.date}-${battle.opponent}`);
    events[eventId] = normalizeEvent({
      ...battle,
      id: eventId,
      status: "archived",
      createdAt: battle.createdAt || timestamp,
      updatedAt: battle.updatedAt || timestamp,
      completedAt: battle.completedAt || timestamp
    });
    eventParticipants[eventId] = {};
    for (const record of battle.players || []) {
      const playerId = String(record.id || "");
      if (!players[playerId]) continue;
      eventParticipants[eventId][playerId] = normalizeParticipant({
        ...record,
        eventId,
        playerId,
        playerName: record.name || players[playerId].gameName,
        selected: true,
        rosterStatus: record.type,
        role: record.type,
        primaryAssignment: record.unit
      });
    }
  }

  const currentSelected = legacyMembers.filter((member) => member.selected);
  let activeEventId = null;
  if (currentSelected.length || !legacyBattles.length) {
    activeEventId = stableLegacyEventId("current-week");
    events[activeEventId] = normalizeEvent({
      id: activeEventId,
      date: new Date().toISOString().slice(0, 10),
      opponent: "",
      status: "draft",
      strategyA: input?.settings?.strategyA,
      strategyB: input?.settings?.strategyB,
      battleTimeA: input?.settings?.battleTimeA,
      battleTimeB: input?.settings?.battleTimeB,
      createdAt: timestamp,
      createdBy: actor.uid || "migration",
      updatedAt: timestamp
    });
    eventParticipants[activeEventId] = Object.fromEntries(legacyMembers.map((member) => [String(member.id), normalizeParticipant({
      eventId: activeEventId,
      playerId: String(member.id),
      playerName: member.name,
      selected: Boolean(member.selected),
      team: member.team,
      rosterStatus: member.type,
      availability: normalizeAvailability(member.availability),
      role: member.type,
      unit: member.unit,
      tacticalGroup: TACTICAL_GROUPS.includes(member.unit) ? member.unit : "Reserve",
      primaryAssignment: member.unit,
      attendance: member.weekAttendance,
      score: member.weekScore,
      notes: member.weekNotes
    })]));
  }

  const duplicateNames = duplicatePlayerNames(Object.values(players));
  const report = {
    migrationId: MIGRATION_ID,
    completedAt: timestamp,
    playersMigrated: Object.keys(players).length,
    eventsMigrated: Object.keys(events).length,
    participantsMigrated: Object.values(eventParticipants).reduce((sum, entries) => sum + Object.keys(entries).length, 0),
    recordsSkipped: 0,
    duplicateNames,
    missingIdentifiers: legacyMembers.filter((member) => !member.id).map((member) => member.name),
    invalidValues: [],
    manualReview: duplicateNames.length ? ["Review duplicate player names"] : []
  };

  return {
    state: normalizeState({
      schema: CURRENT_SCHEMA,
      updatedAt: timestamp,
      users: input?.users || {},
      players,
      events,
      eventParticipants,
      activeEventId,
      strategyTemplates: input?.strategyTemplates || defaultStrategyTemplates(timestamp),
      eventStrategies: input?.eventStrategies || {},
      strategyVersions: input?.strategyVersions || {},
      auditLogs: input?.auditLogs || {},
      pendingResults: input?.pendingResults || [],
      vsScores: input?.vsScores || [],
      vsWeeks: input?.vsWeeks || {},
      duelLeagueGroups: input?.duelLeagueGroups || {},
      privateMessages: input?.privateMessages || [],
      dailyChats: input?.dailyChats || {},
      userJournals: input?.userJournals || {},
      userGoals: input?.userGoals || {},
      userAchievements: input?.userAchievements || {},
      achievementDefinitions: input?.achievementDefinitions || {},
      privateMigrationBackups: input?.privateMigrationBackups || {},
      privateDataQuarantine: input?.privateDataQuarantine || {},
      leadership: input?.leadership || { meetings: {}, posts: [], requests: [] },
      systemSettings: input?.systemSettings || { invitationCodes: [] },
      migrations: { ...(input?.migrations || {}), [MIGRATION_ID]: { completedAt: timestamp, report } }
    }),
    report
  };
}

export function normalizeState(input = {}) {
  return {
    schema: CURRENT_SCHEMA,
    updatedAt: input.updatedAt || now(),
    users: objectMap(input.users, normalizeUser),
    players: objectMap(input.players, normalizePlayer),
    events: objectMap(input.events, normalizeEvent),
    eventParticipants: nestedObjectMap(input.eventParticipants, normalizeParticipant),
    activeEventId: input.activeEventId || newestEditableEventId(input.events),
    strategyTemplates: objectMap(input.strategyTemplates, normalizeTemplate),
    eventStrategies: input.eventStrategies || {},
    strategyVersions: input.strategyVersions || {},
    auditLogs: input.auditLogs || {},
    pendingResults: Array.isArray(input.pendingResults) ? input.pendingResults : [],
    vsScores: Array.isArray(input.vsScores) ? input.vsScores.map(normalizeVsScore) : [],
    vsWeeks: objectMap(input.vsWeeks, normalizeVsWeek),
    duelLeagueGroups: objectMap(input.duelLeagueGroups, normalizeDuelLeagueGroup),
    allianceWeeklyEvents: objectMap(input.allianceWeeklyEvents, normalizeAllianceWeeklyEvent),
    themeWeeks: objectMap(input.themeWeeks, normalizeThemeWeek),
    memberNotices: Array.isArray(input.memberNotices) ? input.memberNotices : [],
    officerQuestions: Array.isArray(input.officerQuestions) ? input.officerQuestions : [],
    announcements: Array.isArray(input.announcements) ? input.announcements : [],
    privateMessages: Array.isArray(input.privateMessages) ? input.privateMessages : [],
    dailyChats: input.dailyChats && typeof input.dailyChats === "object" ? input.dailyChats : {},
    userJournals: input.userJournals && typeof input.userJournals === "object" ? input.userJournals : {},
    userGoals: input.userGoals && typeof input.userGoals === "object" ? input.userGoals : {},
    userAchievements: input.userAchievements && typeof input.userAchievements === "object" ? input.userAchievements : {},
    achievementDefinitions: input.achievementDefinitions && typeof input.achievementDefinitions === "object" ? input.achievementDefinitions : {},
    privateMigrationBackups: input.privateMigrationBackups && typeof input.privateMigrationBackups === "object" ? input.privateMigrationBackups : {},
    privateDataQuarantine: input.privateDataQuarantine && typeof input.privateDataQuarantine === "object" ? input.privateDataQuarantine : {},
    leadership: input.leadership && typeof input.leadership === "object" ? input.leadership : { meetings: {}, posts: [], requests: [] },
    systemSettings: input.systemSettings || { invitationCodes: [] },
    migrations: input.migrations || {}
  };
}

export function normalizeVsScore(entry = {}) {
  return {
    id: String(entry.id || newId("vs-score")),
    date: entry.date || new Date().toISOString().slice(0, 10),
    vsWeekId: String(entry.vsWeekId || ""),
    playerId: String(entry.playerId || entry.memberId || ""),
    playerName: String(entry.playerName || entry.name || ""),
    score: Math.max(0, Number(entry.score || 0)),
    source: entry.source === "screenshot" ? "screenshot" : "manual",
    sourceLine: String(entry.sourceLine || ""),
    createdAt: entry.createdAt || now(),
    createdBy: String(entry.createdBy || ""),
    updatedAt: entry.updatedAt || now()
  };
}

export function normalizeVsWeek(week = {}) {
  const beginDate = week.beginDate || new Date().toISOString().slice(0, 10);
  return {
    id: String(week.id || newId("vs-week")),
    beginDate,
    opponent: String(week.opponent || ""),
    server: String(week.server || ""),
    opponentMembers: Math.max(0, Number(week.opponentMembers || 0)),
    duelLeagueGroupId: String(week.duelLeagueGroupId || ""),
    duelLeagueWeek: Math.min(4, Math.max(1, Number(week.duelLeagueWeek || 1))),
    dailyResults: typeof week.dailyResults === "object" && week.dailyResults ? week.dailyResults : {},
    publishedDays: typeof week.publishedDays === "object" && week.publishedDays ? week.publishedDays : {},
    standings: Array.isArray(week.standings) ? week.standings.map((row, index) => ({
      rank: Math.max(1, Number(row.rank || index + 1)),
      alliance: String(row.alliance || ""),
      weeks: Array.from({ length: 4 }, (_, weekIndex) => ["W", "L"].includes(row.weeks?.[weekIndex]) ? row.weeks[weekIndex] : "")
    })) : [],
    active: week.active !== false,
    createdAt: week.createdAt || now(),
    createdBy: String(week.createdBy || ""),
    updatedAt: week.updatedAt || now()
  };
}

export function normalizeDuelLeagueGroup(group = {}) {
  return {
    id: String(group.id || newId("duel-group")),
    code: String(group.code || "").trim().toUpperCase(),
    rankings: Array.isArray(group.rankings) ? group.rankings.map((row, index) => ({
      rank: Math.max(1, Number(row.rank || index + 1)),
      alliance: String(row.alliance || row.teamName || ""),
      server: String(row.server || "")
    })) : [],
    archived: Boolean(group.archived),
    createdAt: group.createdAt || now(),
    createdBy: String(group.createdBy || ""),
    updatedAt: group.updatedAt || now()
  };
}

export function normalizeAllianceWeeklyEvent(event = {}) {
  return {
    id: String(event.id || newId("alliance-event")),
    name: String(event.name || "MG"),
    date: event.date || new Date().toISOString().slice(0, 10),
    time: String(event.time || "00:00"),
    overview: String(event.overview || ""),
    active: event.active !== false,
    createdAt: event.createdAt || now(),
    createdBy: event.createdBy || "",
    updatedAt: event.updatedAt || now()
  };
}

export function normalizeThemeWeek(theme = {}) {
  return {
    id: String(theme.id || newId("theme")),
    title: String(theme.title || "Theme Week"),
    weekOf: theme.weekOf || new Date().toISOString().slice(0, 10),
    description: String(theme.description || ""),
    rules: String(theme.rules || ""),
    status: ["open", "finalists", "voting", "finalized", "archived"].includes(theme.status) ? theme.status : "open",
    finalistIds: Array.isArray(theme.finalistIds) ? theme.finalistIds : [],
    submissions: theme.submissions || {},
    votes: theme.votes || {},
    comments: Array.isArray(theme.comments) ? theme.comments : [],
    acknowledgements: theme.acknowledgements || {},
    createdAt: theme.createdAt || now(),
    createdBy: theme.createdBy || "",
    updatedAt: theme.updatedAt || now()
  };
}

export function normalizeUser(user = {}) {
  return {
    uid: String(user.uid || ""),
    email: String(user.email || ""),
    displayName: String(user.displayName || user.email || "Member"),
    role: normalizeRole(user.role),
    playerId: user.playerId ? String(user.playerId) : null,
    profileConfirmedAt: user.profileConfirmedAt || null,
    profileSelection: user.profileSelection || null,
    accountPhotoUrl: user.accountPhotoUrl || "",
    profileTitle: user.profileTitle || "Alliance Member",
    profileBio: user.profileBio || "",
    profileSetupCompletedAt: user.profileSetupCompletedAt || null,
    active: user.active !== false,
    createdAt: user.createdAt || now(),
    lastLoginAt: user.lastLoginAt || null,
    version: Number(user.version || 1)
  };
}

export function normalizePlayer(player = {}) {
  return {
    id: String(player.id || ""),
    gameName: String(player.gameName || player.name || "Unnamed player"),
    rank: String(player.rank || ""),
    defaultRole: player.defaultRole || "Sub",
    defaultSelected: Boolean(player.defaultSelected),
    defaultTeam: ["A", "B"].includes(player.defaultTeam) ? player.defaultTeam : "Reserve",
    defaultUnit: UNITS.includes(player.defaultUnit) ? player.defaultUnit : "Unassigned",
    defaultTacticalGroup: TACTICAL_GROUPS.includes(player.defaultTacticalGroup) ? player.defaultTacticalGroup : "Reserve",
    active: player.active !== false,
    userId: player.userId || null,
    notes: player.notes || "",
    availabilityGuidance: player.availabilityGuidance || "",
    profileImage: player.profileImage || "",
    profileImageFit: ["cover", "contain"].includes(player.profileImageFit) ? player.profileImageFit : "cover",
    profileImagePosition: ["center", "top", "bottom", "left", "right"].includes(player.profileImagePosition) ? player.profileImagePosition : "center",
    aliases: Array.isArray(player.aliases) ? player.aliases : [],
    previousPlayerNames: Array.isArray(player.previousPlayerNames) ? player.previousPlayerNames : [],
    thp: Number.isFinite(Number(player.thp)) && Number(player.thp) >= 0 ? Number(player.thp) : 0,
    thpUpdatedAt: player.thpUpdatedAt || null,
    thpUpdatedBy: player.thpUpdatedBy || null,
    thpVerifiedAt: player.thpVerifiedAt || null,
    thpVerifiedBy: player.thpVerifiedBy || null,
    createdAt: player.createdAt || now(),
    updatedAt: player.updatedAt || now(),
    version: Number(player.version || 1)
  };
}

export function normalizePlayerName(value = "") {
  return String(value)
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-US")
    .replace(/[\p{P}\p{S}\s]+/gu, "");
}

export function normalizeEvent(event = {}) {
  return {
    id: String(event.id || newId("event")),
    date: event.date || new Date().toISOString().slice(0, 10),
    opponent: event.opponent || "",
    status: EVENT_STATUSES.includes(event.status) ? event.status : "draft",
    strategyA: event.strategyA || "Standard Control & Rotation",
    strategyB: event.strategyB || "Standard Control & Rotation",
    battleTimeA: SERVER_TIMES.includes(event.battleTimeA) ? event.battleTimeA : "9:00",
    battleTimeB: SERVER_TIMES.includes(event.battleTimeB) ? event.battleTimeB : "9:00",
    scoreFor: Number(event.scoreFor || 0),
    scoreAgainst: Number(event.scoreAgainst || 0),
    outcome: event.outcome || "Undecided",
    notes: event.notes || "",
    importantInstructions: event.importantInstructions || "",
    debrief: event.debrief || {},
    createdAt: event.createdAt || now(),
    createdBy: event.createdBy || "",
    updatedAt: event.updatedAt || now(),
    updatedBy: event.updatedBy || "",
    publishedAt: event.publishedAt || null,
    publishedBy: event.publishedBy || null,
    completedAt: event.completedAt || null,
    archivedAt: event.archivedAt || null,
    setupPublishedAt: event.setupPublishedAt || null,
    scheduleChange: event.scheduleChange && typeof event.scheduleChange === "object" ? event.scheduleChange : null,
    version: Number(event.version || 1)
  };
}

export function normalizeParticipant(participant = {}) {
  return {
    eventId: String(participant.eventId || ""),
    playerId: String(participant.playerId || participant.id || ""),
    playerName: String(participant.playerName || participant.name || ""),
    selected: Boolean(participant.selected),
    team: ["A", "B"].includes(participant.team) ? participant.team : "Reserve",
    rosterStatus: participant.rosterStatus || participant.type || "Sub",
    availability: normalizeAvailability(participant.availability),
    availabilityNote: participant.availabilityNote || "",
    availabilityOverride: Boolean(participant.availabilityOverride),
    role: participant.role || participant.type || "",
    unit: UNITS.includes(participant.unit) ? participant.unit : "Unassigned",
    tacticalGroup: TACTICAL_GROUPS.includes(participant.tacticalGroup) ? participant.tacticalGroup : "Reserve",
    unitLeader: Boolean(participant.unitLeader),
    mapPosition: participant.mapPosition || "",
    primaryAssignment: participant.primaryAssignment || participant.unit || "",
    backupAssignment: participant.backupAssignment || "",
    primaryUnit: participant.primaryUnit || participant.unit || "",
    rotationUnit: participant.rotationUnit || "",
    openingObjective: participant.openingObjective || "",
    midBattleObjective: participant.midBattleObjective || "",
    finalObjective: participant.finalObjective || "",
    attendance: participant.attendance || "",
    score: Number(participant.score || 0),
    notes: participant.notes || "",
    officerNotes: participant.officerNotes || "",
    confirmedAt: participant.confirmedAt || null,
    historicalSnapshot: participant.historicalSnapshot && typeof participant.historicalSnapshot === "object" ? participant.historicalSnapshot : null,
    updatedAt: participant.updatedAt || now(),
    updatedBy: participant.updatedBy || "",
    version: Number(participant.version || 1)
  };
}

export function normalizeTemplate(template = {}) {
  return {
    id: String(template.id || newId("strategy")),
    name: template.name || "Untitled strategy",
    description: template.description || "",
    team: ["A", "B", "Both"].includes(template.team) ? template.team : "Both",
    active: template.active !== false,
    objectives: Array.isArray(template.objectives) ? template.objectives : [],
    phases: Array.isArray(template.phases) ? template.phases : [],
    structureResponsibilities: template.structureResponsibilities || {},
    defaultAssignments: template.defaultAssignments || {},
    groupOrdersByTeam: template.groupOrdersByTeam || {},
    notes: template.notes || "",
    createdAt: template.createdAt || now(),
    createdBy: template.createdBy || "",
    updatedAt: template.updatedAt || now(),
    version: Number(template.version || 1)
  };
}

export function createEvent(state, input, actor, duplicateFromId = null) {
  const timestamp = now();
  const source = duplicateFromId ? state.events[duplicateFromId] : null;
  const event = normalizeEvent({
    ...(source || {}),
    ...input,
    id: newId("event"),
    status: "draft",
    scoreFor: 0,
    scoreAgainst: 0,
    outcome: "Undecided",
    notes: "",
    debrief: {},
    createdAt: timestamp,
    createdBy: actor.uid,
    updatedAt: timestamp,
    updatedBy: actor.uid,
    publishedAt: null,
    publishedBy: null,
    completedAt: null,
    archivedAt: null,
    version: 1
  });
  state.events[event.id] = event;
  state.eventParticipants[event.id] = {};

  const sourceParticipants = source ? state.eventParticipants[source.id] || {} : {};
  for (const player of Object.values(state.players)) {
    const previous = sourceParticipants[player.id];
    state.eventParticipants[event.id][player.id] = normalizeParticipant({
      ...(previous || {}),
      eventId: event.id,
      playerId: player.id,
      playerName: player.gameName,
      selected: source ? Boolean(previous?.selected) : false,
      team: source ? (previous?.team || "Reserve") : "Reserve",
      rosterStatus: source ? (previous?.rosterStatus || "Sub") : "Sub",
      unit: source ? (previous?.unit || "Unassigned") : "Unassigned",
      tacticalGroup: source ? (previous?.tacticalGroup || "Reserve") : "Reserve",
      availability: "Pending",
      availabilityNote: player.availabilityGuidance || "",
      attendance: "",
      score: 0,
      notes: "",
      confirmedAt: null,
      updatedAt: timestamp,
      updatedBy: actor.uid,
      version: 1
    });
  }
  state.activeEventId = event.id;
  return event;
}

export function transitionEvent(state, eventId, action, actor, overrideReason = "") {
  const event = state.events[eventId];
  if (!event) throw statusError(404, "Event was not found");
  const allowed = {
    publish: ["draft"],
    start: ["published"],
    complete: ["in_progress"],
    archive: ["completed"]
  };
  if (!allowed[action]?.includes(event.status)) throw statusError(409, `A ${event.status} event cannot be ${action}ed`);
  if (action === "publish") {
    const validation = validateEventForPublish(event, Object.values(state.eventParticipants[eventId] || {}));
    if (!validation.ready) throw Object.assign(statusError(422, "Battle plan is not ready to publish"), { details: validation });
    if (validation.warnings.length && !overrideReason) {
      throw Object.assign(statusError(422, "Publishing warnings require an override reason"), { details: validation });
    }
  }
  const timestamp = now();
  const nextStatus = { publish: "published", start: "in_progress", complete: "completed", archive: "archived" }[action];
  event.status = nextStatus;
  event.updatedAt = timestamp;
  event.updatedBy = actor.uid;
  event.version += 1;
  if (action === "publish") {
    event.publishedAt = timestamp;
    event.publishedBy = actor.uid;
  }
  if (action === "complete") event.completedAt = timestamp;
  if (action === "archive") event.archivedAt = timestamp;
  return event;
}

export function calculateParticipation(state, filters = {}) {
  const archivedIds = Object.values(state.events)
    .filter((event) => event.status === "archived")
    .filter((event) => !filters.eventId || event.id === filters.eventId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((event) => event.id);
  return Object.values(state.players).map((player) => {
    const records = archivedIds.map((eventId) => ({
      event: state.events[eventId],
      participant: state.eventParticipants[eventId]?.[player.id]
    })).filter(({ participant }) => participant?.selected)
      .filter(({ participant }) => !filters.team || participant.team === filters.team)
      .filter(({ participant }) => !filters.unit || participant.unit === filters.unit);
    const attended = records.filter(({ participant }) => ["Present", "Late"].includes(participant.attendance));
    const missed = records.filter(({ participant }) => participant.attendance === "No-show");
    const confirmed = records.filter(({ participant }) => participant.availability === "Confirmed");
    const scores = records.map(({ participant }) => Number(participant.score || 0));
    return {
      playerId: player.id,
      playerName: player.gameName,
      active: player.active,
      eventsSelected: records.length,
      eventsConfirmed: confirmed.length,
      eventsAttended: attended.length,
      eventsMissed: missed.length,
      attendancePercentage: percentage(attended.length, attended.length + missed.length),
      confirmationPercentage: percentage(confirmed.length, records.length),
      starterAppearances: records.filter(({ participant }) => participant.rosterStatus === "Starter").length,
      substituteAppearances: records.filter(({ participant }) => participant.rosterStatus === "Sub").length,
      teamAAppearances: records.filter(({ participant }) => participant.team === "A").length,
      teamBAppearances: records.filter(({ participant }) => participant.team === "B").length,
      averageScore: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0,
      totalScore: scores.reduce((sum, score) => sum + score, 0),
      highestScore: scores.length ? Math.max(...scores) : 0,
      currentAttendanceStreak: currentStreak(records),
      consecutiveAttendanceStreak: longestStreak(records),
      lastParticipationDate: records[0]?.event.date || null,
      recentFiveAttendance: records.slice(0, 5).map(({ participant }) => participant.attendance),
      recentFiveAverageScore: average(records.slice(0, 5).map(({ participant }) => participant.score))
    };
  });
}

export function applyStrategyTemplate(state, eventId, templateId, team, actor) {
  const event = state.events[eventId];
  const template = state.strategyTemplates[templateId];
  if (!event || !template) throw statusError(404, "Event or strategy template was not found");
  const phaseErrors = validatePhases(template.phases);
  if (phaseErrors.length) throw Object.assign(statusError(422, "Strategy phases are invalid"), { details: phaseErrors });
  const timestamp = now();
  const copy = structuredClone({ ...template, templateId, eventId, team, updatedAt: timestamp, updatedBy: actor.uid });
  if (copy.groupOrdersByTeam?.[team]) {
    copy.phases = copy.groupOrdersByTeam[team].map((phase) => structuredClone(phase));
  }
  state.eventStrategies[eventId] ||= {};
  const before = state.eventStrategies[eventId][team] || null;
  state.eventStrategies[eventId][team] = copy;
  syncOpeningAssignments(state, eventId, team, copy);
  const versions = state.strategyVersions[eventId] ||= {};
  versions[team] ||= [];
  versions[team].push({
    id: newId("strategy-version"),
    version: versions[team].length + 1,
    eventId,
    templateSource: templateId,
    changedBy: actor.uid,
    changedAt: timestamp,
    changeSummary: `Applied ${template.name}`,
    previousValues: before,
    newValues: copy
  });
  event[`strategy${team}`] = template.name;
  event.updatedAt = timestamp;
  event.version += 1;
  return copy;
}

function syncOpeningAssignments(state, eventId, team, strategy) {
  const opening = [...(strategy.phases || [])].sort((left, right) => Number(left.startMinute) - Number(right.startMinute))[0];
  if (!opening?.groupOrders) return;
  for (const participant of Object.values(state.eventParticipants[eventId] || {})) {
    if (participant.team !== team) continue;
    const order = opening.groupOrders[participant.tacticalGroup];
    if (!order) continue;
    participant.unit = order.primaryObjective || "Unassigned";
    participant.primaryUnit = order.primaryObjective || "";
    participant.rotationUnit = order.secondaryObjective || "";
    participant.primaryAssignment = order.primaryAction || "";
    participant.backupAssignment = order.secondaryAction || "";
    participant.openingObjective = order.primaryObjective || "";
    participant.updatedAt = now();
    if (state.players[participant.playerId]) state.players[participant.playerId].defaultUnit = participant.unit;
  }
}

export function addAudit(state, actor, input) {
  const eventId = input.eventId || "system";
  const entry = {
    id: newId("audit"),
    eventId,
    userId: actor.uid,
    userDisplayName: actor.displayName || actor.email || actor.uid,
    action: input.action,
    recordType: input.recordType,
    recordId: input.recordId,
    field: input.field || null,
    before: input.before ?? null,
    after: input.after ?? null,
    reason: input.reason || "",
    timestamp: now()
  };
  state.auditLogs[eventId] ||= {};
  state.auditLogs[eventId][entry.id] = entry;
  return entry;
}

function defaultStrategyTemplates(timestamp) {
  const id = "strategy-standard-control";
  return {
    [id]: normalizeTemplate({
      id,
      name: "Standard Control & Rotation",
      description: "Balanced opening, structure control, rotations, and final defence.",
      team: "Both",
      objectives: ["Secure opening structures", "Hold the Nuclear Silo", "Rotate on pressure"],
      phases: [
        { id: "phase-opening", name: "Opening capture", startMinute: 0, endMinute: 5, priority: "High", instructions: "Capture assigned opening structures.", objectives: [], assignedUnits: [], assignedStructures: [], fallbackPlan: "Regroup at the nearest hospital." },
        { id: "phase-control", name: "Control and rotation", startMinute: 5, endMinute: 25, priority: "High", instructions: "Hold structures and rotate on officer calls.", objectives: [], assignedUnits: [], assignedStructures: [], fallbackPlan: "Protect the Nuclear Silo lane." },
        { id: "phase-final", name: "Final defence", startMinute: 25, endMinute: 30, priority: "Critical", instructions: "Consolidate high-value structures.", objectives: [], assignedUnits: [], assignedStructures: [], fallbackPlan: "Defend controlled scoring structures." }
      ],
      structureResponsibilities: {},
      createdAt: timestamp,
      updatedAt: timestamp
    })
  };
}

function stableLegacyEventId(value) {
  return `event-legacy-${String(value).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "record"}`;
}

function normalizeAvailability(value) {
  if (value === "Not available") return "Unavailable";
  return ["Pending", "Confirmed", "Tentative", "Unavailable"].includes(value) ? value : "Pending";
}

function duplicatePlayerNames(players) {
  const seen = new Map();
  for (const player of players) {
    const key = player.gameName.trim().toLowerCase();
    seen.set(key, [...(seen.get(key) || []), player.gameName]);
  }
  return [...seen.values()].filter((names) => names.length > 1).flat();
}

function objectMap(input = {}, normalizer) {
  return Object.fromEntries(Object.entries(input || {}).map(([id, value]) => [id, normalizer({ ...value, id: value?.id || id })]));
}

function nestedObjectMap(input = {}, normalizer) {
  return Object.fromEntries(Object.entries(input || {}).map(([eventId, records]) => [
    eventId,
    Object.fromEntries(Object.entries(records || {}).map(([playerId, value]) => [
      playerId,
      normalizer({ ...value, eventId, playerId })
    ]))
  ]));
}

function newestEditableEventId(events = {}) {
  return Object.values(events || {}).filter((event) => event.status !== "archived")
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0]?.id || null;
}

function percentage(value, total) {
  return total ? Math.round((value / total) * 100) : 0;
}

function average(values) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length) : 0;
}

function currentStreak(records) {
  let streak = 0;
  for (const { participant } of records) {
    if (!["Present", "Late"].includes(participant.attendance)) break;
    streak += 1;
  }
  return streak;
}

function longestStreak(records) {
  let longest = 0;
  let current = 0;
  for (const { participant } of [...records].reverse()) {
    current = ["Present", "Late"].includes(participant.attendance) ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

function statusError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

export { validateEventForPublish };
