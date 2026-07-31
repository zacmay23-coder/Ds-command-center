import test from "node:test";
import assert from "node:assert/strict";
import { awardAchievement, awardTopThree, goalsForUser, isFinalResultStatus, isGoalRelevant, normalizeGoal, normalizePrivateJournal } from "../src/personalCompanion.js";
import { applyGoalDeadlines, updateParticipationGoals, updateVsGoals } from "../src/dataStore.js";

test("journal ownership is always derived from the authenticated UID", () => {
  const entry = normalizePrivateJournal({ ownerUid: "attacker", title: "Private", body: "Body" }, "member-a");
  assert.equal(entry.ownerUid, "member-a");
});

test("goals are scoped to their owner even for leadership callers", () => {
  const store = {
    "member-a": [normalizeGoal({ title: "A" }, "member-a")],
    "officer-b": [normalizeGoal({ title: "B" }, "officer-b")]
  };
  assert.deepEqual(goalsForUser(store, "officer-b").map((goal) => goal.title), ["B"]);
  assert.deepEqual(goalsForUser(store, "member-a").map((goal) => goal.title), ["A"]);
});

test("daily and configured VS-week timing remain distinct", () => {
  const daily = normalizeGoal({ title: "Today", goalType: "daily", startDate: "2026-07-30", dueDate: "2026-07-30" }, "u");
  const vs = normalizeGoal({ title: "VS", goalType: "vs_weekly" }, "u");
  assert.equal(isGoalRelevant(daily, "2026-07-30"), true);
  assert.equal(isGoalRelevant(daily, "2026-07-31"), false);
  assert.equal(isGoalRelevant(vs, "2026-08-02", { beginDate: "2026-07-27" }), true);
  assert.equal(isGoalRelevant(vs, "2026-08-03", { beginDate: "2026-07-27" }), false);
});

test("top-three achievements are idempotent and private to linked users", () => {
  const state = {
    users: { u1: { uid: "u1", playerId: "p1" }, u2: { uid: "u2", playerId: "p2" } },
    userAchievements: {}
  };
  const context = { type: "vs_daily", label: "VS Daily", eventId: "w1", periodId: "2026-07-30", message: (_, place) => `Place ${place}` };
  const ranking = [{ playerId: "p1", value: 100 }, { playerId: "p2", value: 90 }];
  assert.equal(awardTopThree(state, ranking, context).length, 2);
  assert.equal(awardTopThree(state, ranking, context).length, 0);
  assert.equal(state.userAchievements.u1.length, 1);
  assert.equal(state.userAchievements.u2.length, 1);
});

test("journal lifecycle metadata remains private and survives normalization", () => {
  const entry = normalizePrivateJournal({
    id: "j1", title: "Pinned plan", body: "Private", tags: ["vs"], isPinned: true,
    archivedAt: "2026-07-30T00:00:00.000Z", reminderAt: "2026-07-31T00:00:00.000Z", goalIds: ["g1"]
  }, "owner");
  assert.deepEqual({ ownerUid: entry.ownerUid, tags: entry.tags, pinned: entry.isPinned, archivedAt: entry.archivedAt, reminderAt: entry.reminderAt, goalIds: entry.goalIds },
    { ownerUid: "owner", tags: ["vs"], pinned: true, archivedAt: "2026-07-30T00:00:00.000Z", reminderAt: "2026-07-31T00:00:00.000Z", goalIds: ["g1"] });
});

test("individual achievements are idempotent", () => {
  const state = { users: { u: { uid: "u", playerId: "p" } }, userAchievements: {} };
  const definition = { key: "record", eventId: "e", eventType: "vs_daily", periodId: "d", title: "Record", message: "New record" };
  assert.ok(awardAchievement(state, "p", definition));
  assert.equal(awardAchievement(state, "p", definition), null);
});

test("draft and partial results cannot generate final achievements", () => {
  assert.equal(isFinalResultStatus("theme_week", "voting"), false);
  assert.equal(isFinalResultStatus("theme_week", "finalized"), true);
  assert.equal(isFinalResultStatus("vs_day", "draft"), false);
  assert.equal(isFinalResultStatus("vs_day", "published"), true);
});

