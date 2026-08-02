import test from "node:test";
import assert from "node:assert/strict";
import { matchPlayersFromText, parseDuelLeagueStandings } from "../src/resultScreenshotReader.js";

const roster = [
  { id: "player-1", name: "NightHawk", aliases: [] },
  { id: "player-2", name: "Iron Wolf", aliases: ["IronWolf"] }
];

test("ignores repeated alliance text between a roster name and score", () => {
  const result = matchPlayersFromText(`
    (EWAR) NightHawk
    (EWAR) Eternal Lords of War
    12,345,678
  `, roster);

  assert.deepEqual(result.matches, [{
    memberId: "player-1",
    name: "NightHawk",
    score: 12345678,
    sourceLine: "12,345,678"
  }]);
  assert.deepEqual(result.unmatched, []);
});

test("accepts only names that match the master roster", () => {
  const result = matchPlayersFromText(`
    Unknown Player
    Eternal Lords of War
    9,876,543
  `, roster);

  assert.deepEqual(result.matches, []);
  assert.equal(result.unmatched.length, 1);
  assert.equal(result.unmatched[0].score, 9876543);
});

test("matches a roster name and score on the same OCR line", () => {
  const result = matchPlayersFromText(
    "(EWAR) Iron Wolf (EWAR) Eternal Lords or War 7,654,321",
    roster
  );

  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].memberId, "player-2");
  assert.equal(result.matches[0].score, 7654321);
});

test("preserves valid zero and small whole-number OCR scores", () => {
  const members = [{ id: "player-1", name: "Dark Wizard", aliases: [] }];
  for (const score of [0, 100, 1_000, 100_000, 1_000_000, 100_000_000]) {
    const formatted = score.toLocaleString("en-US");
    const result = matchPlayersFromText(`Dark Wizard\n${formatted}`, members);
    assert.equal(result.matches[0]?.score, score);
  }
});

test("ranks Duel League alliances by screenshot order when printed ranks are unreadable", () => {
  const result = parseDuelLeagueStandings(`
    Duel League Standings
    [EWAR] Eternal Lords of War W L W W
    [FURY] Fury Road L W L W
    9 [NOVA] Nova Prime W W L L
  `);

  assert.deepEqual(result.standings.map(({ rank, alliance }) => ({ rank, alliance })), [
    { rank: 1, alliance: "[EWAR] Eternal Lords of War" },
    { rank: 2, alliance: "[FURY] Fury Road" },
    { rank: 3, alliance: "[NOVA] Nova Prime" }
  ]);
});

test("limits a Duel League OCR import to 16 ordered alliances", () => {
  const text = Array.from({ length: 20 }, (_, index) => `[T${index + 1}] Alliance ${index + 1} W L`).join("\n");
  const result = parseDuelLeagueStandings(text);
  assert.equal(result.standings.length, 16);
  assert.equal(result.standings[15].rank, 16);
});
