import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeState } from "../src/domain.js";
import { normalizeSeasonBattle, validatePlacement, validateSeasonBattle } from "../src/seasonBattleDomain.js";
import { permissionsFor } from "../src/permissions.js";

const grid = { columns: 60, rows: 40 };

test("Battle Planning navigation preserves Desert Storm and adds Season Battles", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /Battle Planning/);
  assert.match(html, /nav-subcategory">Desert Storm/);
  assert.match(html, /data-view="strategyTimeline">Interactive Map/);
  assert.match(html, /data-view="seasonBattles">Season Battles/);
  assert.match(html, /id="strategyLibrary"/);
});

test("fixed-size objects reject invalid sizes, boundaries, inaccessible cells, and overlap", () => {
  assert.equal(validatePlacement({ objectType: "base", anchorRow: 1, anchorColumn: 1, widthCells: 3, heightCells: 3, grid }).valid, true);
  assert.equal(validatePlacement({ objectType: "base", anchorRow: 1, anchorColumn: 1, widthCells: 4, heightCells: 3, grid }).code, "SIZE");
  assert.equal(validatePlacement({ objectType: "allianceCenter", anchorRow: 35, anchorColumn: 55, widthCells: 9, heightCells: 9, grid }).code, "OUTSIDE_GRID");
  assert.equal(validatePlacement({ objectType: "base", anchorRow: 1, anchorColumn: 1, widthCells: 3, heightCells: 3, grid, inaccessibleCells: ["2:2"] }).code, "INACCESSIBLE");
  assert.equal(validatePlacement({ objectType: "base", anchorRow: 2, anchorColumn: 2, widthCells: 3, heightCells: 3, grid, existingObjects: [{ id: "ac", label: "Alliance Center", anchor: { row: 0, column: 0 }, widthCells: 9, heightCells: 9 }] }).code, "OVERLAP");
});

test("Season Battle publication validation requires an original screenshot and valid map", () => {
  const missing = normalizeSeasonBattle({ title: "Season 4", battleDate: "2026-08-15", grid });
  assert.equal(validateSeasonBattle(missing, { requireDetails: true }).valid, false);
  const valid = normalizeSeasonBattle({ ...missing, screenshot: { assetId: "asset-1", originalUrl: "/protected", width: 2048, height: 1536, mimeType: "image/png" }, objects: [{ type: "base", anchor: { row: 3, column: 4 } }] });
  assert.equal(validateSeasonBattle(valid, { requireDetails: true }).valid, true);
});

test("Season Battles remain separate from Desert Storm state and normalization is idempotent", () => {
  const input = { events: { ds1: { id: "ds1", date: "2026-08-08", status: "draft" } }, eventMapDrafts: { ds1: { teamPlans: { A: {}, B: {} } } }, seasonBattles: { sb1: { id: "sb1", title: "Northern Territory", grid, status: "draft" } } };
  const once = normalizeState(input); const twice = normalizeState(once);
  assert.equal(once.seasonBattles.sb1.type, "seasonBattle");
  assert.deepEqual(twice.seasonBattles, once.seasonBattles);
  assert.deepEqual(twice.eventMapDrafts, once.eventMapDrafts);
});

test("Season Battle editing requires explicit officer capability while administrators retain all access", () => {
  assert.equal(permissionsFor({ role: "member", active: true }).manageSeasonBattlePlans, false);
  assert.equal(permissionsFor({ role: "officer", active: true, officerPermissions: [] }).manageSeasonBattlePlans, false);
  assert.equal(permissionsFor({ role: "officer", active: true, officerPermissions: ["manageSeasonBattlePlans"] }).manageSeasonBattlePlans, true);
  assert.equal(permissionsFor({ role: "administrator", active: true, officerPermissions: ["*"] }).publishSeasonBattlePlans, true);
});

test("legacy Desert Storm routes redirect to Battle Planning views", async () => {
  const server = await readFile(new URL("../server.js", import.meta.url), "utf8");
  assert.match(server, /"\/desert-storm": "\/?\?view=strategyTimeline"/);
  assert.match(server, /"\/battle-planning\/season-battles": "\/?\?view=seasonBattles"/);
});
