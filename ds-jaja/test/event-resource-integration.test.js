import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeState } from "../src/domain.js";

function legacyFixture() {
  return {
    schema: "dscc-events-v3",
    players: { p1: { id: "p1", gameName: "Alpha", active: true }, p2: { id: "p2", gameName: "Bravo", active: true } },
    events: { legacy1: { id: "legacy1", date: "2026-08-08", strategyA: "Strategy A", strategyB: "Strategy B", battleTimeA: "18:00", battleTimeB: "23:00", status: "draft" } },
    managedEvents: {
      evt1: { id: "evt1", type: "desertStorm", title: "Desert Storm — August 8", status: "draft", legacyRef: { collection: "events", id: "legacy1" }, details: { teamA: { serverTime: "18:00", strategyId: "a" }, teamB: { serverTime: "23:00", strategyId: "b" } } }
    },
    eventParticipants: { legacy1: { p1: { eventId: "legacy1", playerId: "p1", selected: true, team: "A", rosterStatus: "Starter" }, p2: { eventId: "legacy1", playerId: "p2", selected: true, team: "B", rosterStatus: "Sub" } } }
  };
}

test("legacy DS settings migrate idempotently into event-linked Team A and Team B plans", () => {
  const once = normalizeState(legacyFixture()); const twice = normalizeState(once);
  assert.equal(once.eventPlans.evt1.eventId, "evt1");
  assert.equal(once.eventPlans.evt1.teams.A.battleTime, "18:00");
  assert.equal(once.eventPlans.evt1.teams.B.battleTime, "23:00");
  assert.deepEqual(once.eventPlans.evt1.teams.A.starterMemberIds, ["p1"]);
  assert.deepEqual(once.eventPlans.evt1.teams.B.reserveMemberIds, ["p2"]);
  assert.deepEqual(twice.eventPlans, once.eventPlans);
});

test("roster, teams, and map have independent authenticated API routes", async () => {
  const router = await readFile(new URL("../src/http/apiRouter.js", import.meta.url), "utf8");
  assert.match(router, /url\.pathname === "\/api\/roster"/);
  assert.match(router, /eventTeamsRoute/);
  assert.match(router, /eventTeamRoute/);
  assert.match(router, /\/api\/maps\/desert-storm-standard/);
  assert.match(router, /eventMapResourceRoute/);
});

test("Tactical Map Planning has a permanent standard-map fallback and shared selector", async () => {
  const [app, html] = await Promise.all([readFile(new URL("../public/app.js", import.meta.url), "utf8"), readFile(new URL("../public/index.html", import.meta.url), "utf8")]);
  assert.match(app, /No active battle selected\. Showing the standard Desert Storm map/);
  assert.match(app, /desert-storm-map-clean\.png/);
  assert.match(html, /id="teamsEventContext"/);
  assert.match(html, /id="mapEventContext"/);
  assert.match(html, /Save Both Teams/);
});

test("Master Roster exposes explicit independent loading and recovery states", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  for (const text of ["Loading Master Roster", "Master Roster loaded", "No active members found", "does not have roster access", "Roster could not be loaded"]) assert.match(app, new RegExp(text));
  assert.match(app, /retryRosterResource/);
});

test("Desert Storm map and Strategy Library remain visible without optional plan overlays", async () => {
  const [app, html, store, worker] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/dataStore.js", import.meta.url), "utf8"),
    readFile(new URL("../public/service-worker.js", import.meta.url), "utf8")
  ]);
  assert.match(app, /standardDesertStormMap\("The battlefield is available/);
  assert.match(html, /data-view="strategyLibrary">Strategy Library/);
  assert.doesNotMatch(app, /function renderStrategyLibrary\(\) \{\s*if \(!state\.permissions\.isOfficer\) return/);
  assert.match(store, /strategyTemplates: Object\.values/);
  assert.doesNotMatch(store, /Publish Team A\/B times and strategies before assigning the roster/);
  assert.match(worker, /v3-ds-map-repair/);
});
