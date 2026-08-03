import test from "node:test";
import assert from "node:assert/strict";
import { isRecoveryAdministrator, restoreAdministratorIdentity } from "../src/dataStore.js";

test("recognizes the primary administrator email regardless of case", () => {
  assert.equal(isRecoveryAdministrator({ email: "ZacheryAaronMay@Gmail.com" }), true);
});

test("recognizes the restored protected administrator email", () => {
  assert.equal(isRecoveryAdministrator({ email: "ZacMay23@Gmail.com" }), true);
});

test("does not grant recovery access to an unrelated email", () => {
  assert.equal(isRecoveryAdministrator({ email: "member@example.com" }), false);
});

test("recognizes configured administrator recovery emails", () => {
  const previous = process.env.DSCC_RESTORE_ADMIN_EMAILS;
  process.env.DSCC_RESTORE_ADMIN_EMAILS = "owner@example.com, backup@example.com";
  try {
    assert.equal(isRecoveryAdministrator({ email: "backup@example.com" }), true);
  } finally {
    if (previous === undefined) delete process.env.DSCC_RESTORE_ADMIN_EMAILS;
    else process.env.DSCC_RESTORE_ADMIN_EMAILS = previous;
  }
});

test("moves a deleted administrator identity and player link to a replacement Firebase UID", () => {
  const state = {
    users: {
      legacy: {
        uid: "deleted-firebase-uid",
        email: "zacheryaaronmay@gmail.com",
        displayName: "zacheryaaronmay@gmail.com",
        role: "administrator",
        playerId: "m1",
        profileConfirmedAt: "2026-07-28T23:45:43.963Z",
        version: 2,
        active: true
      }
    },
    players: {
      m1: { id: "m1", gameName: "Dark Wizard", rank: "R5", userId: "deleted-firebase-uid" }
    }
  };

  const result = restoreAdministratorIdentity(state, {
    localId: "replacement-firebase-uid",
    email: "zacheryaaronmay@gmail.com"
  });

  assert.equal(result.changed, true);
  assert.equal(result.user.uid, "replacement-firebase-uid");
  assert.equal(result.user.displayName, "Dark Wizard");
  assert.equal(result.user.playerId, "m1");
  assert.equal(result.user.role, "administrator");
  assert.equal(result.user.applicationRole, "administrator");
  assert.equal(result.user.accountStatus, "active");
  assert.deepEqual(result.user.officerPermissions, ["*"]);
  assert.equal(state.players.m1.rank, "R5");
  assert.equal(state.players.m1.userId, "replacement-firebase-uid");
  assert.deepEqual(Object.keys(state.users), ["replacement-firebase-uid"]);
});
