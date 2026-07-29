import test from "node:test";
import assert from "node:assert/strict";
import { matchPlayersFromText } from "../src/resultScreenshotReader.js";

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
