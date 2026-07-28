import { authFetch, clearSession, liveUpdatesUrl, requireSession } from "./auth.js";
import { battlePhases, objectivePositions, strategyPlans, tacticalGroups } from "./battle-plan.js";

const api = {
  async getState() {
    return request("/api/state");
  },
  async createEvent(payload = {}) {
    return request("/api/events", { method: "POST", body: JSON.stringify(payload) });
  },
  async updateEvent(id, patch) {
    return request(`/api/events/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
  },
  async transitionEvent(id, action, payload = {}) {
    return request(`/api/events/${encodeURIComponent(id)}/${action}`, { method: "POST", body: JSON.stringify(payload) });
  },
  async updateParticipant(eventId, playerId, patch) {
    return request(`/api/events/${encodeURIComponent(eventId)}/participants/${encodeURIComponent(playerId)}`, {
      method: "PATCH", body: JSON.stringify(patch)
    });
  },
  async updateAvailability(eventId, payload) {
    return request(`/api/events/${encodeURIComponent(eventId)}/availability`, {
      method: "POST", body: JSON.stringify(payload)
    });
  },
  async getParticipation(query = "") {
    return request(`/api/participation${query}`);
  },
  async getAudit(eventId) {
    return request(`/api/events/${encodeURIComponent(eventId)}/audit`);
  },
  async getUsers() {
    return request("/api/users");
  },
  async updateUser(id, patch) {
    return request(`/api/users/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
  },
  async getDataQuality() {
    return request("/api/data-quality");
  },
  async applyStrategy(eventId, payload) {
    return request(`/api/events/${encodeURIComponent(eventId)}/apply-strategy`, {
      method: "POST", body: JSON.stringify(payload)
    });
  },
  async updateStrategyOrder(eventId, team, payload) {
    return request(`/api/events/${encodeURIComponent(eventId)}/strategy/${team}`, {
      method: "PATCH", body: JSON.stringify(payload)
    });
  },
  async updateMember(id, patch) {
    return request(`/api/members/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
  },
  async updateSettings(patch) {
    return request("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
  },
  async archiveBattle(payload) {
    return request("/api/archive-battle", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  async deleteBattle(id) {
    return request(`/api/battles/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
  },
  async clearHistory() {
    return request("/api/battles", { method: "DELETE" });
  },
  async importResultsScreenshot(file, team) {
    const formData = new FormData();
    formData.append("screenshot", file);
    return request(`/api/import-results-screenshot?team=${encodeURIComponent(team)}`, {
      method: "POST",
      body: formData,
      headers: {}
    });
  },
  async applyResultMatchFix(fix) {
    return request("/api/result-match-fix", {
      method: "POST",
      body: JSON.stringify(fix)
    });
  },
  async resetWeek() {
    return request("/api/reset-week", { method: "POST" });
  }
};

const strategies = [
  "Standard Control & Rotation",
  "Early Refinery Pressure",
  "Defensive Structure Hold",
  "Late-Game Strike"
];

const serverTimes = ["9:00", "18:00", "23:00"];

const units = [
  "Unassigned",
  "Oil Refinery 1",
  "Oil Refinery 2",
  "Field Hospital 1",
  "Field Hospital 2",
  "Field Hospital 3",
  "Field Hospital 4",
  "Info Center",
  "Arsenal",
  "Nuclear Silo",
  "Mercenary Factory",
  "Science Hub"
];

const unitResponsibilities = {
  "Unassigned": "Await officer assignment before battle.",
  "Oil Refinery 1": "Capture and defend the west refinery; report pressure early and hold until relieved.",
  "Oil Refinery 2": "Capture and defend the east refinery; coordinate rotations with the Science Hub.",
  "Field Hospital 1": "Secure the southwest hospital and protect the blue-side approach.",
  "Field Hospital 2": "Secure the east hospital and watch the red-side approach.",
  "Field Hospital 3": "Hold the south-central hospital and reinforce the Mercenary Factory lane.",
  "Field Hospital 4": "Hold the north-east hospital and support the Arsenal lane.",
  "Info Center": "Control the north-west information structure and relay enemy movement.",
  "Arsenal": "Contest and hold the north-central Arsenal; call reinforcements before control is lost.",
  "Nuclear Silo": "Prioritize the central Nuclear Silo and coordinate team-wide reinforcement.",
  "Mercenary Factory": "Control the south-central factory and protect rotations between southern objectives.",
  "Science Hub": "Secure the south-east Science Hub and support Oil Refinery 2."
};

let state = null;
let timelineTeam = "A";
let timelinePhaseIndex = 0;
let timelinePlaybackTimer = null;

const elements = {
  saveStatus: document.querySelector("#saveStatus"),
  connectionStatus: document.querySelector("#connectionStatus"),
  eventBanner: document.querySelector("#eventBanner"),
  myAssignmentContent: document.querySelector("#myAssignmentContent"),
  eventActions: document.querySelector("#eventActions"),
  publishReadiness: document.querySelector("#publishReadiness"),
  eventList: document.querySelector("#eventList"),
  createEventButton: document.querySelector("#createEventButton"),
  participationTeam: document.querySelector("#participationTeam"),
  participationUnit: document.querySelector("#participationUnit"),
  participationSummary: document.querySelector("#participationSummary"),
  participationRows: document.querySelector("#participationRows"),
  strategyControls: document.querySelector("#strategyControls"),
  strategyTimelineContent: document.querySelector("#strategyTimelineContent"),
  auditList: document.querySelector("#auditList"),
  dataQuality: document.querySelector("#dataQuality"),
  userList: document.querySelector("#userList"),
  summaryCards: document.querySelector("#summaryCards"),
  readinessPanels: document.querySelector("#readinessPanels"),
  directoryRows: document.querySelector("#directoryRows"),
  resultRows: document.querySelector("#resultRows"),
  teamPanels: document.querySelector("#teamPanels"),
  assignmentBoardA: document.querySelector("#assignmentBoardA"),
  assignmentBoardB: document.querySelector("#assignmentBoardB"),
  historyList: document.querySelector("#historyList"),
  searchInput: document.querySelector("#searchInput"),
  filterInput: document.querySelector("#filterInput"),
  strategyA: document.querySelector("#strategyA"),
  strategyB: document.querySelector("#strategyB"),
  battleTimeA: document.querySelector("#battleTimeA"),
  battleTimeB: document.querySelector("#battleTimeB"),
  assignmentTimeA: document.querySelector("#assignmentTimeA"),
  assignmentTimeB: document.querySelector("#assignmentTimeB"),
  battleForm: document.querySelector("#battleForm"),
  screenshotInput: document.querySelector("#screenshotInput"),
  importScreenshotButton: document.querySelector("#importScreenshotButton"),
  screenshotTeam: document.querySelector("#screenshotTeam"),
  importStatus: document.querySelector("#importStatus"),
  importMatches: document.querySelector("#importMatches"),
  clearHistoryButton: document.querySelector("#clearHistoryButton")
};
const expandedPlayers = new Set();
let liveSource = null;

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  requireSession();
  bindNavigation();
  bindControls();
  fillStrategySelects();
  await refreshState();
  connectLiveUpdates();
}

async function request(url, options = {}) {
  const response = await authFetch(url, options);
  const payload = await response.json();

  if (!response.ok) {
    const error = new Error(payload.error || "Request failed");
    error.details = payload.details;
    error.latest = payload.latest;
    error.status = response.status;
    throw error;
  }

  return payload;
}

async function refreshState() {
  try {
    setStatus("Loading shared data...");
    state = await api.getState();
    render();
    setStatus(`Synced ${formatTime(state.updatedAt)}`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function bindNavigation() {
  document.querySelector(".sidebar").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-view]");
    if (!button) return;

    document.querySelectorAll(".sidebar button").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
    button.classList.add("active");
    document.querySelector(`#${button.dataset.view}`).classList.add("active");
  });
}

function bindControls() {
  document.querySelector("#refreshButton").addEventListener("click", refreshState);
  document.querySelector("#logoutButton").addEventListener("click", logout);
  elements.searchInput.addEventListener("input", renderDirectory);
  elements.filterInput.addEventListener("change", renderDirectory);
  elements.directoryRows.addEventListener("change", handleMemberChange);
  elements.directoryRows.addEventListener("click", handleDirectoryClick);
  elements.resultRows.addEventListener("change", handleMemberChange);
  elements.strategyA.addEventListener("change", () => saveSettings({ strategyA: elements.strategyA.value }));
  elements.strategyB.addEventListener("change", () => saveSettings({ strategyB: elements.strategyB.value }));
  elements.battleTimeA.addEventListener("change", () => saveSettings({ battleTimeA: elements.battleTimeA.value }));
  elements.battleTimeB.addEventListener("change", () => saveSettings({ battleTimeB: elements.battleTimeB.value }));
  elements.battleForm.addEventListener("submit", archiveBattle);
  elements.importScreenshotButton.addEventListener("click", importResultsScreenshot);
  elements.importMatches.addEventListener("click", handleMatchFixClick);
  elements.historyList.addEventListener("click", handleHistoryClick);
  elements.clearHistoryButton.addEventListener("click", clearHistory);
  elements.createEventButton.addEventListener("click", createNextEvent);
  elements.eventActions.addEventListener("click", handleEventAction);
  elements.eventActions.addEventListener("change", handleEventFieldChange);
  elements.participationTeam.addEventListener("change", renderParticipation);
  elements.participationUnit.addEventListener("change", renderParticipation);
  elements.myAssignmentContent.addEventListener("click", handleAvailabilityClick);
  elements.myAssignmentContent.addEventListener("change", handleAvailabilityNote);
  elements.strategyControls.addEventListener("change", handleStrategyApply);
  elements.strategyTimelineContent.addEventListener("click", handleTimelineClick);
  elements.strategyTimelineContent.addEventListener("change", handleTimelineChange);
  elements.userList.addEventListener("change", handleUserChange);
}

function logout() {
  clearSession();
  window.location.href = "/login.html";
}

function fillStrategySelects() {
  elements.strategyA.innerHTML = optionHtml(strategies);
  elements.strategyB.innerHTML = optionHtml(strategies);
  elements.battleTimeA.innerHTML = optionHtml(serverTimes);
  elements.battleTimeB.innerHTML = optionHtml(serverTimes);
  elements.participationUnit.innerHTML = `<option value="">All units</option>${units.slice(1).map((unit) => `<option>${escapeHtml(unit)}</option>`).join("")}`;
}

function render() {
  applyRoleVisibility();
  renderEventBanner();
  renderMyAssignment();
  renderEvents();
  renderDashboard();
  renderDirectory();
  renderTeams();
  renderAssignments();
  renderResults();
  renderHistory();
  renderStrategyTimeline();
  if (state.permissions.isOfficer) {
    renderParticipation();
    renderAudit();
  }
  if (state.permissions.isAdministrator) renderAdministration();
  elements.strategyA.value = state.settings.strategyA;
  elements.strategyB.value = state.settings.strategyB;
  elements.battleTimeA.value = state.settings.battleTimeA;
  elements.battleTimeB.value = state.settings.battleTimeB;
  elements.assignmentTimeA.textContent = `${state.settings.battleTimeA} Server Time`;
  elements.assignmentTimeB.textContent = `${state.settings.battleTimeB} Server Time`;
}

function applyRoleVisibility() {
  document.querySelectorAll("[data-role='officer']").forEach((element) => {
    element.hidden = !state.permissions.isOfficer;
  });
  document.querySelectorAll("[data-role='administrator']").forEach((element) => {
    element.hidden = !state.permissions.isAdministrator;
  });
  elements.clearHistoryButton.hidden = !state.permissions.isAdministrator;
  const officerOnlyViews = ["directory", "teams", "assignmentsA", "assignmentsB", "results"];
  document.querySelectorAll(".sidebar button").forEach((button) => {
    if (officerOnlyViews.includes(button.dataset.view)) button.hidden = !state.permissions.isOfficer;
  });
  if (state.permissions.isMember) {
    document.querySelectorAll(".sidebar button, .view").forEach((item) => item.classList.remove("active"));
    document.querySelector("[data-view='myAssignment']").classList.add("active");
    document.querySelector("#myAssignment").classList.add("active");
  }
}

async function renderAdministration() {
  try {
    const [users, quality] = await Promise.all([api.getUsers(), api.getDataQuality()]);
    const qualityGroups = [
      ["Duplicate names", quality.duplicatePlayerNames],
      ["Unlinked users", quality.unlinkedUsers],
      ["Missing attendance", quality.missingHistoricalAttendance],
      ["Invalid teams", quality.invalidTeams],
      ["Invalid units", quality.invalidUnits],
      ["Events missing results", quality.eventsMissingResults],
      ["Inactive assignments", quality.inactiveAssignedPlayers],
      ["Unmatched screenshots", quality.unmatchedScreenshotResults]
    ];
    elements.dataQuality.innerHTML = qualityGroups.map(([label, records]) =>
      validationPanel(label, records, records.length ? "warning" : "passed")
    ).join("");
    elements.userList.innerHTML = users.map((user) => `
      <article class="panel user-card" data-user-id="${escapeHtml(user.uid)}">
        <div><strong>${escapeHtml(user.displayName)}</strong><span>${escapeHtml(user.email)}</span></div>
        <label>Role<select data-user-field="role">${optionHtml(["member", "officer", "administrator"], user.role)}</select></label>
        <label>Linked player<select data-user-field="playerId"><option value="">Not linked</option>${state.players.map((player) => `<option value="${escapeHtml(player.id)}" ${player.id === user.playerId ? "selected" : ""}>${escapeHtml(player.gameName)}</option>`).join("")}</select></label>
        <label>Active<input data-user-field="active" type="checkbox" ${user.active ? "checked" : ""}></label>
      </article>
    `).join("") || emptyState("No application users have signed in yet.");
  } catch (error) {
    elements.userList.innerHTML = emptyState(error.message);
  }
}

async function handleUserChange(event) {
  const card = event.target.closest("[data-user-id]");
  const field = event.target.dataset.userField;
  if (!card || !field) return;
  const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
  try {
    await api.updateUser(card.dataset.userId, { [field]: value });
    await renderAdministration();
    setStatus("User access updated");
  } catch (error) {
    setStatus(error.message, true);
    await renderAdministration();
  }
}

function renderEventBanner() {
  const event = state.activeEvent;
  if (!event) {
    elements.eventBanner.innerHTML = `<strong>No active battle</strong><span>Officers can create the next battle plan.</span>`;
    elements.eventBanner.dataset.status = "empty";
    return;
  }
  elements.eventBanner.dataset.status = event.status;
  elements.eventBanner.innerHTML = `
    <strong>${eventStatusLabel(event.status)}</strong>
    <span>${escapeHtml(event.date)}${event.opponent ? ` · vs ${escapeHtml(event.opponent)}` : ""}</span>
    <small>Updated ${escapeHtml(formatDateTime(event.updatedAt))}</small>
  `;
}

function renderMyAssignment() {
  const event = state.activeEvent;
  const playerId = state.me.playerId;
  const participant = state.participants.find((item) => item.playerId === playerId);
  if (!event) {
    elements.myAssignmentContent.innerHTML = emptyState("No published battle is available.");
    return;
  }
  if (!playerId || !participant) {
    elements.myAssignmentContent.innerHTML = emptyState("Your account is not linked to a roster player yet. Ask an administrator to link it.");
    return;
  }
  const strategy = state.eventStrategy?.[participant.team];
  const battleTime = event[`battleTime${participant.team}`] || "Not set";
  elements.myAssignmentContent.innerHTML = `
    <article class="assignment-profile panel">
      <div class="assignment-profile-heading">
        <div><p class="eyebrow">Team ${escapeHtml(participant.team)}</p><h3>${escapeHtml(participant.playerName)}</h3></div>
        ${statusBadge(participant.availability)}
      </div>
      <div class="assignment-details">
        ${detail("Battle", `${event.date} · ${event.opponent || "Opponent pending"}`)}
        ${detail("Roster", participant.rosterStatus)}
        ${detail("Server time", battleTime)}
        ${detail("Role", participant.role || "Not assigned")}
        ${detail("Unit", participant.unit || "Not assigned")}
        ${detail("Primary", participant.primaryAssignment || "Not assigned")}
        ${detail("Backup", participant.backupAssignment || "Not assigned")}
        ${detail("Strategy", strategy?.name || event[`strategy${participant.team}`] || "Not selected")}
      </div>
      <div class="important-instructions"><strong>Important instructions</strong><p>${escapeHtml(event.importantInstructions || strategy?.description || "No additional instructions.")}</p></div>
      <div class="availability-controls">
        <strong>My availability</strong>
        <div>
          ${["Confirmed", "Tentative", "Unavailable"].map((value) => `<button class="${participant.availability === value ? "primary-button" : "secondary-button"}" type="button" data-availability="${value}">${value}</button>`).join("")}
        </div>
        <label>Availability note<input id="availabilityNote" value="${escapeHtml(participant.availabilityNote || "")}" maxlength="180" placeholder="Optional short note"></label>
      </div>
      <p class="muted">Assignment updated ${escapeHtml(formatDateTime(participant.updatedAt))}</p>
    </article>
  `;
}

function renderEvents() {
  if (!state.permissions.isOfficer) return;
  const event = state.activeEvent;
  const validation = event ? validatePublishReadiness(event, state.participants) : { errors: [], warnings: [], passed: [] };
  elements.eventActions.innerHTML = event ? `
    <div class="event-action-heading"><div><h3>${escapeHtml(event.date)} · ${escapeHtml(event.opponent || "Opponent pending")}</h3><p class="muted">${eventStatusLabel(event.status)} · version ${event.version}</p></div>${statusBadge(event.status)}</div>
    <div class="event-editor">
      <label>Battle date<input data-event-field="date" type="date" value="${escapeHtml(event.date)}" ${event.status !== "draft" ? "disabled" : ""}></label>
      <label>Opponent<input data-event-field="opponent" value="${escapeHtml(event.opponent)}" placeholder="Opponent alliance" ${event.status !== "draft" ? "disabled" : ""}></label>
      <label class="event-instructions">Important instructions<textarea data-event-field="importantInstructions" ${event.status === "archived" ? "disabled" : ""}>${escapeHtml(event.importantInstructions || "")}</textarea></label>
    </div>
    <div class="event-action-buttons">
      <button class="secondary-button" data-event-action="duplicate" type="button">Duplicate Previous Battle</button>
      ${event.status === "draft" ? `<button class="primary-button" data-event-action="publish" type="button">Publish Battle Plan</button>` : ""}
      ${event.status === "published" ? `<button class="primary-button" data-event-action="start" type="button">Start Battle</button>` : ""}
      ${event.status === "in_progress" ? `<button class="primary-button" data-event-action="complete" type="button">Complete Battle</button>` : ""}
      ${event.status === "completed" ? `<button class="primary-button" data-event-action="archive" type="button">Archive Battle</button>` : ""}
    </div>
  ` : `<p>No event exists yet.</p>`;
  elements.publishReadiness.innerHTML = event ? [
    validationPanel("Errors", validation.errors, "error"),
    validationPanel("Warnings", validation.warnings, "warning"),
    validationPanel("Passed", validation.passed, "passed")
  ].join("") : "";
  elements.eventList.innerHTML = state.events.map((item) => `
    <article class="history-card event-list-card">
      <div><h3>${escapeHtml(item.date)} · ${escapeHtml(item.opponent || "Opponent pending")}</h3><p class="muted">Team A ${escapeHtml(item.battleTimeA)} · Team B ${escapeHtml(item.battleTimeB)}</p></div>
      ${statusBadge(item.status)}
    </article>
  `).join("");
}

async function handleEventFieldChange(event) {
  const field = event.target.dataset.eventField;
  if (!field || !state.activeEvent) return;
  try {
    await api.updateEvent(state.activeEvent.id, {
      [field]: event.target.value,
      version: state.activeEvent.version
    });
    await refreshState();
    setStatus("Event details saved");
  } catch (error) {
    setStatus(error.message, true);
    await refreshState();
  }
}

async function createNextEvent() {
  try {
    setStatus("Creating battle...");
    const date = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    await api.createEvent({ date });
    await refreshState();
    setStatus("Draft battle created");
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function handleEventAction(event) {
  const button = event.target.closest("[data-event-action]");
  if (!button || !state.activeEvent) return;
  try {
    button.disabled = true;
    setStatus("Updating event...");
    const action = button.dataset.eventAction;
    const payload = action === "duplicate"
      ? { date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) }
      : {};
    await api.transitionEvent(state.activeEvent.id, action, payload);
    await refreshState();
    setStatus(`Event ${action} complete`);
  } catch (error) {
    setStatus(error.message, true);
    if (error.details) renderServerValidation(error.details);
  } finally {
    button.disabled = false;
  }
}

async function handleAvailabilityClick(event) {
  const button = event.target.closest("[data-availability]");
  if (!button || !state.me.playerId || !state.activeEvent) return;
  const participant = state.participants.find((item) => item.playerId === state.me.playerId);
  try {
    setStatus("Saving availability...");
    await api.updateAvailability(state.activeEvent.id, {
      playerId: state.me.playerId,
      availability: button.dataset.availability,
      availabilityNote: document.querySelector("#availabilityNote")?.value || "",
      version: participant.version
    });
    await refreshState();
    setStatus("Availability saved");
  } catch (error) {
    setStatus(error.message, true);
    await refreshState();
  }
}

async function handleAvailabilityNote(event) {
  if (event.target.id !== "availabilityNote") return;
  const participant = state.participants.find((item) => item.playerId === state.me.playerId);
  if (!participant) return;
  try {
    await api.updateAvailability(state.activeEvent.id, {
      playerId: state.me.playerId,
      availability: participant.availability,
      availabilityNote: event.target.value,
      version: participant.version
    });
    await refreshState();
  } catch (error) {
    setStatus(error.message, true);
  }
}

function renderDashboard() {
  const selectedMembers = selected();
  const confirmed = selectedMembers.filter((member) => member.availability === "Confirmed").length;
  const readinessA = readiness("A");
  const readinessB = readiness("B");

  elements.summaryCards.innerHTML = [
    summaryCard("Members", state.members.length),
    summaryCard("Selected", selectedMembers.length),
    summaryCard("Team A", selected("A").length),
    summaryCard("Team B", selected("B").length),
    summaryCard("Confirmed", confirmed),
    summaryCard("Readiness", `${Math.round((readinessA.score + readinessB.score) / 2)}%`)
  ].join("");

  elements.readinessPanels.innerHTML = [readinessPanel("A", readinessA), readinessPanel("B", readinessB)].join("");
}

function renderDirectory() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const filter = elements.filterInput.value;
  const rows = state.members
    .filter((member) => !query || member.name.toLowerCase().includes(query))
    .filter((member) => {
      if (filter === "selected") return member.selected;
      if (filter === "reserve") return member.team === "Reserve";
      return true;
    })
    .map(directoryRow)
    .join("");

  elements.directoryRows.innerHTML = rows || `<tr><td colspan="7">No members match this view.</td></tr>`;
}

function renderTeams() {
  elements.teamPanels.innerHTML = ["A", "B"].map((team) => {
    const members = selected(team);
    const starters = members.filter((member) => member.type === "Starter");
    const subs = members.filter((member) => member.type === "Sub");

    return `
      <article class="panel">
        <h3>Team ${team}</h3>
        <p class="team-battle-time">${escapeHtml(state.settings[`battleTime${team}`])} Server Time</p>
        <p class="muted">${starters.length}/20 starters · ${subs.length}/10 substitutes</p>
        ${teamList("Starters", starters)}
        ${teamList("Substitutes", subs)}
      </article>
    `;
  }).join("");
}

function renderAssignments() {
  renderTeamAssignments("A", elements.assignmentBoardA);
  renderTeamAssignments("B", elements.assignmentBoardB);
}

function renderTeamAssignments(team, board) {
  const members = selected(team).sort((left, right) =>
    roleOrder(left.type) - roleOrder(right.type) || left.name.localeCompare(right.name)
  );
  const groups = members.reduce((byUnit, member) => {
    const unit = assignedUnit(member);
    if (!byUnit.has(unit)) byUnit.set(unit, []);
    byUnit.get(unit).push(member);
    return byUnit;
  }, new Map());

  const assignedCount = members.filter((member) => assignedUnit(member) !== "Unassigned").length;
  const confirmedCount = members.filter((member) => member.availability === "Confirmed").length;
  const summary = `
    <article class="assignment-summary panel">
      <div><span>Battle time</span><strong>${escapeHtml(state.settings[`battleTime${team}`])}</strong></div>
      <div><span>Roster</span><strong>${members.length}/30</strong></div>
      <div><span>Assigned</span><strong>${assignedCount}/${members.length}</strong></div>
      <div><span>Confirmed</span><strong>${confirmedCount}/${members.length}</strong></div>
    </article>
  `;
  const cards = units
    .filter((unit) => groups.has(unit))
    .map((unit) => `
      <article class="panel">
        <div class="assignment-heading">
          <h3>${escapeHtml(unit)}</h3>
          <span>${groups.get(unit).length} assigned</span>
        </div>
        <p class="unit-responsibility">${escapeHtml(unitResponsibilities[unit])}</p>
        ${(groups.get(unit) || []).map((member, index) => `
          <div class="assignment-item">
            <span class="assignment-number">${index + 1}</span>
            <strong>${escapeHtml(member.name)}</strong>
            <span class="assignment-meta">${escapeHtml(member.type)} · ${escapeHtml(member.availability)}</span>
          </div>
        `).join("")}
      </article>
    `).join("");

  board.innerHTML = members.length
    ? `${summary}${cards}`
    : `<article class="panel"><p>No Team ${team} players are selected yet.</p></article>`;
}

function renderResults() {
  const importedIds = new Set((state.pendingResults || []).map((result) => result.memberId));
  const importedRows = (state.pendingResults || []).map((result) => `
    <tr class="imported-result-row">
      <td><strong>${escapeHtml(result.name)}</strong> <span class="badge">Screenshot</span></td>
      <td>${escapeHtml(result.team)}</td>
      <td>${escapeHtml(result.attendance || "Present")}</td>
      <td>${Number(result.score || 0).toLocaleString()}</td>
      <td>${escapeHtml(result.notes || "")}</td>
    </tr>
  `);
  const manualRows = selected()
    .filter((member) => !importedIds.has(member.id))
    .map((member) => `
    <tr>
      <td><strong>${escapeHtml(member.name)}</strong></td>
      <td>${escapeHtml(member.team)}</td>
      <td>
        <select data-member-id="${member.id}" data-field="weekAttendance">
          ${optionHtml(["", "Present", "Late", "No-show", "Excused"], member.weekAttendance)}
        </select>
      </td>
      <td><input data-member-id="${member.id}" data-field="weekScore" type="number" min="0" value="${Number(member.weekScore || 0)}"></td>
      <td><input data-member-id="${member.id}" data-field="weekNotes" value="${escapeHtml(member.weekNotes || "")}"></td>
    </tr>
  `);
  const rows = [...importedRows, ...manualRows].join("");
  elements.resultRows.innerHTML = rows || `<tr><td colspan="5">Import a screenshot or select players before recording results.</td></tr>`;
}

function renderHistory() {
  elements.historyList.innerHTML = state.battles.map((battle) => `
    <article class="history-card">
      <div class="history-card-heading">
        <h3>${escapeHtml(battle.date)} · ${escapeHtml(battle.outcome)} vs ${escapeHtml(battle.opponent)}</h3>
        <button class="danger-button history-delete-button" type="button" data-delete-battle="${escapeHtml(battle.id)}">Delete</button>
      </div>
      <p>${Number(battle.scoreFor).toLocaleString()} - ${Number(battle.scoreAgainst).toLocaleString()}</p>
      <p class="muted">${escapeHtml(battle.players.length)} players archived · ${escapeHtml(battle.notes || "No notes")}</p>
      <div class="history-score-table">
        <table>
          <thead>
            <tr><th>Player</th><th>Team</th><th>Score</th><th>Attendance</th><th>Source</th></tr>
          </thead>
          <tbody>
            ${(battle.players || []).map((player) => `
              <tr>
                <td>${escapeHtml(player.name)}</td>
                <td>${escapeHtml(player.team || "")}</td>
                <td>${Number(player.score || 0).toLocaleString()}</td>
                <td>${escapeHtml(player.attendance || "")}</td>
                <td>${escapeHtml(player.source || "manual")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </article>
  `).join("") || `<article class="panel"><p>No battles have been archived yet.</p></article>`;
}

async function renderParticipation() {
  if (!state?.permissions?.isOfficer) return;
  const params = new URLSearchParams();
  if (elements.participationTeam.value) params.set("team", elements.participationTeam.value);
  if (elements.participationUnit.value) params.set("unit", elements.participationUnit.value);
  try {
    const statistics = await api.getParticipation(params.size ? `?${params}` : "");
    const selected = statistics.reduce((sum, item) => sum + item.eventsSelected, 0);
    const attended = statistics.reduce((sum, item) => sum + item.eventsAttended, 0);
    const currentParticipants = state.participants.filter((item) => item.selected);
    const confirmed = currentParticipants.filter((item) => item.availability === "Confirmed").length;
    const starters = currentParticipants.filter((item) => item.rosterStatus === "Starter");
    elements.participationSummary.innerHTML = [
      summaryCard("Alliance attendance", `${selected ? Math.round((attended / selected) * 100) : 0}%`),
      summaryCard("Current confirmation", `${currentParticipants.length ? Math.round((confirmed / currentParticipants.length) * 100) : 0}%`),
      summaryCard("Starter confirmation", `${starters.length ? Math.round((starters.filter((item) => item.availability === "Confirmed").length / starters.length) * 100) : 0}%`),
      summaryCard("Awaiting response", currentParticipants.filter((item) => item.availability === "Pending").length)
    ].join("");
    elements.participationRows.innerHTML = statistics
      .sort((left, right) => right.attendancePercentage - left.attendancePercentage || right.eventsAttended - left.eventsAttended)
      .map((item) => `
        <article class="member-card panel">
          <div class="member-card-heading"><h3>${escapeHtml(item.playerName)}</h3><strong>${item.attendancePercentage}%</strong></div>
          <div class="metric-row"><span>Attended</span><strong>${item.eventsAttended}/${item.eventsSelected}</strong></div>
          <div class="metric-row"><span>Confirmed</span><strong>${item.confirmationPercentage}%</strong></div>
          <div class="metric-row"><span>Average score</span><strong>${Number(item.averageScore).toLocaleString()}</strong></div>
          <div class="metric-row"><span>Current streak</span><strong>${item.currentAttendanceStreak}</strong></div>
          <div class="metric-row"><span>Best streak</span><strong>${item.consecutiveAttendanceStreak}</strong></div>
        </article>
      `).join("") || emptyState("No archived participation records match these filters.");
  } catch (error) {
    elements.participationRows.innerHTML = emptyState(error.message);
  }
}

function renderStrategyTimeline() {
  const event = state.activeEvent;
  if (!event) {
    elements.strategyTimelineContent.innerHTML = emptyState("No active event strategy.");
    return;
  }
  if (state.permissions.isOfficer) {
    elements.strategyControls.innerHTML = `
      <label>Template
        <select id="strategyTemplateSelect">
          <option value="">Choose template</option>
          ${state.strategyTemplates.map((template) => `<option value="${escapeHtml(template.id)}">${escapeHtml(template.name)}</option>`).join("")}
        </select>
      </label>
      <label>Apply to
        <select id="strategyApplyTeam"><option>A</option><option>B</option></select>
      </label>
    `;
  }
  const teams = state.permissions.isMember
    ? [state.participants.find((item) => item.playerId === state.me.playerId)?.team].filter((team) => ["A", "B"].includes(team))
    : ["A", "B"];
  if (!teams.includes(timelineTeam)) timelineTeam = teams[0];
  if (!timelineTeam) {
    elements.strategyTimelineContent.innerHTML = emptyState("Your account is not linked to a team assignment.");
    return;
  }
  const strategy = state.eventStrategy?.[timelineTeam];
  const phases = battlePhases.map((key, index) => {
    const [startMinute, endMinute] = key.split("-").map(Number);
    const saved = strategy?.phases?.find((item) => Number(item.startMinute) === startMinute) || {};
    return { name: saved.name || `Battle phase ${index + 1}`, startMinute, endMinute, instructions: saved.instructions || "Execute the defined group orders.", fallbackPlan: saved.fallbackPlan || "Shift to the secondary objective on command.", groupOrders: saved.groupOrders || {} };
  });
  timelinePhaseIndex = Math.min(timelinePhaseIndex, Math.max(phases.length - 1, 0));
  const phase = phases[timelinePhaseIndex];
  const orders = timelineGroupOrders(timelineTeam, phase, timelinePhaseIndex);
  const activeObjectives = new Set(orders.flatMap((order) => [order.primaryObjective, order.secondaryObjective]).filter(Boolean));

  elements.strategyTimelineContent.innerHTML = `
    <div class="timeline-map-controls panel">
      <div class="timeline-team-switch">${teams.map((team) => `<button type="button" data-timeline-team="${team}" class="${team === timelineTeam ? "active" : ""}">Team ${team}</button>`).join("")}</div>
      <div><strong>${escapeHtml(strategy?.name || event[`strategy${timelineTeam}`])}</strong><span>Team ${timelineTeam} · ${escapeHtml(event[`battleTime${timelineTeam}`])} Server Time</span></div>
    </div>
    ${phases.length ? `
      <div class="timeline-playback-bar">
        <button class="primary-button" type="button" data-timeline-play>${timelinePlaybackTimer ? "Pause playback" : "Play strategy"}</button>
        <input aria-label="Battle timeline" data-timeline-scrubber type="range" min="0" max="5" step="1" value="${timelinePhaseIndex}">
        <strong>${Number(phase.startMinute)}–${Number(phase.endMinute)} min</strong>
      </div>
      <div class="timeline-phase-buttons">${phases.map((item, index) => `<button type="button" data-timeline-phase="${index}" class="${index === timelinePhaseIndex ? "active" : ""}">${Number(item.startMinute)}–${Number(item.endMinute)} min</button>`).join("")}</div>
      <article class="timeline-phase-summary panel">
        <div><span>Current phase</span><strong>${escapeHtml(phase.name)}</strong></div>
        <p>${escapeHtml(phase.instructions || "")}</p>
        <small>${escapeHtml(phase.fallbackPlan ? `Secondary command: ${phase.fallbackPlan}` : "Follow the primary command until an officer calls the fallback.")}</small>
      </article>
      <div class="strategy-map-layout">
        <div class="strategy-tactical-map" aria-label="Interactive Desert Storm objective map">
          <img src="/assets/desert-storm-map-clean.png" alt="Desert Storm battle map">
          <div class="strategy-route-layer">${timelineRoutes(orders)}</div>
          <div class="strategy-group-layer">${timelineGroupMarkers(orders)}</div>
          <div class="strategy-objective-layer">${Object.entries(objectivePositions).map(([objective, [x, y]]) => `
            <button type="button" class="strategy-objective ${activeObjectives.has(objective) ? "active" : ""}" style="left:${x}%;top:${y}%" data-map-objective="${escapeHtml(objective)}"><span>${escapeHtml(objective)}</span></button>
          `).join("")}</div>
        </div>
        <div class="strategy-unit-orders">${orders.map(timelineOrderCard).join("") || `<p class="muted">No Team ${timelineTeam} units are assigned for this battle.</p>`}</div>
      </div>
    ` : `<article class="panel"><p class="muted">Apply a reusable strategy template to add timed battle phases and map commands.</p></article>`}
  `;
}

function timelineGroupOrders(team, phase, phaseIndex) {
  const fallbackPlan = strategyPlans[team]?.phases?.[battlePhases[phaseIndex]] || {};
  const previousFallbackPlan = phaseIndex > 0 ? strategyPlans[team]?.phases?.[battlePhases[phaseIndex - 1]] || {} : {};
  const strategy = state.eventStrategy?.[team];
  const previousSavedPhase = phaseIndex > 0
    ? strategy?.phases?.find((item) => Number(item.startMinute) === Number(battlePhases[phaseIndex - 1].split("-")[0]))
    : null;
  return tacticalGroups.map((group) => {
    const saved = phase.groupOrders?.[group] || {};
    const fallback = fallbackPlan[group] || {};
    const members = state.participants.filter((item) =>
      item.selected && item.team === team && participantTacticalGroup(item) === group
    );
    return {
      group,
      members,
      previousObjective: previousSavedPhase?.groupOrders?.[group]?.primaryObjective || previousSavedPhase?.groupOrders?.[group]?.objective || previousFallbackPlan[group]?.objective || "",
      primaryObjective: saved.primaryObjective || saved.objective || fallback.objective || "",
      secondaryObjective: saved.secondaryObjective || fallback.secondaryObjective || "",
      primaryAction: saved.primaryAction || saved.action || fallback.action || "Hold",
      secondaryAction: saved.secondaryAction || "Support"
    };
  });
}

function timelineOrderCard(order) {
  return `<article class="strategy-unit-order">
    <div class="assignment-heading"><h3>${escapeHtml(order.group)}</h3><span>${order.members.length} players</span></div>
    <dl>
      <div><dt>Primary objective</dt><dd>${escapeHtml(order.primaryObjective || "Officer call")}</dd></div>
      <div><dt>Secondary objective</dt><dd>${escapeHtml(order.secondaryObjective || "Officer call")}</dd></div>
      <div><dt>Primary action</dt><dd>${escapeHtml(order.primaryAction)}</dd></div>
      <div><dt>Secondary action</dt><dd>${escapeHtml(order.secondaryAction)}</dd></div>
    </dl>
    <small>${order.members.length ? order.members.map((member) => escapeHtml(member.playerName)).join(" · ") : "No assigned members"}</small>
    ${state.permissions.isOfficer && state.eventStrategy?.[timelineTeam] ? timelineOrderEditor(order) : ""}
  </article>`;
}

function timelineOrderEditor(order) {
  const objectives = ["", ...Object.keys(objectivePositions)];
  const actions = ["Secure", "Support", "Rotate", "Attack", "Contest", "Hold", "Defend"];
  return `<div class="timeline-order-editor">
    <label>Primary objective<select data-strategy-group="${escapeHtml(order.group)}" data-strategy-field="primaryObjective">${optionHtml(objectives, order.primaryObjective)}</select></label>
    <label>Primary action<select data-strategy-group="${escapeHtml(order.group)}" data-strategy-field="primaryAction">${optionHtml(actions, order.primaryAction)}</select></label>
    <label>Secondary objective<select data-strategy-group="${escapeHtml(order.group)}" data-strategy-field="secondaryObjective">${optionHtml(objectives, order.secondaryObjective)}</select></label>
    <label>Secondary action<select data-strategy-group="${escapeHtml(order.group)}" data-strategy-field="secondaryAction">${optionHtml(actions, order.secondaryAction)}</select></label>
  </div>`;
}

function participantTacticalGroup(participant) {
  if (tacticalGroups.includes(participant.tacticalGroup)) return participant.tacticalGroup;
  if (tacticalGroups.includes(participant.unit)) return participant.unit;
  return "Reserve";
}

function timelineGroupMarkers(orders) {
  return orders.map((order, index) => {
    const position = objectivePositions[order.primaryObjective];
    if (!position) return "";
    const offset = (index % 3 - 1) * 2.3;
    return `<span class="strategy-group-marker" style="left:${position[0] + offset}%;top:${position[1] + offset}%" title="${escapeHtml(order.group)}: ${escapeHtml(order.members.map((member) => member.playerName).join(", ") || "No assigned members")}">${escapeHtml(tacticalGroupInitial(order.group))}</span>`;
  }).join("");
}

function tacticalGroupInitial(group) {
  return { "Unit A": "A", "Unit B": "B", "Unit C": "C", "Unit D": "D", "Strike Team": "ST", "Scout + Support": "SS", "Reserve": "R" }[group] || "?";
}

function timelineRoutes(orders) {
  return orders.map((order) => {
    const fromObjective = order.previousObjective || order.primaryObjective;
    const toObjective = order.previousObjective ? order.primaryObjective : order.secondaryObjective;
    const from = objectivePositions[fromObjective];
    const to = objectivePositions[toObjective];
    if (!from || !to || fromObjective === toObjective) return "";
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    return `<span class="strategy-route" style="left:${from[0]}%;top:${from[1]}%;width:${Math.hypot(dx, dy)}%;transform:rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg)"></span>`;
  }).join("");
}

function handleTimelineClick(event) {
  const teamButton = event.target.closest("[data-timeline-team]");
  const phaseButton = event.target.closest("[data-timeline-phase]");
  const playButton = event.target.closest("[data-timeline-play]");
  const objectiveButton = event.target.closest("[data-map-objective]");
  if (teamButton) {
    stopTimelinePlayback();
    timelineTeam = teamButton.dataset.timelineTeam;
    timelinePhaseIndex = 0;
    renderStrategyTimeline();
  } else if (phaseButton) {
    stopTimelinePlayback();
    timelinePhaseIndex = Number(phaseButton.dataset.timelinePhase);
    renderStrategyTimeline();
  } else if (playButton) {
    toggleTimelinePlayback();
  } else if (objectiveButton) {
    const objective = objectiveButton.dataset.mapObjective;
    elements.strategyTimelineContent.querySelectorAll(".strategy-unit-order").forEach((card) => {
      card.classList.toggle("highlighted", card.textContent.includes(objective));
    });
  }
}

async function handleTimelineChange(event) {
  if (event.target.matches("[data-timeline-scrubber]")) {
    stopTimelinePlayback();
    timelinePhaseIndex = Number(event.target.value);
    renderStrategyTimeline();
    return;
  }
  const group = event.target.dataset.strategyGroup;
  const field = event.target.dataset.strategyField;
  if (!group || !field) return;
  try {
    setStatus("Saving strategy adjustment...");
    state = await api.updateStrategyOrder(state.activeEvent.id, timelineTeam, {
      phase: battlePhases[timelinePhaseIndex],
      group,
      patch: { [field]: event.target.value }
    });
    render();
    setStatus("Strategy adjustment saved");
  } catch (error) {
    setStatus(error.message, true);
    await refreshState();
  }
}

function toggleTimelinePlayback() {
  if (timelinePlaybackTimer) {
    stopTimelinePlayback();
    renderStrategyTimeline();
    return;
  }
  if (timelinePhaseIndex >= battlePhases.length - 1) timelinePhaseIndex = 0;
  timelinePlaybackTimer = window.setInterval(() => {
    if (timelinePhaseIndex >= battlePhases.length - 1) {
      stopTimelinePlayback();
      renderStrategyTimeline();
      return;
    }
    timelinePhaseIndex += 1;
    renderStrategyTimeline();
  }, 2200);
  renderStrategyTimeline();
}

function stopTimelinePlayback() {
  if (timelinePlaybackTimer) window.clearInterval(timelinePlaybackTimer);
  timelinePlaybackTimer = null;
}

async function handleStrategyApply(event) {
  if (event.target.id !== "strategyTemplateSelect" || !event.target.value) return;
  try {
    await api.applyStrategy(state.activeEvent.id, {
      templateId: event.target.value,
      team: document.querySelector("#strategyApplyTeam").value
    });
    await refreshState();
    setStatus("Strategy template applied");
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function renderAudit() {
  if (!state?.permissions?.isOfficer || !state.activeEvent) return;
  try {
    const entries = await api.getAudit(state.activeEvent.id);
    elements.auditList.innerHTML = entries.slice(0, 200).map((entry) => `
      <article class="audit-entry panel">
        <div><strong>${escapeHtml(humanize(entry.action))}</strong><span>${escapeHtml(entry.userDisplayName)}</span></div>
        <p>${escapeHtml(entry.recordType)} · ${escapeHtml(entry.field || entry.recordId || "")}</p>
        <small>${escapeHtml(formatDateTime(entry.timestamp))}${entry.reason ? ` · ${escapeHtml(entry.reason)}` : ""}</small>
      </article>
    `).join("") || emptyState("No important changes recorded for this event.");
  } catch (error) {
    elements.auditList.innerHTML = emptyState(error.message);
  }
}

function connectLiveUpdates() {
  const url = liveUpdatesUrl();
  if (!url || typeof EventSource === "undefined") return;
  liveSource?.close();
  liveSource = new EventSource(url);
  liveSource.addEventListener("connected", () => {
    elements.connectionStatus.textContent = "Live: connected";
    elements.connectionStatus.classList.add("connected");
  });
  liveSource.addEventListener("update", () => refreshState());
  liveSource.onerror = () => {
    elements.connectionStatus.textContent = "Live: reconnecting";
    elements.connectionStatus.classList.remove("connected");
  };
  window.addEventListener("beforeunload", () => liveSource?.close(), { once: true });
}

async function handleHistoryClick(event) {
  const button = event.target.closest("[data-delete-battle]");
  if (!button) return;

  const battleId = button.dataset.deleteBattle;
  const battle = state.battles.find((item) => item.id === battleId);
  if (!battle) return;

  const description = `${battle.date} · ${battle.outcome} vs ${battle.opponent}`;
  if (!confirm(`Delete the archived battle "${description}"?\n\nThis cannot be undone. Its player participation totals will also be removed.`)) {
    return;
  }

  try {
    button.disabled = true;
    setStatus("Deleting archived battle...");
    state = await api.deleteBattle(battleId);
    render();
    setStatus("Archived battle deleted");
  } catch (error) {
    button.disabled = false;
    setStatus(error.message, true);
  }
}

async function clearHistory() {
  if (!state.battles.length) return;
  if (!confirm(`Delete all ${state.battles.length} archived battles?\n\nThis cannot be undone. Player participation totals will be reset.`)) return;

  try {
    elements.clearHistoryButton.disabled = true;
    setStatus("Clearing history...");
    state = await api.clearHistory();
    expandedPlayers.clear();
    render();
    setStatus("Previous history cleared");
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    elements.clearHistoryButton.disabled = false;
  }
}

async function handleMemberChange(event) {
  const field = event.target.dataset.field;
  const memberId = event.target.dataset.memberId;

  if (!field || !memberId) return;

  const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;

  try {
    setStatus("Saving...");
    const participant = state.participants.find((item) => item.playerId === memberId);
    if (!participant || !state.activeEvent) throw new Error("No active event participant was found");
    const mappedField = {
      type: "rosterStatus",
      weekScore: "score",
      weekAttendance: "attendance",
      weekNotes: "notes"
    }[field] || field;
    await api.updateParticipant(state.activeEvent.id, memberId, {
      [mappedField]: normalizeFieldValue(field, value),
      version: participant.version
    });
    await refreshState();
    setStatus(`Saved ${formatTime(state.updatedAt)}`);
  } catch (error) {
    setStatus(error.message, true);
    await refreshState();
  }
}

async function saveSettings(patch) {
  try {
    setStatus("Saving settings...");
    if (!state.activeEvent) throw new Error("Create an event before changing strategy settings");
    await api.updateEvent(state.activeEvent.id, { ...patch, version: state.activeEvent.version });
    await refreshState();
    setStatus(`Saved ${formatTime(state.updatedAt)}`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function resetWeek() {
  if (!confirm("Clear this week's selected rosters and availability?")) return;
  state = await api.resetWeek();
  render();
  setStatus("Week reset");
}

async function archiveBattle(event) {
  event.preventDefault();
  const formData = new FormData(elements.battleForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    setStatus("Archiving battle...");
    state = await api.archiveBattle(payload);
    elements.battleForm.reset();
    render();
    setStatus("Battle archived");
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function importResultsScreenshot() {
  const file = elements.screenshotInput.files?.[0];

  if (!file) {
    elements.importStatus.textContent = "Choose a screenshot first.";
    return;
  }

  try {
    setStatus("Reading screenshot...");
    elements.importStatus.textContent = "Reading screenshot. This can take a moment.";
    elements.importMatches.innerHTML = "";

    const team = elements.screenshotTeam.value;
    const result = await api.importResultsScreenshot(file, team);
    state = result.state;
    render();
    renderImportMatches(result.matches, result.unmatched);
    setStatus(`Imported ${result.matches.length} result rows`);
    elements.importStatus.textContent = `${result.matches.length} imported. ${result.unmatched.length} need manual matching.`;
  } catch (error) {
    setStatus(error.message, true);
    elements.importStatus.textContent = error.message;
  }
}

async function handleMatchFixClick(event) {
  const button = event.target.closest("[data-fix-index]");
  if (!button) return;

  const card = button.closest(".unmatched-card");
  const memberId = card.querySelector("select").value;
  const score = Number(button.dataset.score || 0);
  const alias = button.dataset.alias || "";
  const team = elements.screenshotTeam.value;

  if (!memberId) {
    elements.importStatus.textContent = "Choose a player before applying that match.";
    return;
  }

  try {
    setStatus("Saving match fix...");
    state = await api.applyResultMatchFix({ memberId, score, alias, team });
    render();
    card.remove();
    setStatus("Match fix saved");
  } catch (error) {
    setStatus(error.message, true);
  }
}

function renderImportMatches(matches, unmatched = []) {
  const matchedHtml = matches.length
    ? matches.map((match) => `
        <div class="import-match">
          <strong>${escapeHtml(match.name)}</strong>
          <span>${Number(match.score).toLocaleString()}</span>
        </div>
      `).join("")
    : `<p class="muted">No roster names could be matched automatically.</p>`;
  const unmatchedHtml = unmatched.map((item, index) => `
    <div class="unmatched-card">
      <div>
        <strong>Unmatched score: ${Number(item.score).toLocaleString()}</strong>
        <p class="muted">${escapeHtml(item.ocrName)}</p>
      </div>
      <select aria-label="Choose player for unmatched result">
        <option value="">Choose player</option>
        ${state.members.map((member) => `<option value="${member.id}">${escapeHtml(member.name)}</option>`).join("")}
      </select>
      <button class="secondary-button" type="button" data-fix-index="${index}" data-score="${item.score}" data-alias="${escapeHtml(item.ocrName)}">Apply Match</button>
    </div>
  `).join("");

  elements.importMatches.innerHTML = `
    ${matchedHtml}
    ${unmatchedHtml ? `<h4 class="match-review-title">Needs manual match</h4>${unmatchedHtml}` : ""}
  `;
}

function directoryRow(member) {
  const history = playerHistory(member.id);
  const expanded = expandedPlayers.has(member.id);
  return `
    <tr>
      <td data-label="Selected"><input data-member-id="${member.id}" data-field="selected" type="checkbox" ${member.selected ? "checked" : ""}></td>
      <td data-label="Player">
        <button class="row-expander" type="button" data-expand-player="${member.id}" aria-expanded="${expanded}">${expanded ? "Hide" : "Show"}</button>
        <strong>${escapeHtml(member.name)}</strong>
        <span class="history-count">${history.length} DS</span>
      </td>
      <td data-label="Rank">${escapeHtml(member.rank)}</td>
      <td data-label="Team"><select data-member-id="${member.id}" data-field="team">${optionHtml(["Reserve", "A", "B"], member.team)}</select></td>
      <td data-label="Role"><select data-member-id="${member.id}" data-field="type">${optionHtml(["Starter", "Sub"], member.type)}</select></td>
      <td data-label="Battle group"><select data-member-id="${member.id}" data-field="tacticalGroup">${optionHtml(tacticalGroups, member.tacticalGroup || "Reserve")}</select></td>
      <td data-label="Unit"><select data-member-id="${member.id}" data-field="unit">${optionHtml(units, assignedUnit(member))}</select></td>
      <td data-label="Availability"><select data-member-id="${member.id}" data-field="availability">${optionHtml(["Pending", "Confirmed", "Tentative", "Not available"], member.availability)}</select></td>
    </tr>
    ${expanded ? playerHistoryRow(member, history) : ""}
  `;
}

function handleDirectoryClick(event) {
  const button = event.target.closest("[data-expand-player]");
  if (!button) return;

  const memberId = button.dataset.expandPlayer;
  if (expandedPlayers.has(memberId)) {
    expandedPlayers.delete(memberId);
  } else {
    expandedPlayers.add(memberId);
  }

  renderDirectory();
}

function playerHistory(memberId) {
  return state.battles.flatMap((battle) =>
    (battle.players || [])
      .filter((player) => player.id === memberId)
      .map((player) => ({ battle, player }))
  );
}

function playerHistoryRow(member, history) {
  const content = history.length
    ? history.map(({ battle, player }) => `
        <div class="player-history-item">
          <strong>${escapeHtml(battle.date)} vs ${escapeHtml(battle.opponent)}</strong>
          <span>Team ${escapeHtml(player.team || "?")} · ${Number(player.score || 0).toLocaleString()} pts · ${escapeHtml(player.attendance || "not recorded")}</span>
        </div>
      `).join("")
    : `<p class="muted">No Desert Storm history archived for ${escapeHtml(member.name)} yet.</p>`;

  return `
    <tr class="player-history-row">
      <td colspan="7">
        <div class="player-history-panel">${content}</div>
      </td>
    </tr>
  `;
}

function selected(team) {
  return state.members.filter((member) => member.selected && (!team || member.team === team));
}

function readiness(team) {
  const members = selected(team);
  const confirmed = members.filter((member) => member.availability === "Confirmed").length;
  const assigned = members.filter((member) => assignedUnit(member) !== "Unassigned").length;
  const starters = members.filter((member) => member.type === "Starter").length;
  const subs = members.filter((member) => member.type === "Sub").length;
  const score = Math.round(
    Math.min(members.length / 30, 1) * 35 +
    Math.min(starters / 20, 1) * 20 +
    Math.min(subs / 10, 1) * 15 +
    (members.length ? confirmed / members.length : 0) * 20 +
    (members.length ? assigned / members.length : 0) * 10
  );

  return { members, confirmed, assigned, starters, subs, score };
}

function roleOrder(type) {
  return type === "Starter" ? 0 : 1;
}

function readinessPanel(team, data) {
  return `
    <article class="panel">
      <div class="panel-heading">
        <h3>Team ${team} Readiness</h3>
        <strong>${data.score}%</strong>
      </div>
      <div class="meter"><span style="width: ${data.score}%"></span></div>
      <p class="muted">${data.members.length}/30 roster · ${data.starters}/20 starters · ${data.subs}/10 substitutes</p>
      <p class="muted">${data.confirmed} confirmed · ${data.assigned} assigned</p>
    </article>
  `;
}

function teamList(title, members) {
  return `
    <div class="team-list">
      <h4>${title}</h4>
      ${members.map((member) => `<p>${escapeHtml(member.name)} <span>${escapeHtml(assignedUnit(member))} · ${escapeHtml(member.availability)}</span></p>`).join("") || `<p class="muted">None assigned</p>`}
    </div>
  `;
}

function summaryCard(label, value) {
  return `<article class="summary-card"><span>${label}</span><strong>${value}</strong></article>`;
}

function detail(label, value) {
  return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function statusBadge(value) {
  const normalized = String(value || "").toLowerCase().replaceAll("_", "-");
  return `<span class="status-badge status-${escapeHtml(normalized)}">${escapeHtml(humanize(value))}</span>`;
}

function eventStatusLabel(status) {
  return {
    draft: "Draft plan",
    published: "Published plan",
    in_progress: "Battle in progress",
    completed: "Battle completed",
    archived: "Archived"
  }[status] || humanize(status);
}

function validationPanel(title, messages, tone) {
  return `
    <article class="validation-panel panel validation-${tone}">
      <h3>${escapeHtml(title)} <span>${messages.length}</span></h3>
      ${messages.map((message) => `<p>${escapeHtml(message)}</p>`).join("") || `<p class="muted">None</p>`}
    </article>
  `;
}

function validatePublishReadiness(event, participants) {
  const errors = [];
  const warnings = [];
  const passed = [];
  const selected = participants.filter((participant) => participant.selected);
  if (!event.date) errors.push("Battle date is required");
  else passed.push("Battle date is configured");
  if (!event.strategyA || !event.strategyB) errors.push("Both strategies are required");
  else passed.push("Strategies are selected");
  if (!serverTimes.includes(event.battleTimeA) || !serverTimes.includes(event.battleTimeB)) errors.push("Both battle times are required");
  else passed.push("Battle times are configured");
  if (!selected.length) errors.push("Select at least one participant");
  for (const participant of selected) {
    if (!["A", "B"].includes(participant.team)) errors.push(`${participant.playerName} needs a team`);
    if (participant.rosterStatus === "Starter" && (!participant.unit || participant.unit === "Unassigned")) {
      errors.push(`${participant.playerName} is a starter without a unit`);
    }
    if (participant.rosterStatus === "Starter" && participant.availability === "Unavailable" && !participant.availabilityOverride) {
      errors.push(`${participant.playerName} is unavailable but assigned as a starter`);
    }
  }
  for (const team of ["A", "B"]) {
    const roster = selected.filter((participant) => participant.team === team);
    if (roster.length > 30) errors.push(`Team ${team} exceeds 30 players`);
    if (!roster.length) warnings.push(`Team ${team} has no selected players`);
  }
  if (!errors.length) passed.push("No blocking roster conflicts");
  return { errors, warnings, passed };
}

function renderServerValidation(validation) {
  elements.publishReadiness.innerHTML = [
    validationPanel("Errors", validation.errors || [], "error"),
    validationPanel("Warnings", validation.warnings || [], "warning"),
    validationPanel("Passed", validation.passed || [], "passed")
  ].join("");
}

function emptyState(message) {
  return `<article class="panel empty-state"><p>${escapeHtml(message)}</p></article>`;
}

function humanize(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : "not yet";
}

function optionHtml(items, current = "") {
  return items.map((item) => `<option ${item === current ? "selected" : ""}>${escapeHtml(item)}</option>`).join("");
}

function assignedUnit(member) {
  return units.includes(member?.unit) ? member.unit : "Unassigned";
}

function normalizeFieldValue(field, value) {
  if (field === "weekScore") return Number(value || 0);
  if (field === "availability" && value === "Not available") return "Unavailable";
  return value;
}

function formatTime(value) {
  return value ? new Date(value).toLocaleTimeString() : "now";
}

function setStatus(message, isError = false) {
  elements.saveStatus.textContent = message;
  elements.saveStatus.classList.toggle("error", isError);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;"
  })[character]);
}
