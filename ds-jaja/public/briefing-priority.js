export function chooseBriefingPriority(input) {
  if (input.urgentLeadershipMessage) return "urgent_leadership";
  if (input.eventBeginsSoon) return "event_soon";
  if (input.attendanceUnconfirmed) return "attendance";
  if (input.assignmentChanged) return "assignment_change";
  if (input.incompleteDailyGoal) return "daily_goal";
  if (input.incompleteWeeklyGoal) return "weekly_goal";
  if (input.unreadMessage) return "message";
  if (input.pendingAnnouncement) return "announcement";
  return "recommendation";
}