test("Theme, VS daily, and VS weekly top-three awards stay distinct and idempotent", () => {
  const state = {
    users: {
      a: { uid: "a", playerId: "p1" },
      b: { uid: "b", playerId: "p2" },
      c: { uid: "c", playerId: "p3" }
    },
    userAchievements: {}
  };
  const ranking = [{ playerId: "p1", value: 30 }, { playerId: "p2", value: 20 }, { playerId: "p3", value: 10 }];
  for (const [type, label, periodId] of [
    ["theme_week", "Theme Week", "2026-07-27"],
    ["vs_daily", "VS Daily", "2026-07-30"],
    ["vs_weekly", "VS Weekly", "2026-07-27"]
  ]) {
    const context = { type, label, eventId: `${type}-event`, periodId, message: () => `${label} result` };
    assert.equal(awardTopThree(state, ranking, context).length, 3);
    assert.equal(awardTopThree(state, ranking, context).length, 0);
  }
  assert.equal(Object.values(state.userAchievements).flat().length, 9);
});

test("finalized participation updates automatic goals and preserves manual overrides", () => {
  const state = {
    users: { owner: { uid: "owner", playerId: "p1" } },
    events: {
      event1: { id: "event1", status: "archived" },
      event2: { id: "event2", status: "archived" }
    },
    eventParticipants: {
      event1: { p1: { attendance: "Present", availability: "Confirmed" } },
      event2: { p1: { attendance: "Late", confirmedAt: "2026-07-30T00:00:00.000Z" } }
    },
    userGoals: {
      owner: [
        { automationMetric: "attendance", progressSource: "automatic", targetValue: 2, status: "in_progress" },
        { automationMetric: "confirmation", progressSource: "automatic", targetValue: 2, status: "in_progress" },
        { automationMetric: "attendance", progressSource: "manual", currentValue: 9, targetValue: 10, status: "in_progress" }
      ]
    }
  };
  updateParticipationGoals(state);
  assert.equal(state.userGoals.owner[0].currentValue, 2);
  assert.equal(state.userGoals.owner[0].status, "completed");
  assert.equal(state.userGoals.owner[1].currentValue, 2);
  assert.equal(state.userGoals.owner[1].status, "completed");
  assert.equal(state.userGoals.owner[2].currentValue, 9);
  assert.equal(state.userGoals.owner[2].status, "in_progress");
});

test("published VS totals update automatic daily and weekly goals without replacing manual progress", () => {
  const state = {
    users: { owner: { uid: "owner", playerId: "p1" } },
    vsScores: [
      { vsWeekId: "week1", playerId: "p1", date: "2026-07-27", score: 40 },
      { vsWeekId: "week1", playerId: "p1", date: "2026-07-28", score: 60 }
    ],
    userGoals: {
      owner: [
        { goalType: "vs_daily", dueDate: "2026-07-28", progressSource: "automatic", currentValue: 0, targetValue: 60, status: "in_progress" },
        { goalType: "vs_weekly", progressSource: "automatic", currentValue: 0, targetValue: 100, status: "in_progress" },
        { goalType: "vs_weekly", progressSource: "manual", currentValue: 777, targetValue: 1000, status: "in_progress" }
      ]
    }
  };
  const week = { id: "week1", publishedDays: { "2026-07-27": {}, "2026-07-28": {} } };
  updateVsGoals(state, week, "week1", "2026-07-28", [{ playerId: "p1", value: 60 }]);
  assert.equal(state.userGoals.owner[0].currentValue, 60);
  assert.equal(state.userGoals.owner[0].status, "completed");
  assert.equal(state.userGoals.owner[1].currentValue, 100);
  assert.equal(state.userGoals.owner[1].status, "completed");
  assert.equal(state.userGoals.owner[2].currentValue, 777);
});

test("expired recurring goals remain in history and roll forward exactly once", () => {
  const state = {
    userGoals: {
      owner: [{
        id: "daily-1", ownerUid: "owner", title: "Daily review", description: "",
        goalType: "daily", status: "in_progress", progressMode: "checkbox",
        progressSource: "manual", currentValue: 0, targetValue: 1,
        startDate: "2026-01-01", dueDate: "2026-01-01", recurrence: "daily"
      }]
    }
  };
  applyGoalDeadlines(state);
  applyGoalDeadlines(state);
  assert.equal(state.userGoals.owner.filter((goal) => goal.id === "daily-1")[0].status, "missed");
  assert.equal(state.userGoals.owner.length, 2);
  assert.equal(state.userGoals.owner[0].status, "not_started");
  assert.equal(state.userGoals.owner[0].recurrenceFromGoalId, "daily-1");
});
