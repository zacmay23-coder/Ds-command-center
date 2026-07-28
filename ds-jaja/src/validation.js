export const EVENT_STATUSES = ["draft", "published", "in_progress", "completed", "archived"];
export const TEAMS = ["A", "B"];
export const ROSTER_STATUSES = ["Starter", "Sub"];
export const AVAILABILITY = ["Pending", "Confirmed", "Tentative", "Unavailable"];
export const SERVER_TIMES = ["9:00", "18:00", "23:00"];
export const UNITS = [
  "Unassigned", "Oil Refinery 1", "Oil Refinery 2", "Field Hospital 1",
  "Field Hospital 2", "Field Hospital 3", "Field Hospital 4", "Info Center",
  "Arsenal", "Nuclear Silo", "Mercenary Factory", "Science Hub"
];

export function validateEventForPublish(event, participants = []) {
  const errors = [];
  const warnings = [];
  const passed = [];
  const selected = participants.filter((participant) => participant.selected);

  check(Boolean(event.date), "Battle date is configured", "Battle date is required", errors, passed);
  check(Boolean(event.strategyA && event.strategyB), "Strategies are selected", "Both team strategies are required", errors, passed);
  check(SERVER_TIMES.includes(event.battleTimeA) && SERVER_TIMES.includes(event.battleTimeB),
    "Battle times are configured", "Both team battle times are required", errors, passed);

  for (const participant of selected) {
    const label = participant.playerName || participant.playerId;
    if (!TEAMS.includes(participant.team)) errors.push(`${label} is missing a valid team`);
    if (participant.rosterStatus === "Starter" && !participant.role) errors.push(`${label} is a starter without a role`);
    if (participant.rosterStatus === "Starter" && (!participant.unit || participant.unit === "Unassigned")) {
      errors.push(`${label} is a starter without a unit`);
    }
    if (participant.rosterStatus === "Starter" && participant.availability === "Unavailable" && !participant.availabilityOverride) {
      errors.push(`${label} is unavailable but assigned as a starter`);
    }
    if (participant.primaryAssignment && participant.primaryAssignment === participant.backupAssignment) {
      warnings.push(`${label} has the same primary and backup assignment`);
    }
  }

  for (const team of TEAMS) {
    const teamParticipants = selected.filter((participant) => participant.team === team);
    const starters = teamParticipants.filter((participant) => participant.rosterStatus === "Starter");
    const substitutes = teamParticipants.filter((participant) => participant.rosterStatus === "Sub");
    if (teamParticipants.length > 30) errors.push(`Team ${team} exceeds 30 players`);
    if (starters.length > 20) errors.push(`Team ${team} exceeds 20 starters`);
    if (substitutes.length > 10) errors.push(`Team ${team} exceeds 10 substitutes`);
    if (!teamParticipants.length) warnings.push(`Team ${team} has no selected players`);

    const counts = new Map();
    for (const participant of starters) {
      const unit = participant.unit || "Unassigned";
      counts.set(unit, (counts.get(unit) || 0) + 1);
    }
    for (const [unit, count] of counts) {
      if (unit !== "Unassigned" && count > 5) warnings.push(`${unit} on Team ${team} has ${count} starters`);
    }
  }

  if (!selected.length) errors.push("Select at least one participant");
  if (!errors.length) passed.push("Roster has no blocking assignment conflicts");
  return { ready: errors.length === 0, errors, warnings, passed };
}

export function validatePhases(phases = []) {
  const errors = [];
  const sorted = [...phases].sort((a, b) => Number(a.startMinute) - Number(b.startMinute));
  for (let index = 0; index < sorted.length; index += 1) {
    const phase = sorted[index];
    if (!phase.name) errors.push(`Phase ${index + 1} needs a name`);
    if (Number(phase.startMinute) < 0 || Number(phase.endMinute) <= Number(phase.startMinute)) {
      errors.push(`${phase.name || `Phase ${index + 1}`} has an invalid minute range`);
    }
    if (index && Number(phase.startMinute) < Number(sorted[index - 1].endMinute)) {
      errors.push(`${phase.name} overlaps ${sorted[index - 1].name}`);
    }
  }
  return errors;
}

function check(condition, success, failure, errors, passed) {
  (condition ? passed : errors).push(condition ? success : failure);
}

