import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeState } from "../src/domain.js";
import { battlePhases, objectivePositions, tacticalGroups } from "../public/battle-plan.js";

test("Interactive Map navigation and accessible interactions are wired", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(html, /data-view="strategyTimeline">Interactive Map/);
  assert.match(app, /aria-label="Open \$\{escapeHtml\(objective\)\} strategy details"/);
  assert.match(app, /data-show-my-assignment/);
  assert.match(app, /data-timeline-(previous|next|reset)/);
  assert.match(app, /timelineSelectedObjectivePanel/);
});

test("recovered battlefield definition retains all structures, groups, and six phases", () => {
  assert.equal(battlePhases.length, 6);
  assert.deepEqual(battlePhases, ["0-5", "5-10", "10-15", "15-20", "20-25", "25-30"]);
  for (const structure of ["Info Center", "Nuclear Silo", "Arsenal", "Mercenary Factory", "Science Hub", "Oil Refinery 1", "Oil Refinery 2", "Field Hospital 1", "Field Hospital 2", "Field Hospital 3", "Field Hospital 4"]) {
    assert.ok(objectivePositions[structure], `${structure} must remain on the map`);
  }
  for (const group of ["Unit A", "Unit B", "Unit C", "Unit D", "Strike Team", "Scout + Support", "Reserve"]) assert.ok(tacticalGroups.includes(group));
});

test("map draft and snapshot paths survive state normalization without team merging", () => {
  const state = normalizeState({
    eventMapDrafts: { ds1: { version: 2, teams: { A: { strategyId: "a" }, B: { strategyId: "b" } } } },
    eventMapSnapshots: { ds1: { "3": { publicationVersion: "3", teams: { A: { strategyId: "a" }, B: { strategyId: "b" } } } } }
  });
  assert.equal(state.eventMapDrafts.ds1.teams.A.strategyId, "a");
  assert.equal(state.eventMapDrafts.ds1.teams.B.strategyId, "b");
  assert.equal(state.eventMapSnapshots.ds1["3"].publicationVersion, "3");
});

test("map writes and publication snapshots remain behind officer routes", async () => {
  const router = await readFile(new URL("../src/http/apiRouter.js", import.meta.url), "utf8");
  const store = await readFile(new URL("../src/dataStore.js", import.meta.url), "utf8");
  const strategyRoute = router.slice(router.indexOf("const strategyOrderRoute"), router.indexOf("const auditRoute"));
  assert.match(strategyRoute, /requireRole\(user, ROLES\.OFFICER\)/);
  assert.match(store, /publishMapSnapshot\(state, event, actor\)/);
  assert.match(store, /eventMapSnapshots/);
});
