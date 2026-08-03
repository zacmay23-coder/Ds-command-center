import test from "node:test";
import assert from "node:assert/strict";
import { normalizeManagedEvent, normalizeState } from "../src/domain.js";
import { permissionsFor } from "../src/permissions.js";

test("managed events use the shared lifecycle model and keep type-specific details", () => {
  const event = normalizeManagedEvent({
    id: "evt-1", type: "desertStorm", title: "Desert Storm — August 8", status: "active",
    startDate: "2026-08-08", details: { teamA: { serverTime: "18:00", strategyId: "standard" } }
  });
  assert.equal(event.status, "active");
  assert.equal(event.active, true);
  assert.equal(event.details.teamA.strategyId, "standard");
  assert.equal(event.version, 1);
});

test("legacy event collections normalize idempotently into canonical records", () => {
  const legacy = {
    events: { ds1: { id: "ds1", date: "2026-08-08", status: "published", battleTimeA: "9:00", battleTimeB: "18:00", strategyA: "a", strategyB: "b" } },
    themeWeeks: { theme1: { id: "theme1", title: "Theme", weekOf: "2026-08-03", status: "open" } },
    allianceWeeklyEvents: {}, vsWeeks: {}
  };
  const first = normalizeState(legacy);
  const second = normalizeState(first);
  assert.deepEqual(Object.keys(second.managedEvents).sort(), Object.keys(first.managedEvents).sort());
  assert.equal(first.managedEvents["managed-ds1"].status, "scheduled");
  assert.equal(first.managedEvents["managed-theme1"].type, "themeWeek");
});

test("verified account permissions never grant event writes to members", () => {
  assert.equal(permissionsFor({ role: "member", active: true }).canCreateEvents, false);
  assert.equal(permissionsFor({ role: "officer", active: true }).canPublishEvents, true);
  assert.equal(permissionsFor({ role: "officer", active: true }).canDeleteEvents, false);
  assert.equal(permissionsFor({ role: "administrator", active: true }).canDeleteEvents, true);
});
