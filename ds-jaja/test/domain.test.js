import test from "node:test";
import assert from "node:assert/strict";
import {
  addAudit,
  applyStrategyTemplate,
  calculateParticipation,
  createEvent,
  migrateLegacyState,
  normalizePlayerName,
  normalizeState,
  transitionEvent,
  validateEventForPublish
} from "../src/domain.js";
import { canEditOwnAvailability, hasRole, requireRole, ROLES } from "../src/permissions.js";

const admin = { uid: "admin", displayName: "Admin", role: ROLES.ADMIN, active: true, playerId: "p1" };
const officer = { uid: "officer", displayName: "Officer", role: ROLES.OFFICER, active: true };
const member = { uid: "member", displayName: "Member", role: ROLES.MEMBER, active: true, playerId: "p1" };

test("player-name matching normalizes case, spacing, punctuation, and safe Unicode", () => {
  assert.equal(normalizePlayerName("  Dark   Wizard  "), normalizePlayerName("dark wizard"));
  assert.equal(normalizePlayerName("Dark-Wizard!"), normalizePlayerName("Dark Wizard"));
  assert.equal(normalizePlayerName("Ｄａｒｋ Wizard"), normalizePlayerName("Dark Wizard"));
});

test("roles enforce member, officer, and administrator boundaries", () => {
  assert.equal(hasRole(member, ROLES.MEMBER), true);
  assert.equal(hasRole(member, ROLES.OFFICER), false);
  assert.equal(hasRole(officer, ROLES.OFFICER), true);
  assert.equal(hasRole(admin, ROLES.ADMIN), true);
  assert.throws(() => requireRole(member, ROLES.OFFICER), /requires officer/);
  assert.equal(canEditOwnAvailability(member, "p1"), true);
  assert.equal(canEditOwnAvailability(member, "p2"), false);
});

test("legacy migration preserves players, current assignments, and history and is idempotent", () => {
  const legacy = {
    settings: { strategyA: "Plan A", strategyB: "Plan B", battleTimeA: "9:00", battleTimeB: "18:00" },
    members: [{ id: "p1", name: "Alpha", rank: "R4", selected: true, team: "A", type: "Starter", unit: "Arsenal", availability: "Confirmed" }],
    battles: [{ id: "old-1", date: "2026-01-01", opponent: "Enemy", players: [{ id: "p1", name: "Alpha", team: "A", type: "Starter", unit: "Arsenal", attendance: "Present", score: 100 }] }]
  };
  const first = migrateLegacyState(legacy);
  const second = migrateLegacyState(first.state);
  assert.equal(Object.keys(first.state.players).length, 1);
  assert.equal(Object.keys(first.state.events).length, 2);
  assert.equal(Object.keys(second.state.events).length, 2);
  assert.equal(first.state.eventParticipants[first.state.activeEventId].p1.unit, "Arsenal");
});

test("event creation and duplication clear result and confirmation fields", () => {
  const state = baseState();
  const first = createEvent(state, { date: "2026-08-01" }, officer);
  state.eventParticipants[first.id].p1.selected = true;
  state.eventParticipants[first.id].p1.attendance = "Present";
  state.eventParticipants[first.id].p1.score = 500;
  state.eventParticipants[first.id].p1.confirmedAt = "yesterday";
  const duplicate = createEvent(state, { date: "2026-08-08" }, officer, first.id);
  const copied = state.eventParticipants[duplicate.id].p1;
  assert.equal(copied.selected, true);
  assert.equal(copied.attendance, "");
  assert.equal(copied.score, 0);
  assert.equal(copied.confirmedAt, null);
});

test("publication validation blocks missing assignments", () => {
  const state = baseState();
  const event = createEvent(state, { date: "2026-08-01" }, officer);
  const participant = state.eventParticipants[event.id].p1;
  participant.selected = true;
  participant.team = "A";
  participant.rosterStatus = "Starter";
  participant.role = "Starter";
  participant.unit = "Unassigned";
  const result = validateEventForPublish(event, [participant]);
  assert.equal(result.ready, false);
  assert.match(result.errors.join(" "), /without a unit/);
  assert.throws(() => transitionEvent(state, event.id, "publish", officer, "accepted warnings"), /not ready/);
});

test("event lifecycle reaches archived in order and writes audit records", () => {
  const state = baseState();
  const event = createEvent(state, { date: "2026-08-01" }, officer);
  const participant = state.eventParticipants[event.id].p1;
  Object.assign(participant, { selected: true, team: "A", rosterStatus: "Sub", role: "Sub", unit: "Arsenal" });
  transitionEvent(state, event.id, "publish", officer, "Team B intentionally unused");
  transitionEvent(state, event.id, "start", officer);
  transitionEvent(state, event.id, "complete", officer);
  transitionEvent(state, event.id, "archive", officer);
  const audit = addAudit(state, officer, { eventId: event.id, action: "event_archived", recordType: "event", recordId: event.id });
  assert.equal(event.status, "archived");
  assert.equal(state.auditLogs[event.id][audit.id].action, "event_archived");
});

test("participation statistics only count selected archived event records", () => {
  const state = baseState();
  const event = createEvent(state, { date: "2026-08-01" }, officer);
  event.status = "archived";
  Object.assign(state.eventParticipants[event.id].p1, {
    selected: true, team: "A", rosterStatus: "Starter", availability: "Confirmed", attendance: "Present", score: 1200
  });
  const stats = calculateParticipation(state).find((item) => item.playerId === "p1");
  assert.equal(stats.eventsSelected, 1);
  assert.equal(stats.attendancePercentage, 100);
  assert.equal(stats.averageScore, 1200);
});

test("strategy-template application makes an event copy and an immutable version", () => {
  const state = baseState();
  const event = createEvent(state, { date: "2026-08-01" }, officer);
  state.strategyTemplates.t1 = {
    id: "t1", name: "Rotation", team: "Both", active: true, objectives: [],
    phases: [{ id: "x", name: "Opening", startMinute: 0, endMinute: 5 }],
    structureResponsibilities: {}, defaultAssignments: {}, version: 1
  };
  const applied = applyStrategyTemplate(state, event.id, "t1", "A", officer);
  state.strategyTemplates.t1.name = "Changed original";
  assert.equal(applied.name, "Rotation");
  assert.equal(state.strategyVersions[event.id].A.length, 1);
});

function baseState() {
  return normalizeState({
    users: {},
    players: {
      p1: { id: "p1", gameName: "Alpha", rank: "R4", defaultRole: "Sub", defaultUnit: "Arsenal", active: true }
    },
    events: {},
    eventParticipants: {},
    strategyTemplates: {},
    eventStrategies: {},
    strategyVersions: {},
    auditLogs: {}
  });
}
