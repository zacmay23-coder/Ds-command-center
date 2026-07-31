import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeDisplayText, sanitizeTextFields } from "../src/textSanitization.js";

test("removes ASCII 1 and literal caret-A artifacts", () => {
  assert.equal(sanitizeDisplayText("Alpha\u0001Bravo"), "AlphaBravo");
  assert.equal(sanitizeDisplayText("Alpha^ABravo"), "AlphaBravo");
  assert.equal(sanitizeDisplayText("玩家 \u0001 Dark Wizard"), "玩家  Dark Wizard");
  assert.equal(sanitizeDisplayText("Line 1\n\n\nLine 2"), "Line 1\n\nLine 2");
});

test("preserves human language and formatting", () => {
  assert.equal(sanitizeDisplayText("D'Artagnan 😀 café\nLine two"), "D'Artagnan 😀 café\nLine two");
});

test("sanitizes imported and persisted text but protects identifiers and URLs", () => {
  const input = {
    id: "record^A1",
    url: "https://example.test/a^Ab",
    title: "Battle^A Plan",
    ocr: { playerName: "Alpha\u0001Bravo" }
  };
  assert.deepEqual(sanitizeTextFields(input), {
    id: "record^A1",
    url: "https://example.test/a^Ab",
    title: "Battle Plan",
    ocr: { playerName: "AlphaBravo" }
  });
});
