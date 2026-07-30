import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("private Firebase paths require the authenticated owner UID", async () => {
  const rules = JSON.parse(await readFile(new URL("../database.rules.json", import.meta.url), "utf8")).rules;
  assert.equal(rules.appState[".read"], false);
  assert.match(rules.userPrivate.$uid[".read"], /auth\.uid === \$uid/);
  assert.match(rules.userPrivate.$uid[".write"], /auth\.uid === \$uid/);
  assert.match(rules.userPrivate.$uid.journalEntries.$entryId[".validate"], /ownerUid.*auth\.uid/);
  assert.match(rules.userPrivate.$uid.goals.$goalId[".validate"], /ownerUid.*auth\.uid/);
});
