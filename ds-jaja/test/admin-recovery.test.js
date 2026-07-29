import test from "node:test";
import assert from "node:assert/strict";
import { isRecoveryAdministrator } from "../src/dataStore.js";

test("recognizes the primary administrator email regardless of case", () => {
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
