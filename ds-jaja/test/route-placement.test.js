import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("administrator maintenance endpoints remain in the authenticated API router", async () => {
  const source = await readFile(new URL("../server.js", import.meta.url), "utf8");
  const router = source.slice(source.indexOf("async function handleApi"), source.indexOf("function normalizeApiPath"));
  const authProxy = source.slice(source.indexOf("async function proxyFirebaseAuth"), source.indexOf("function formatFirebaseAuthError"));
  assert.match(router, /\/api\/admin\/sanitize-text/);
  assert.match(router, /\/api\/admin\/migrate-private-data/);
  assert.doesNotMatch(authProxy, /\brequest\b|\bresponse\b|\buser\b/);
});

test("participation automation runs on event archive, not VS publication", async () => {
  const source = await readFile(new URL("../src/dataStore.js", import.meta.url), "utf8");
  const eventTransition = source.slice(source.indexOf("export async function changeEventStatus"), source.indexOf("export async function updateEventParticipant"));
  const vsPublish = source.slice(source.indexOf("export async function publishVsDay"), source.indexOf("function updateParticipationGoals"));
  assert.match(eventTransition, /action === "archive"\) updateParticipationGoals/);
  assert.doesNotMatch(vsPublish, /action === "archive"/);
});
