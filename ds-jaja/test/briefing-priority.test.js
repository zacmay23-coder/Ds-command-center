import test from "node:test";
import assert from "node:assert/strict";
import { chooseBriefingPriority } from "../public/briefing-priority.js";

test("briefing priority follows the documented deterministic order", () => {
  const all = { urgentLeadershipMessage: true, eventBeginsSoon: true, attendanceUnconfirmed: true, assignmentChanged: true, incompleteDailyGoal: true, incompleteWeeklyGoal: true, unreadMessage: true, pendingAnnouncement: true };
  assert.equal(chooseBriefingPriority(all), "urgent_leadership");
  assert.equal(chooseBriefingPriority({ ...all, urgentLeadershipMessage: false }), "event_soon");
  assert.equal(chooseBriefingPriority({ ...all, urgentLeadershipMessage: false, eventBeginsSoon: false }), "attendance");
  assert.equal(chooseBriefingPriority({ incompleteDailyGoal: true, incompleteWeeklyGoal: true, unreadMessage: true }), "daily_goal");
  assert.equal(chooseBriefingPriority({ incompleteWeeklyGoal: true, unreadMessage: true }), "weekly_goal");
  assert.equal(chooseBriefingPriority({ unreadMessage: true }), "message");
  assert.equal(chooseBriefingPriority({ pendingAnnouncement: true }), "announcement");
  assert.equal(chooseBriefingPriority({}), "recommendation");
});
