import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createGuestSession, guestBootstrap, verifyGuestSession } from "../src/http/apiRouter.js";
import { permissionsFor } from "../src/permissions.js";

test("guest sessions are signed, expiring, and contain no alliance identity", () => {
  const session = createGuestSession();
  const guest = verifyGuestSession(session.idToken);
  assert.equal(guest.role, "guest");
  assert.equal(guest.isAnonymous, true);
  assert.equal(guest.playerId, null);
  assert.equal(guest.memberId, null);
  assert.equal(verifyGuestSession(`${session.idToken}tampered`), null);
});

test("guest capabilities are explicit and read-only", () => {
  const permissions = permissionsFor({ role: "guest", active: true });
  assert.equal(permissions.viewInteractiveMap, true);
  assert.equal(permissions.runMapSimulation, true);
  assert.equal(permissions.viewPrivateBriefings, false);
  assert.equal(permissions.canCreateEvents, false);
  assert.equal(permissions.canPublishEvents, false);
  assert.equal(permissions.canManageAccounts, false);
});

test("guest bootstrap contains only anonymized demonstration data", () => {
  const bootstrap = guestBootstrap({ role: "guest", displayName: "Guest Viewer", playerId: null });
  const serialized = JSON.stringify(bootstrap);
  assert.equal(bootstrap.event.id, "demo-desert-storm");
  assert.match(serialized, /Player 01/);
  assert.doesNotMatch(serialized, /email|journalEntries|privateMessages|auditLogs|firebaseUid/i);
  assert.equal(bootstrap.map.phases.length, 6);
});

test("login and guest preview surfaces are separate", async () => {
  const login = await readFile(new URL("../public/login.html", import.meta.url), "utf8");
  const guest = await readFile(new URL("../public/guest.html", import.meta.url), "utf8");
  const client = await readFile(new URL("../public/guest.js", import.meta.url), "utf8");
  assert.match(login, /Explore as Guest/);
  assert.match(login, /Member \/ Officer Access/);
  assert.match(guest, /Guest Preview/);
  assert.match(guest, /Read Only/);
  assert.match(client, /\/api\/guest\/bootstrap/);
  assert.doesNotMatch(client, /\/api\/state|\/api\/journal|\/api\/goals/);
});

test("guest API handling denies mutations before private routes", async () => {
  const router = await readFile(new URL("../src/http/apiRouter.js", import.meta.url), "utf8");
  const guestGate = router.slice(router.indexOf("if (user.role === ROLES.GUEST)"), router.indexOf("if (request.method === \"GET\" && url.pathname === \"/api/me\")"));
  assert.match(guestGate, /GUEST_READ_ONLY/);
  assert.match(guestGate, /GUEST_FORBIDDEN/);
  assert.match(guestGate, /\/api\/guest\/bootstrap/);
});
