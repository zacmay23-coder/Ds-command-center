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
  async deleteEvent(id) {
    return request(`/api/events/${encodeURIComponent(id)}`, { method: "DELETE" });
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
  async getAllAudit() {
    return request("/api/audit");
  },
  async getUsers() {
    return request("/api/users");
  },
  async updateUser(id, patch) {
    return request(`/api/users/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
  },
  async updateOwnProfile(patch) {
    return request("/api/me/profile", { method: "PATCH", body: JSON.stringify(patch) });
  },
  async updatePlayer(id, patch) {
    return request(`/api/players/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
  },
  async deletePlayer(id) {
    return request(`/api/players/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
  async createStrategyTemplate(payload) {
    return request("/api/strategy-templates", { method: "POST", body: JSON.stringify(payload) });
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
  async saveVsScore(payload) {
    return request("/api/vs-scores", { method: "POST", body: JSON.stringify(payload) });
  },
  async deleteVsScore(id) {
    return request(`/api/vs-scores/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
  async importVsScreenshot(file, date, weekId) {
    const formData = new FormData();
    formData.append("screenshot", file);
    return request(`/api/import-vs-screenshot?date=${encodeURIComponent(date)}&weekId=${encodeURIComponent(weekId)}`, { method: "POST", body: formData, headers: {} });
  },
  async createVsWeek(payload) {
    return request("/api/vs-weeks", { method: "POST", body: JSON.stringify(payload) });
  },
  async updateVsDayResult(id, payload) {
    return request(`/api/vs-weeks/${encodeURIComponent(id)}/result`, { method: "PATCH", body: JSON.stringify(payload) });
  },
  async deleteVsWeek(id) {
    return request(`/api/vs-weeks/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
  async importVsStandings(weekId, file) {
    const formData = new FormData();
    formData.append("screenshot", file);
    return request(`/api/vs-weeks/${encodeURIComponent(weekId)}/standings`, { method: "POST", body: formData, headers: {} });
  },
  async clearVsStandings(weekId) {
    return request(`/api/vs-weeks/${encodeURIComponent(weekId)}/standings`, { method: "DELETE" });
  },
  async saveVsStandings(weekId, standings) {
    return request(`/api/vs-weeks/${encodeURIComponent(weekId)}/standings`, { method: "PATCH", body: JSON.stringify({ standings }) });
  },
  async archiveDuelLeagueGroup(id) {
    return request(`/api/duel-league-groups/${encodeURIComponent(id)}/archive`, { method: "POST", body: "{}" });
  },
  async auditVsDay(weekId, date) {
    return request(`/api/vs-weeks/${encodeURIComponent(weekId)}/days/${encodeURIComponent(date)}/audit`);
  },
  async publishVsDay(weekId, date) {
    return request(`/api/vs-weeks/${encodeURIComponent(weekId)}/days/${encodeURIComponent(date)}/publish`, { method: "POST", body: "{}" });
  },
  async resetWeek() {
    return request("/api/reset-week", { method: "POST" });
  },
  async createAllianceEvent(payload) {
    return request("/api/alliance-weekly-events", { method: "POST", body: JSON.stringify(payload) });
  },
  async updateAllianceEvent(id, patch) {
    return request(`/api/alliance-weekly-events/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
  },
  async deleteAllianceEvent(id) {
    return request(`/api/alliance-weekly-events/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
  async createThemeWeek(payload) {
    return request("/api/theme-weeks", { method: "POST", body: JSON.stringify(payload) });
  },
  async updateThemeWeek(id, patch) {
    return request(`/api/theme-weeks/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
  },
  async deleteThemeWeek(id) {
    return request(`/api/theme-weeks/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
  async themeAction(id, action, payload = {}) {
    return request(`/api/theme-weeks/${encodeURIComponent(id)}/${action}`, { method: "POST", body: JSON.stringify(payload) });
  },
  async themeOcr(file) {
    const formData = new FormData();
    formData.append("screenshot", file);
    return request("/api/theme-weeks/ocr", { method: "POST", body: formData, headers: {} });
  },
  async addMemberNotice(payload) {
    return request("/api/member-notices", { method: "POST", body: JSON.stringify(payload) });
  },
  async addOfficerQuestion(payload) {
    return request("/api/officer-questions", { method: "POST", body: JSON.stringify(payload) });
  },
  async addAnnouncement(payload) {
    return request("/api/announcements", { method: "POST", body: JSON.stringify(payload) });
  },
  async acknowledgeAnnouncement(id) {
    return request(`/api/announcements/${encodeURIComponent(id)}/acknowledge`, { method: "POST", body: "{}" });
  },
  async addThemeSubmissionForMember(id, payload) {
    return request(`/api/theme-weeks/${encodeURIComponent(id)}/officer-submission`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  async replyToAnnouncement(id, text) {
    return request(`/api/announcements/${encodeURIComponent(id)}/replies`, {
      method: "POST",
      body: JSON.stringify({ text })
    });
  },
  async toggleAnnouncementHelpful(id) {
    return request(`/api/announcements/${encodeURIComponent(id)}/helpful`, { method: "POST", body: "{}" });
  },
  async sendPrivateMessage(payload) {
    return request("/api/private-messages", { method: "POST", body: JSON.stringify(payload) });
  },
  async postDailyChat(text) {
    return request("/api/daily-chat", { method: "POST", body: JSON.stringify({ text }) });
  },
  async saveJournalItem(payload) {
    return request("/api/journal", { method: "POST", body: JSON.stringify(payload) });
  },
  async deleteJournalItem(id) {
    return request(`/api/journal/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
  async scheduleLeadershipMeeting(payload) {
    return request("/api/leadership/meetings", { method: "POST", body: JSON.stringify(payload) });
  },
  async addLeadershipPost(payload) {
    return request("/api/leadership/posts", { method: "POST", body: JSON.stringify(payload) });
  },
  async requestLeadershipMeeting(payload) {
    return request("/api/leadership/requests", { method: "POST", body: JSON.stringify(payload) });
  },
  async deleteLeadershipPost(id) {
    return request(`/api/leadership/posts/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
  async deleteAnnouncement(id) {
    return request(`/api/announcements/${encodeURIComponent(id)}`, { method: "DELETE" });
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
let timelineSelectedGroup = "";
let timelineEditMode = false;
let timelineMovementView = "all";
let selectedVsWeekId = "";
let selectedVsDate = "";
let selectedVsScoreFilter = "all";
let latestVsAudit = null;

const elements = {
  saveStatus: document.querySelector("#saveStatus"),
  connectionStatus: document.querySelector("#connectionStatus"),
  eventBanner: document.querySelector("#eventBanner"),
  userProfileContent: document.querySelector("#userProfileContent"),
  headerProfileAvatar: document.querySelector("#headerProfileAvatar"),
  headerProfileLabel: document.querySelector("#headerProfileLabel"),
  memberProfileDialog: document.querySelector("#memberProfileDialog"),
  memberProfileDialogContent: document.querySelector("#memberProfileDialogContent"),
  myAssignmentContent: document.querySelector("#myAssignmentContent"),
  eventActions: document.querySelector("#eventActions"),
  publishReadiness: document.querySelector("#publishReadiness"),
  eventList: document.querySelector("#eventList"),
  dsEventTeamOverview: document.querySelector("#dsEventTeamOverview"),
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
  directorySummary: document.querySelector("#directorySummary"),
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
elements.nextBattleDate = document.querySelector("#nextBattleDate");
elements.rankSort = document.querySelector("#rankSort");
elements.directoryTeamFilter = document.querySelector("#directoryTeamFilter");
elements.customStrategyForm = document.querySelector("#customStrategyForm");
elements.customStrategyBase = document.querySelector("#customStrategyBase");
elements.strategyLibraryCards = document.querySelector("#strategyLibraryCards");
elements.allianceEventForm = document.querySelector("#allianceEventForm");
elements.allianceEventList = document.querySelector("#allianceEventList");
elements.themeWeekForm = document.querySelector("#themeWeekForm");
elements.themeWeekContent = document.querySelector("#themeWeekContent");
elements.themeHistoryList = document.querySelector("#themeHistoryList");
elements.vsScoreDate = document.querySelector("#vsScoreDate");
elements.vsScreenshotInput = document.querySelector("#vsScreenshotInput");
elements.vsImportButton = document.querySelector("#vsImportButton");
elements.vsImportStatus = document.querySelector("#vsImportStatus");
elements.vsImportMatches = document.querySelector("#vsImportMatches");
elements.vsManualForm = document.querySelector("#vsManualForm");
elements.vsPlayerSelect = document.querySelector("#vsPlayerSelect");
elements.vsSummary = document.querySelector("#vsSummary");
elements.vsTopThree = document.querySelector("#vsTopThree");
elements.vsDailyTables = document.querySelector("#vsDailyTables");
elements.vsScoreFilter = document.querySelector("#vsScoreFilter");
elements.vsWeekSelect = document.querySelector("#vsWeekSelect");
elements.vsDayNavigation = document.querySelector("#vsDayNavigation");
elements.vsMatchupHeader = document.querySelector("#vsMatchupHeader");
elements.vsDailyResultForm = document.querySelector("#vsDailyResultForm");
elements.vsWeekForm = document.querySelector("#vsWeekForm");
elements.createdVsManagement = document.querySelector("#createdVsManagement");
elements.vsDuelGroupReference = document.querySelector("#vsDuelGroupReference");
elements.duelLeagueHistoryList = document.querySelector("#duelLeagueHistoryList");
elements.vsAuditPanel = document.querySelector("#vsAuditPanel");
elements.vsStandingsInput = document.querySelector("#vsStandingsInput");
elements.vsStandingsImportButton = document.querySelector("#vsStandingsImportButton");
elements.vsStandingsStatus = document.querySelector("#vsStandingsStatus");
elements.vsStandingsRefreshButton = document.querySelector("#vsStandingsRefreshButton");
elements.vsStandingsClearButton = document.querySelector("#vsStandingsClearButton");
elements.vsStandingsPaste = document.querySelector("#vsStandingsPaste");
elements.vsStandingsFillButton = document.querySelector("#vsStandingsFillButton");
elements.vsStandingsSaveButton = document.querySelector("#vsStandingsSaveButton");
elements.createdDsManagement = document.querySelector("#createdDsManagement");
elements.createdThemeManagement = document.querySelector("#createdThemeManagement");
elements.createdAllianceManagement = document.querySelector("#createdAllianceManagement");
elements.officerInbox = document.querySelector("#officerInbox");
elements.createBattleTimeA = document.querySelector("#createBattleTimeA");
elements.createBattleTimeB = document.querySelector("#createBattleTimeB");
elements.createStrategyA = document.querySelector("#createStrategyA");
elements.createStrategyB = document.querySelector("#createStrategyB");
elements.publishDsSetupButton = document.querySelector("#publishDsSetupButton");
elements.announcementForm = document.querySelector("#announcementForm");
elements.announcementList = document.querySelector("#announcementList");
elements.privateMessageForm = document.querySelector("#privateMessageForm");
elements.privateMessageRecipient = document.querySelector("#privateMessageRecipient");
elements.privateMessageList = document.querySelector("#privateMessageList");
elements.dailyChatForm = document.querySelector("#dailyChatForm");
elements.dailyChatList = document.querySelector("#dailyChatList");
elements.dailyChatDate = document.querySelector("#dailyChatDate");
elements.journalForm = document.querySelector("#journalForm");
elements.journalEntries = document.querySelector("#journalEntries");
elements.journalTabButton = document.querySelector("#journalTabButton");
elements.planVsWeekButton = document.querySelector("#planVsWeekButton");
elements.leadership = document.querySelector("#leadership");
const expandedPlayers = new Set();
let liveSource = null;

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  requireSession();
  if (sessionStorage.getItem("ewar-entering-command-center")) {
    document.body.classList.add("app-entering");
    sessionStorage.removeItem("ewar-entering-command-center");
    window.setTimeout(() => document.body.classList.remove("app-entering"), 1600);
  }
  bindNavigation();
  bindControls();
  fillStrategySelects();
  await refreshState();
  if (!state?.me?.profileConfirmedAt) {
    window.location.href = "/profile-link.html";
    return;
  }
  if (!state.me.profileSetupCompletedAt) {
    showView("userProfile");
    setStatus("Complete your member title and bio to finish profile setup");
  } else {
    const requestedView = new URLSearchParams(window.location.search).get("view");
    const requestedButton = requestedView && document.querySelector(`.sidebar button[data-view="${requestedView}"]`);
    const requestedPanel = requestedView && document.querySelector(`#${requestedView}`);
    if (requestedButton && requestedPanel && !requestedButton.hidden) showView(requestedView);
  }
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
    history.replaceState(null, "", `?view=${encodeURIComponent(button.dataset.view)}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function bindControls() {
  document.querySelector("#refreshButton").addEventListener("click", refreshState);
  document.querySelector("#logoutButton").addEventListener("click", logout);
  document.querySelector("#profileTabButton").addEventListener("click", () => showView("userProfile"));
  elements.journalTabButton.addEventListener("click", () => showView("playerJournal"));
  elements.planVsWeekButton.addEventListener("click", openVsWeekPlan);
  elements.journalForm.addEventListener("submit", saveJournalEntry);
  elements.journalForm.addEventListener("reset", () => window.setTimeout(resetJournalEditor));
  elements.journalEntries.addEventListener("click", handleJournalEntryClick);
  elements.leadership.addEventListener("submit", handleLeadershipSubmit);
  elements.leadership.addEventListener("click", handleLeadershipClick);
  elements.searchInput.addEventListener("input", renderDirectory);
  elements.filterInput.addEventListener("change", renderDirectory);
  elements.rankSort.addEventListener("change", renderDirectory);
  elements.directoryTeamFilter.addEventListener("change", renderDirectory);
  elements.directoryRows.addEventListener("change", handleMemberChange);
  elements.directoryRows.addEventListener("click", handleDirectoryClick);
  elements.resultRows.addEventListener("change", handleMemberChange);
  elements.strategyA.addEventListener("change", () => publishTeamStrategy("A"));
  elements.strategyB.addEventListener("change", () => publishTeamStrategy("B"));
  elements.battleTimeA.addEventListener("change", () => saveSettings({ battleTimeA: elements.battleTimeA.value }));
  elements.battleTimeB.addEventListener("change", () => saveSettings({ battleTimeB: elements.battleTimeB.value }));
  elements.battleForm.addEventListener("submit", archiveBattle);
  elements.importScreenshotButton.addEventListener("click", importResultsScreenshot);
  elements.importMatches.addEventListener("click", handleMatchFixClick);
  elements.historyList.addEventListener("click", handleHistoryClick);
  elements.clearHistoryButton.addEventListener("click", clearHistory);
  elements.createEventButton.addEventListener("click", createNextEvent);
  elements.eventActions.addEventListener("click", handleEventAction);
  elements.eventActions.addEventListener("click", handleEventListClick);
  elements.eventActions.addEventListener("change", handleEventFieldChange);
  elements.eventList.addEventListener("click", handleEventListClick);
  elements.participationTeam.addEventListener("change", renderParticipation);
  elements.participationUnit.addEventListener("change", renderParticipation);
  elements.myAssignmentContent.addEventListener("click", handleAvailabilityClick);
  elements.myAssignmentContent.addEventListener("click", handleThemeWeekClick);
  elements.myAssignmentContent.addEventListener("change", handleAvailabilityNote);
  elements.strategyControls.addEventListener("change", handleStrategyApply);
  elements.strategyControls.addEventListener("click", handleStrategyControlsClick);
  elements.strategyTimelineContent.addEventListener("click", handleTimelineClick);
  elements.strategyTimelineContent.addEventListener("change", handleTimelineChange);
  elements.userList.addEventListener("change", handleUserChange);
  elements.customStrategyForm.addEventListener("submit", createCustomStrategy);
  elements.strategyLibraryCards.addEventListener("click", handleStrategyLibraryClick);
  elements.userProfileContent.addEventListener("submit", handleOwnProfileSave);
  elements.userProfileContent.addEventListener("change", handleOwnProfileImage);
  elements.userProfileContent.addEventListener("click", handleOwnProfileClick);
  document.body.addEventListener("click", handleMiniProfileClick);
  document.body.addEventListener("click", handleEventSubviewClick);
  document.body.addEventListener("click", handleNestedSubviewClick);
  elements.myAssignmentContent.addEventListener("submit", handleBriefingAction);
  elements.createdDsManagement.addEventListener("click", handleEventAction);
  elements.createdDsManagement.addEventListener("click", handleEventListClick);
  elements.createdDsManagement.addEventListener("change", handleEventFieldChange);
  elements.createdAllianceManagement.addEventListener("click", handleAllianceEventClick);
  elements.createdThemeManagement.addEventListener("click", handleThemeWeekClick);
  elements.createdThemeManagement.addEventListener("submit", handleOfficerThemeSubmission);
  elements.publishDsSetupButton.addEventListener("click", publishDsSetup);
  elements.announcementForm.addEventListener("submit", postAnnouncement);
  elements.announcementList.addEventListener("click", handleAnnouncementClick);
  elements.privateMessageForm.addEventListener("submit", handlePrivateMessageSubmit);
  elements.dailyChatForm.addEventListener("submit", handleDailyChatSubmit);
  elements.allianceEventForm.addEventListener("submit", handleAllianceEventSubmit);
  elements.allianceEventList.addEventListener("click", handleAllianceEventClick);
  elements.themeWeekForm.addEventListener("submit", handleThemeWeekCreate);
  elements.themeWeekContent.addEventListener("click", handleThemeWeekClick);
  elements.themeWeekContent.addEventListener("change", handleThemeScreenshotChange);
  elements.themeHistoryList.addEventListener("click", handleThemeWeekClick);
  elements.vsImportButton.addEventListener("click", importVsScreenshot);
  elements.vsScoreDate.addEventListener("change", handleVsImportDaySelection);
  elements.vsImportMatches.addEventListener("click", handleVsMatchFix);
  elements.vsManualForm.addEventListener("submit", saveManualVsScore);
  elements.vsDailyTables.addEventListener("click", handleVsScoreDelete);
  elements.vsScoreFilter.addEventListener("change", () => {
    selectedVsScoreFilter = elements.vsScoreFilter.value;
    renderVsScores();
  });
  elements.vsWeekSelect.addEventListener("change", handleVsWeekSelection);
  elements.vsDayNavigation.addEventListener("click", handleVsDaySelection);
  elements.vsDailyResultForm.addEventListener("submit", saveVsDailyResult);
  elements.vsWeekForm.addEventListener("submit", createVsWeek);
  elements.createdVsManagement.addEventListener("click", handleVsWeekDelete);
  elements.createdVsManagement.addEventListener("click", handleDuelGroupAction);
  elements.vsAuditPanel.addEventListener("change", handleVsAuditSelection);
  elements.vsAuditPanel.addEventListener("click", handleVsAuditAction);
  elements.duelLeagueHistoryList.addEventListener("change", handleDuelHistoryWeek);
  elements.vsStandingsImportButton.addEventListener("click", importVsStandings);
  elements.vsStandingsRefreshButton.addEventListener("click", refreshVsStandings);
  elements.vsStandingsClearButton.addEventListener("click", clearVsStandings);
  elements.vsStandingsFillButton.addEventListener("click", fillVsStandingsFromPaste);
  elements.vsStandingsSaveButton.addEventListener("click", saveManualVsStandings);
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
  elements.nextBattleDate.value = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  elements.nextBattleDate.min = new Date().toISOString().slice(0, 10);
  const nextWeek = elements.nextBattleDate.value;
  const themeDate = elements.themeWeekForm?.querySelector("[name='weekOf']");
  const allianceDate = elements.allianceEventForm?.querySelector("[name='date']");
  if (themeDate && !themeDate.value) themeDate.value = nextWeek;
  if (allianceDate && !allianceDate.value) allianceDate.value = nextWeek;
  setDefaultVsMonday();
}

function showView(viewId) {
  document.querySelectorAll(".sidebar button").forEach((item) => item.classList.remove("active"));
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  document.querySelector(`.sidebar button[data-view="${viewId}"]`)?.classList.add("active");
  document.querySelector(`#${viewId}`)?.classList.add("active");
}

function render() {
  applyRoleVisibility();
  syncStrategySelects();
  renderEventBanner();
  renderUserProfile();
  renderHeaderProfile();
  renderJournal();
  renderLeadership();
  renderMyAssignment();
  renderEvents();
  renderDashboard();
  renderDirectory();
  renderTeams();
  renderAssignments();
  renderResults();
  renderHistory();
  renderStrategyTimeline();
  renderStrategyLibrary();
  renderAllianceWeeklyEvents();
  renderThemeWeeks();
  renderVsScores();
  renderCreateManagement();
  if (state.permissions.isOfficer) {
    renderParticipation();
  }
  if (state.permissions.isAdministrator) {
    renderAudit();
    renderAdministration();
  }
  elements.strategyA.value = state.settings.strategyA;
  elements.strategyB.value = state.settings.strategyB;
  elements.battleTimeA.value = state.settings.battleTimeA;
  elements.battleTimeB.value = state.settings.battleTimeB;
  elements.assignmentTimeA.textContent = `${state.settings.battleTimeA} Server Time`;
  elements.assignmentTimeB.textContent = `${state.settings.battleTimeB} Server Time`;
}

function handleEventSubviewClick(event) {
  const button = event.target.closest("[data-event-subview]");
  if (!button) return;
  showView(button.dataset.eventSubview);
  document.querySelector("[data-view='events']")?.classList.add("active");
}

function handleNestedSubviewClick(event) {
  const historyButton = event.target.closest("[data-history-subview]");
  const adminButton = event.target.closest("[data-admin-subview]");
  const viewId = historyButton?.dataset.historySubview || adminButton?.dataset.adminSubview;
  if (!viewId) return;
  if (viewId === "participation" && !state.permissions.isOfficer) return;
  if ((viewId === "administration" || viewId === "audit") && !state.permissions.isAdministrator) return;
  showView(viewId);
  document.querySelector(`[data-view="${adminButton ? "administration" : "history"}"]`)?.classList.add("active");
}

function syncStrategySelects() {
  const names = state.strategyTemplates.map((template) => template.name);
  const available = [...new Set([...names, state.settings.strategyA, state.settings.strategyB].filter(Boolean))];
  elements.strategyA.innerHTML = optionHtml(available, state.settings.strategyA);
  elements.strategyB.innerHTML = optionHtml(available, state.settings.strategyB);
  elements.createStrategyA.innerHTML = optionHtml(available, state.settings.strategyA);
  elements.createStrategyB.innerHTML = optionHtml(available, state.settings.strategyB);
  elements.createBattleTimeA.value = state.settings.battleTimeA;
  elements.createBattleTimeB.value = state.settings.battleTimeB;
  elements.customStrategyBase.innerHTML = state.strategyTemplates.map((template) =>
    `<option value="${escapeHtml(template.id)}">${escapeHtml(template.name)}</option>`
  ).join("");
}

async function publishTeamStrategy(team) {
  const select = team === "A" ? elements.strategyA : elements.strategyB;
  const template = state.strategyTemplates.find((item) => item.name === select.value);
  if (!template || !state.activeEvent) return;
  try {
    setStatus(`Publishing Team ${team} strategy...`);
    await api.applyStrategy(state.activeEvent.id, { templateId: template.id, team });
    timelineTeam = team;
    timelinePhaseIndex = 0;
    await refreshState();
    setStatus(`Team ${team} strategy published to tactical planning`);
  } catch (error) {
    setStatus(error.message, true);
    await refreshState();
  }
}

function renderStrategyLibrary() {
  if (!state.permissions.isOfficer) return;
  elements.strategyLibraryCards.innerHTML = state.strategyTemplates.map((template) => `
    <article class="strategy-card">
      <div class="assignment-heading"><h3>${escapeHtml(template.name)}</h3><span>${template.phases?.length || 6} phases</span></div>
      <p>${escapeHtml(template.description || "Custom tactical strategy.")}</p>
      <small>Available independently for Team A and Team B</small>
      <div class="strategy-card-actions">
        <button class="secondary-button" type="button" data-library-apply="${escapeHtml(template.id)}" data-library-team="A">Use for A</button>
        <button class="secondary-button" type="button" data-library-apply="${escapeHtml(template.id)}" data-library-team="B">Use for B</button>
      </div>
    </article>
  `).join("") || emptyState("No strategy templates are available.");
}

async function createCustomStrategy(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(elements.customStrategyForm));
  const base = state.strategyTemplates.find((template) => template.id === data.baseTemplateId);
  if (!base) return;
  try {
    setStatus("Creating custom strategy...");
    await api.createStrategyTemplate({
      ...structuredClone(base),
      id: undefined,
      name: data.name,
      description: data.description,
      active: true,
      version: 1
    });
    elements.customStrategyForm.reset();
    await refreshState();
    setStatus("Custom strategy added to the library");
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function handleStrategyLibraryClick(event) {
  const button = event.target.closest("[data-library-apply]");
  if (!button || !state.activeEvent) return;
  try {
    await api.applyStrategy(state.activeEvent.id, {
      templateId: button.dataset.libraryApply,
      team: button.dataset.libraryTeam
    });
    timelineTeam = button.dataset.libraryTeam;
    timelinePhaseIndex = 0;
    await refreshState();
    setStatus(`Strategy applied to Team ${button.dataset.libraryTeam}`);
  } catch (error) {
    setStatus(error.message, true);
  }
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
    const activeView = document.querySelector(".view.active")?.id;
    const memberViews = ["myAssignment", "dashboard", "events", "allianceWeeklyEvents", "themeWeek", "history", "strategyTimeline", "userProfile", "playerJournal"];
    if (!memberViews.includes(activeView)) {
      document.querySelectorAll(".sidebar button, .view").forEach((item) => item.classList.remove("active"));
      document.querySelector("[data-view='myAssignment']").classList.add("active");
      document.querySelector("#myAssignment").classList.add("active");
    }
  }
}

function renderUserProfile() {
  const user = state.me;
  const player = state.players.find((item) => item.id === user.playerId);
  const participant = state.participants.find((item) => item.playerId === user.playerId);
  if (!player) {
    elements.userProfileContent.innerHTML = emptyState("Confirm your Master Directory profile before designing your member account.");
    return;
  }
  const profileImage = player.profileImage || user.accountPhotoUrl || "";
  elements.userProfileContent.innerHTML = `
    <article class="member-profile panel">
      <div class="member-profile-visual">
        ${profileImage
          ? `<img src="${escapeHtml(profileImage)}" alt="${escapeHtml(player.gameName)} profile picture" style="object-fit:${escapeHtml(player.profileImageFit || "cover")};object-position:${escapeHtml(player.profileImagePosition || "center")}">`
          : `<span>${escapeHtml(player.gameName.slice(0, 1))}</span>`}
        <label class="primary-button profile-upload-button">Upload Game Picture<input data-own-profile-image type="file" accept="image/jpeg,image/png,image/webp,image/gif"></label>
        ${user.accountPhotoUrl ? `<button class="secondary-button" type="button" data-use-account-photo>Use Account Picture</button>` : ""}
      </div>
      <form id="ownProfileForm" class="member-profile-details">
        <p class="eyebrow">Member profile</p>
        <h3>${escapeHtml(player.gameName)}</h3>
        ${user.profileSetupCompletedAt ? "" : `<p class="weekly-notice">Complete your title and description to finish account setup.</p>`}
        <label>Member title<input name="profileTitle" maxlength="60" value="${escapeHtml(user.profileTitle || "Alliance Member")}" required></label>
        <label>Member description<textarea name="profileBio" maxlength="400" placeholder="Add a short alliance or battle profile." required>${escapeHtml(user.profileBio || "")}</textarea></label>
        <button class="primary-button" type="submit">Save My Profile</button>
      </form>
    </article>
  `;
}

function renderJournal() {
  const entries = state.myJournal || [];
  elements.journalEntries.innerHTML = entries.map((entry) => {
    const week = (state.vsWeeks || []).find((item) => item.id === entry.vsWeekId);
    const schedule = entry.type === "plan" && week
      ? `<p class="journal-schedule">${vsWeekDays(week.beginDate).map((day) => `${day.label} ${day.shortDate}`).join(" · ")}</p><small>EWAR vs ${escapeHtml(week.opponent)}</small>`
      : "";
    const label = entry.type === "plan" ? "VS Week Plan" : entry.type === "goal" ? "Goal" : "Note";
    return `<article class="panel journal-entry journal-${escapeHtml(entry.type)}">
      <div class="journal-entry-heading"><span>${label}</span><small>Updated ${escapeHtml(formatDateTime(entry.updatedAt))}</small></div>
      <h3>${escapeHtml(entry.title)}</h3>
      ${schedule}
      <p>${escapeHtml(entry.text)}</p>
      <div class="journal-actions">
        <button class="secondary-button" type="button" data-edit-journal="${escapeHtml(entry.id)}">Edit</button>
        <button class="danger-button" type="button" data-delete-journal="${escapeHtml(entry.id)}">Delete</button>
      </div>
    </article>`;
  }).join("") || `<div class="panel journal-empty"><h3>Your journal is ready.</h3><p>Create a private note, plan your VS week, or set a personal goal.</p></div>`;
}

function openVsWeekPlan() {
  const week = (state.vsWeeks || []).find((item) => item.id === selectedVsWeekId);
  if (!week) return setStatus("Select a VS week first", true);
  showView("playerJournal");
  const form = elements.journalForm;
  form.reset();
  form.elements.type.value = "plan";
  form.elements.vsWeekId.value = week.id;
  form.elements.title.value = `EWAR vs ${week.opponent} · Week plan`;
  form.elements.text.value = `Scoring focus for ${vsWeekDays(week.beginDate).map((day) => `${day.label} ${day.shortDate}`).join(", ")}:\n`;
  form.elements.text.focus();
}

async function saveJournalEntry(event) {
  event.preventDefault();
  try {
    await api.saveJournalItem(Object.fromEntries(new FormData(event.currentTarget)));
    event.currentTarget.reset();
    await refreshState();
    showView("playerJournal");
    setStatus("Private journal entry saved");
  } catch (error) { setStatus(error.message, true); }
}

function resetJournalEditor() {
  elements.journalForm.elements.id.value = "";
  elements.journalForm.elements.vsWeekId.value = "";
}

async function handleJournalEntryClick(event) {
  const editButton = event.target.closest("[data-edit-journal]");
  const deleteButton = event.target.closest("[data-delete-journal]");
  const id = editButton?.dataset.editJournal || deleteButton?.dataset.deleteJournal;
  if (!id) return;
  const entry = (state.myJournal || []).find((item) => item.id === id);
  if (!entry) return;
  if (deleteButton) {
    if (!confirm(`Delete "${entry.title}" from your private journal?`)) return;
    try {
      await api.deleteJournalItem(id);
      await refreshState();
      showView("playerJournal");
      setStatus("Journal entry deleted");
    } catch (error) { setStatus(error.message, true); }
    return;
  }
  const form = elements.journalForm;
  form.elements.id.value = entry.id;
  form.elements.vsWeekId.value = entry.vsWeekId || "";
  form.elements.type.value = entry.type;
  form.elements.title.value = entry.title;
  form.elements.text.value = entry.text;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderLeadership() {
  if (!state.permissions.isOfficer || !state.leadership) return;
  for (const category of ["roles", "strategy", "improvements", "weekly"]) {
    const requestPanel = elements.leadership.querySelector(`[data-leadership-request="${category}"]`);
    const recipientOptions = (state.officerRecipients || []).map((recipient) =>
      `<option value="${escapeHtml(recipient.uid)}">${escapeHtml(recipient.displayName)} · ${escapeHtml(recipient.role)}</option>`
    ).join("");
    const requests = (state.leadership.requests || []).filter((request) => request.category === category);
    requestPanel.innerHTML = `<details class="leadership-request-box">
      <summary>Request a meeting</summary>
      <form data-leadership-request-form="${category}">
        <label>Request from<select name="recipientUid"><option value="all">All officers and administrators</option>${recipientOptions}</select></label>
        <label>Reason / topic<textarea name="topic" maxlength="500" required placeholder="What should the leadership meeting cover?"></textarea></label>
        <button class="secondary-button">Send meeting request</button>
      </form>
      <div class="leadership-request-list">${requests.map((request) => `<article><strong>${escapeHtml(request.requestedByName)}</strong><span> requested ${escapeHtml(request.recipientName)}</span><small>${escapeHtml(formatDateTime(request.createdAt))}</small><p>${escapeHtml(request.topic)}</p></article>`).join("") || `<p class="muted">No meeting requests in this category.</p>`}</div>
    </details>`;
    const feed = elements.leadership.querySelector(`[data-leadership-feed="${category}"]`);
    const posts = (state.leadership.posts || []).filter((post) => post.category === category);
    feed.innerHTML = posts.map((post) => `<article class="leadership-message">
      ${memberMiniProfile({ id: post.playerId, name: post.playerName, profileImage: post.profileImage }, formatDateTime(post.createdAt))}
      <p>${escapeHtml(post.text)}</p>
      ${post.userId === state.me.uid || state.permissions.isAdministrator ? `<button class="danger-button" type="button" data-delete-leadership-post="${escapeHtml(post.id)}">Delete</button>` : ""}
    </article>`).join("") || `<p class="muted">No shared leadership notes yet.</p>`;
  }
  for (const category of ["strategy", "weekly"]) {
    const meeting = state.leadership.meetings?.[category];
    const card = elements.leadership.querySelector(`[data-leadership-meeting-card="${category}"]`);
    card.innerHTML = meeting ? `<article class="leadership-meeting-card">
      <span>Scheduled leadership session</span><strong>${escapeHtml(meeting.date)} · ${escapeHtml(meeting.time)}</strong>
      <small>20 minutes</small><p>${escapeHtml(meeting.agenda || "Agenda to be confirmed.")}</p>
    </article>` : `<p class="muted">No meeting scheduled.</p>`;
    const form = elements.leadership.querySelector(`[data-leadership-meeting="${category}"]`);
    if (meeting) {
      form.elements.date.value = meeting.date;
      form.elements.time.value = meeting.time;
      form.elements.agenda.value = meeting.agenda || "";
    }
  }
}

async function handleLeadershipSubmit(event) {
  const meetingForm = event.target.closest("[data-leadership-meeting]");
  const postForm = event.target.closest("[data-leadership-post]");
  const requestForm = event.target.closest("[data-leadership-request-form]");
  if (!meetingForm && !postForm && !requestForm) return;
  event.preventDefault();
  try {
    const form = Object.fromEntries(new FormData(event.target));
    if (meetingForm) await api.scheduleLeadershipMeeting({ ...form, category: meetingForm.dataset.leadershipMeeting });
    else if (requestForm) await api.requestLeadershipMeeting({ ...form, category: requestForm.dataset.leadershipRequestForm });
    else await api.addLeadershipPost({ ...form, category: postForm.dataset.leadershipPost });
    if (postForm || requestForm) event.target.reset();
    await refreshState();
    showView("leadership");
    setStatus(meetingForm ? "20-minute leadership meeting scheduled" : requestForm ? "Leadership meeting request sent" : "Leadership collaboration updated");
  } catch (error) { setStatus(error.message, true); }
}

async function handleLeadershipClick(event) {
  const button = event.target.closest("[data-delete-leadership-post]");
  if (!button) return;
  if (!confirm("Delete this leadership note?")) return;
  try {
    await api.deleteLeadershipPost(button.dataset.deleteLeadershipPost);
    await refreshState();
    showView("leadership");
    setStatus("Leadership note deleted");
  } catch (error) { setStatus(error.message, true); }
}

async function handleOwnProfileSave(event) {
  if (event.target.id !== "ownProfileForm") return;
  event.preventDefault();
  try {
    state = await api.updateOwnProfile(Object.fromEntries(new FormData(event.target)));
    render();
    setStatus("Your profile was saved");
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function handleOwnProfileImage(event) {
  if (!event.target.matches("[data-own-profile-image]")) return;
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    setStatus("Choose an image file", true);
    return;
  }
  try {
    setStatus("Optimizing profile picture...");
    state = await api.updateOwnProfile({ profileImage: await compressProfileImage(file) });
    render();
    setStatus("Your game profile picture was saved");
  } catch (error) {
    setStatus(error.message, true);
  }
}

function renderHeaderProfile() {
  const player = state.players.find((item) => item.id === state.me.playerId);
  elements.headerProfileLabel.innerHTML = `<strong>${escapeHtml(state.me.profileTitle || "Alliance Member")}</strong><small>${escapeHtml(state.me.profileBio || "Member bio")}</small>`;
  elements.headerProfileAvatar.innerHTML = player?.profileImage
    ? `<img src="${escapeHtml(player.profileImage)}" alt="" style="object-fit:${escapeHtml(player.profileImageFit || "cover")};object-position:${escapeHtml(player.profileImagePosition || "center")}">`
    : `<strong>${escapeHtml(player?.gameName?.slice(0, 1) || "?")}</strong>`;
}

function memberMiniProfile(memberOrId, extra = "") {
  const player = typeof memberOrId === "string"
    ? state.players.find((item) => item.id === memberOrId)
    : state.players.find((item) => item.id === memberOrId.id || item.id === memberOrId.playerId);
  if (!player) return "";
  return `<button class="mini-profile" type="button" data-mini-profile="${escapeHtml(player.id)}">
    ${player.profileImage
      ? `<img src="${escapeHtml(player.profileImage)}" alt="" style="object-fit:${escapeHtml(player.profileImageFit || "cover")};object-position:${escapeHtml(player.profileImagePosition || "center")}">`
      : `<span>${escapeHtml(player.gameName.slice(0, 1))}</span>`}
    <span><strong>${escapeHtml(player.gameName)}</strong><small>${escapeHtml(extra || player.rank || "Member")}</small></span>
  </button>`;
}

function handleMiniProfileClick(event) {
  const closeButton = event.target.closest("[data-close-member-profile]");
  if (closeButton) {
    elements.memberProfileDialog.close();
    return;
  }
  const button = event.target.closest("[data-mini-profile]");
  if (!button) return;
  const player = state.players.find((item) => item.id === button.dataset.miniProfile);
  const member = state.members.find((item) => item.id === button.dataset.miniProfile);
  if (!player) return;
  elements.memberProfileDialogContent.innerHTML = `
    <div class="profile-quick-view">
      ${player.profileImage
        ? `<img src="${escapeHtml(player.profileImage)}" alt="${escapeHtml(player.gameName)}" style="object-fit:${escapeHtml(player.profileImageFit || "cover")};object-position:${escapeHtml(player.profileImagePosition || "center")}">`
        : `<span>${escapeHtml(player.gameName.slice(0, 1))}</span>`}
      <div><p class="eyebrow">${escapeHtml(player.rank || "Member")}</p><h3>${escapeHtml(player.gameName)}</h3>
      <p>${escapeHtml(member ? `Team ${member.team} · ${member.tacticalGroup || "Reserve"} · ${member.unit || "Unassigned"}` : "")}</p></div>
    </div>`;
  elements.memberProfileDialog.showModal();
}

async function handleOwnProfileClick(event) {
  if (!event.target.closest("[data-use-account-photo]")) return;
  try {
    state = await api.updateOwnProfile({ useAccountPhoto: true });
    render();
    setStatus("Your account picture was imported");
  } catch (error) {
    setStatus(error.message, true);
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
    renderVsAuditPanel();
    elements.userList.innerHTML = users.map((user) => `
      <article class="panel user-card" data-user-id="${escapeHtml(user.uid)}">
        <div><strong>${escapeHtml(user.displayName)}</strong><span>${escapeHtml(user.email)}</span><small>${user.profileConfirmedAt
          ? `Profile confirmed: ${escapeHtml(user.profileSelection?.playerName || "linked player")}`
          : "Profile confirmation required"}</small></div>
        ${user.role === "administrator" && !state.permissions.isAdministrator
          ? `<label>Role<strong>administrator</strong></label>`
          : `<label>Role<select data-user-field="role">${optionHtml(["member", "officer", ...(state.permissions.isAdministrator ? ["administrator"] : [])], user.role)}</select></label>`}
        <label>Linked player<select data-user-field="playerId"><option value="">Not linked</option>${state.players.map((player) => `<option value="${escapeHtml(player.id)}" ${player.id === user.playerId ? "selected" : ""}>${escapeHtml(player.gameName)}</option>`).join("")}</select></label>
        <label>Active<input data-user-field="active" type="checkbox" ${user.active ? "checked" : ""}></label>
      </article>
    `).join("") || emptyState("No application users have signed in yet.");
    const playerName = (id) => state.players.find((player) => player.id === id)?.gameName || "Linked member";
    elements.officerInbox.innerHTML = `
      <article class="panel"><h3>Same-day availability notices</h3>${(state.memberNotices || []).map((notice) => `<div class="admin-message"><strong>${escapeHtml(playerName(notice.playerId))} · ${escapeHtml(notice.eventType)}</strong><span>${escapeHtml(formatDateTime(notice.createdAt))}</span><p>${escapeHtml(notice.message)}</p></div>`).join("") || `<p class="muted">No notices.</p>`}</article>
      <article class="panel"><h3>Member questions</h3>${(state.officerQuestions || []).map((question) => `<div class="admin-message"><strong>${escapeHtml(playerName(question.playerId))}</strong><span>${escapeHtml(formatDateTime(question.createdAt))}</span><p>${escapeHtml(question.message)}</p></div>`).join("") || `<p class="muted">No questions.</p>`}</article>`;
  } catch (error) {
    elements.userList.innerHTML = emptyState(error.message);
  }
}

function renderVsAuditPanel() {
  const weeks = (state.vsWeeks || []).filter((week) => {
    const group = (state.duelLeagueGroups || []).find((item) => item.id === week.duelLeagueGroupId);
    return !group?.archived;
  });
  const selectedWeekId = elements.vsAuditPanel.querySelector("[data-vs-audit-week]")?.value || weeks[0]?.id || "";
  const week = weeks.find((item) => item.id === selectedWeekId) || weeks[0];
  const days = week ? vsWeekDays(week.beginDate) : [];
  const selectedDate = elements.vsAuditPanel.querySelector("[data-vs-audit-date]")?.value || days[0]?.date || "";
  const group = (state.duelLeagueGroups || []).find((item) => item.id === week?.duelLeagueGroupId);
  const audit = latestVsAudit?.weekId === week?.id && latestVsAudit?.date === selectedDate ? latestVsAudit : null;
  elements.vsAuditPanel.innerHTML = `<div class="vs-audit-controls">
    <label>Grouping / VS week<select data-vs-audit-week>${weeks.map((item) => {
      const itemGroup = (state.duelLeagueGroups || []).find((groupItem) => groupItem.id === item.duelLeagueGroupId);
      return `<option value="${escapeHtml(item.id)}" ${item.id === week?.id ? "selected" : ""}>${escapeHtml(itemGroup?.code || "")} · ${item.duelLeagueWeek}/4 · vs ${escapeHtml(item.opponent)}</option>`;
    }).join("")}</select></label>
    <label>Day<select data-vs-audit-date>${days.map((day) => `<option value="${day.date}" ${day.date === selectedDate ? "selected" : ""}>${day.label} · ${day.date}</option>`).join("")}</select></label>
    <button class="secondary-button" type="button" data-run-vs-audit ${week ? "" : "disabled"}>Run Audit</button>
    ${audit?.passed && !audit.published ? `<button class="primary-button" type="button" data-publish-vs-day>Publish Daily Scores</button>` : ""}
  </div>
  ${week ? `<p class="muted">${escapeHtml(group?.code || "")} Week ${week.duelLeagueWeek}/4</p>` : emptyState("No active VS weeks are available for audit.")}
  ${audit ? `<div class="readiness-grid">
    ${validationPanel("Missing player scores", audit.missingPlayers.map((player) => player.name), audit.missingPlayers.length ? "error" : "passed")}
    ${validationPanel("Duplicate player scores", audit.duplicatePlayers.map((player) => `${player.name} × ${player.count}`), audit.duplicatePlayers.length ? "error" : "passed")}
    ${validationPanel("Invalid scores", audit.invalidScores, audit.invalidScores.length ? "error" : "passed")}
    ${validationPanel("Team final result", audit.missingTeamResult ? ["Daily team totals are missing"] : [], audit.missingTeamResult ? "error" : "passed")}
  </div><p class="${audit.passed ? "audit-pass" : "audit-fail"}">${audit.published ? "Published and locked" : audit.passed ? `Audit passed: ${audit.submittedScores}/${audit.expectedPlayers} player scores verified.` : "Audit failed. Correct the items above before publishing."}</p>` : ""}`;
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
  const player = state.players.find((item) => item.id === playerId);
  if (!playerId || !player) {
    elements.myAssignmentContent.innerHTML = emptyState("Your account is not linked to a roster player yet. Ask an administrator to link it.");
    return;
  }
  const strategy = participant ? state.eventStrategy?.[participant.team] : null;
  const battleTime = participant && event ? event[`battleTime${participant.team}`] || "Not set" : "Not assigned";
  const todayKey = new Date().toISOString().slice(0, 10);
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const activeThemes = (state.themeWeeks || []).filter((theme) => theme.status !== "archived");
  const concludedThemes = [...new Map([...(state.themeWeeks || []), ...(state.archivedThemeWeeks || [])]
    .filter((theme) => ["finalized", "archived"].includes(theme.status) && theme.winner)
    .map((theme) => [theme.id, theme])).values()]
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
    .slice(0, 3);
  const pendingThemes = activeThemes.filter((theme) => !theme.acknowledgedAt);
  const pendingAnnouncements = (state.announcements || []).filter((announcement) => !announcement.acknowledgedAt);
  const todayAllianceEvents = (state.allianceWeeklyEvents || []).filter((item) => item.date === todayKey);
  const dsIsToday = event?.date === todayKey;
  elements.myAssignmentContent.innerHTML = `
    <article class="weekly-welcome panel">
      ${memberMiniProfile(player, state.me.profileTitle || "Alliance Member")}
      <div><p class="eyebrow">${escapeHtml(today)}</p><h3>Welcome back, ${escapeHtml(player.gameName)}!</h3>
      <p>Today's plan highlights your scheduled events and current assignments.</p></div>
    </article>
    ${concludedThemes.map((theme) => theme.winner.playerId === playerId ? `<article class="panel theme-winner-briefing personal-winner">
      ${theme.winner.submissionImage ? `<img src="${theme.winner.submissionImage}" alt="${escapeHtml(theme.winner.playerName)} winning profile-picture submission">` : ""}
      <div><p class="eyebrow">Theme Week winner</p><h3>Congrats ${escapeHtml(theme.winner.playerName)}, you've won ${escapeHtml(theme.title)}!</h3><p>We loved your PFP submission just as much as the team—so much so you've been added as a conductor for the upcoming train! Pick a VIP of your choice, and enjoy the ride on the golden train!</p></div>
    </article>` : `<article class="panel theme-winner-briefing">
      ${theme.winner.submissionImage ? `<img src="${theme.winner.submissionImage}" alt="${escapeHtml(theme.winner.playerName)} winning profile-picture submission">` : ""}
      <div><p class="eyebrow">${escapeHtml(theme.title)} concluded</p><h3>${escapeHtml(theme.winner.playerName)} won Theme Week</h3><p>The winning profile-picture submission received ${theme.winner.votes} vote${theme.winner.votes === 1 ? "" : "s"}.</p></div>
    </article>`).join("")}
    <section class="today-strip">
      ${dsIsToday && participant ? `<article><strong>DS · Team ${escapeHtml(participant.team)}</strong><span>${escapeHtml(battleTime)} server · ${escapeHtml(serverToLocal(event.date, battleTime))} local</span></article>` : ""}
      ${todayAllianceEvents.map((item) => `<article><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.time)} server · ${escapeHtml(serverToLocal(item.date, item.time))} local</span></article>`).join("")}
      ${activeThemes.map((theme) => `<article><strong>${escapeHtml(theme.title)}</strong><span>${theme.status === "voting" ? "Voting is open — cast your one vote" : `Theme reminder · ${escapeHtml(theme.status)}`}</span></article>`).join("")}
      ${!dsIsToday && !todayAllianceEvents.length && !activeThemes.length ? `<article><strong>No timed events today</strong><span>Review the weekly plan below.</span></article>` : ""}
    </section>
    <section class="briefing-quick-actions">
      <form class="panel compact-action-form" data-briefing-action="notice">
        <strong>Same-day availability notice</strong>
        <label>Event<select name="eventType"><option>DS</option><option>Theme Week</option><option>Alliance Event</option></select></label>
        <label>Notice<input name="message" maxlength="300" required placeholder="I cannot make today's event because…"></label>
        <button class="secondary-button" type="submit">Send notice</button>
      </form>
      <form class="panel compact-action-form" data-briefing-action="question">
        <strong>Quick ask</strong>
        <label>Send to<select name="recipient"><option value="administrator">Administrator</option>${(state.officerRecipients || []).filter((account) => account.role === "officer").map((account) => `<option value="${escapeHtml(account.uid)}">${escapeHtml(account.displayName)}</option>`).join("")}</select></label>
        <label>Question<input name="message" maxlength="600" required placeholder="Ask an officer or administrator…"></label>
        <button class="secondary-button" type="submit">Send question</button>
      </form>
    </section>
    ${pendingAnnouncements.length ? `<section class="briefing-announcements">${pendingAnnouncements.map((announcement) => `<article class="panel compact-announcement"><div><strong>${escapeHtml(announcement.title)}</strong><p>${escapeHtml(announcement.summary)}</p></div><button class="secondary-button" type="button" data-announcement-acknowledge="${escapeHtml(announcement.id)}">Acknowledge</button></article>`).join("")}</section>` : ""}
    <article class="assignment-profile panel">
      <div class="assignment-profile-heading">
        <div><p class="eyebrow">Desert Storm weekly plan</p><h3>${event ? `${escapeHtml(event.date)} · ${escapeHtml(event.opponent || "Opponent pending")}` : "No published battle plan"}</h3></div>
        ${participant ? statusBadge(participant.availability) : ""}
      </div>
      ${event && participant ? `<div class="assignment-details">
        ${detail("Battle", `${event.date} · ${event.opponent || "Opponent pending"}`)}
        ${detail("Team / unit", `Team ${participant.team} · ${participant.tacticalGroup || "Not assigned"}`)}
        ${detail("Roster", participant.rosterStatus)}
        ${detail("Server time", battleTime)}
        ${detail("Your local time", serverToLocal(event.date, battleTime))}
        ${detail("Role", participant.role || "Not assigned")}
        ${detail("Unit", participant.tacticalGroup || "Not assigned")}
        ${detail("Structure focus", participant.unit || "Not assigned")}
        ${detail("Primary", participant.primaryAssignment || "Not assigned")}
        ${detail("Backup", participant.backupAssignment || "Not assigned")}
        ${detail("Strategy", strategy?.name || event[`strategy${participant.team}`] || "Not selected")}
      </div>` : `<p class="muted">Your next published Desert Storm assignment will appear here automatically.</p>`}
      <div class="important-instructions"><strong>Important instructions</strong><p>${escapeHtml(event?.importantInstructions || strategy?.description || "No additional instructions.")}</p></div>
      ${event && participant ? `<div class="availability-controls">
        <strong>My availability</strong>
        <div>
          ${["Confirmed", "Tentative", "Unavailable"].map((value) => `<button class="${participant.availability === value ? "primary-button" : "secondary-button"}" type="button" data-availability="${value}">${value}</button>`).join("")}
        </div>
        <label>Availability note<input id="availabilityNote" value="${escapeHtml(participant.availabilityNote || "")}" maxlength="180" placeholder="Optional short note"></label>
      </div>
      <p class="muted">Assignment updated ${escapeHtml(formatDateTime(participant.updatedAt))}</p>` : ""}
    </article>
    <section class="weekly-briefing-grid">
      <article class="panel"><h3>Alliance events this week</h3>
        ${(state.allianceWeeklyEvents || []).map((item) => `<div class="briefing-line"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.date)} · ${escapeHtml(item.time)} server · ${escapeHtml(serverToLocal(item.date, item.time))} local</span><p>${escapeHtml(item.overview)}</p></div>`).join("") || `<p class="muted">No alliance events have been posted.</p>`}
      </article>
      <article class="panel"><h3>Theme-week updates</h3>
        ${activeThemes.map((theme) => `<div class="briefing-line ${theme.acknowledgedAt ? "" : "briefing-unread"}"><strong>${escapeHtml(theme.title)}</strong><span>${escapeHtml(theme.weekOf)} · ${escapeHtml(theme.status)}</span><p>${escapeHtml(theme.description)}</p>${theme.acknowledgedAt ? `<small>Acknowledged ${escapeHtml(formatDateTime(theme.acknowledgedAt))}</small>` : `<button class="primary-button" type="button" data-theme-acknowledge="${escapeHtml(theme.id)}">Acknowledge update</button>`}</div>`).join("") || `<p class="muted">No active theme week.</p>`}
      </article>
    </section>
    ${pendingThemes.length ? `<p class="weekly-notice">${pendingThemes.length} theme-week update${pendingThemes.length === 1 ? "" : "s"} require acknowledgement.</p>` : ""}
  `;
}

async function handleBriefingAction(event) {
  const form = event.target.closest("[data-briefing-action]");
  if (!form) return;
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(form));
  try {
    if (form.dataset.briefingAction === "notice") await api.addMemberNotice(payload);
    else await api.addOfficerQuestion(payload);
    form.reset();
    await refreshState();
    setStatus(form.dataset.briefingAction === "notice" ? "Availability notice sent" : "Question sent");
  } catch (error) {
    setStatus(error.message, true);
  }
}

function renderEvents() {
  const event = state.activeEvent;
  renderDsEventTeamOverview();
  elements.eventActions.innerHTML = event ? `
    <div class="event-action-heading"><div><h3>${escapeHtml(event.date)} · ${escapeHtml(event.opponent || "Opponent pending")}</h3>
    <p class="muted">${eventStatusLabel(event.status)} · Team A ${escapeHtml(event.battleTimeA)} server / ${escapeHtml(serverToLocal(event.date, event.battleTimeA))} local · Team B ${escapeHtml(event.battleTimeB)} server / ${escapeHtml(serverToLocal(event.date, event.battleTimeB))} local</p>
    <p>${escapeHtml(event.importantInstructions || "No additional DS instructions posted.")}</p></div>${statusBadge(event.status)}</div>
  ` : emptyState("No DS event has been published.");
  elements.publishReadiness.innerHTML = "";
  elements.eventList.innerHTML = state.events.map((item) => `<article class="history-card"><h3>${escapeHtml(item.date)} · ${escapeHtml(item.opponent || "Opponent pending")}</h3><p>${escapeHtml(eventStatusLabel(item.status))}</p></article>`).join("");
  return;
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
      ${event.status === "draft" ? `<button class="danger-button" data-delete-event="${escapeHtml(event.id)}" type="button">Delete Draft</button>` : ""}
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
      <div>${statusBadge(item.status)}${item.status === "draft" ? `<button class="danger-button" data-delete-event="${escapeHtml(item.id)}" type="button">Delete Draft</button>` : ""}</div>
    </article>
  `).join("");
}

function renderDsEventTeamOverview() {
  if (!elements.dsEventTeamOverview) return;
  const event = state.activeEvent;
  if (!event) {
    elements.dsEventTeamOverview.innerHTML = emptyState("No current DS team roster.");
    return;
  }
  elements.dsEventTeamOverview.innerHTML = ["A", "B"].map((team) => {
    const members = state.members.filter((member) => member.selected && member.team === team);
    const groups = tacticalGroups.filter((group) => members.some((member) => member.tacticalGroup === group));
    const opening = [...(state.eventStrategy?.[team]?.phases || [])].sort((left, right) => Number(left.startMinute) - Number(right.startMinute))[0];
    return `<section class="panel ds-team-card">
      <div class="assignment-profile-heading"><div><p class="eyebrow">Team ${team} roster</p><h3>${members.length} selected · ${escapeHtml(event[`battleTime${team}`])} server</h3></div><span class="status-badge">${escapeHtml(serverToLocal(event.date, event[`battleTime${team}`]))} local</span></div>
      <p class="muted">${escapeHtml(state.eventStrategy?.[team]?.name || event[`strategy${team}`] || "Strategy pending")}</p>
      <div class="ds-unit-grid">${groups.map((group) => {
        const groupMembers = members.filter((member) => member.tacticalGroup === group);
        const order = opening?.groupOrders?.[group];
        return `<article class="ds-unit-card"><div class="assignment-heading"><h4>${escapeHtml(group)}</h4><span>${groupMembers.length}</span></div>
          <p>${escapeHtml(order?.goal || `${order?.primaryAction || "Support"} ${order?.primaryObjective || "the assigned objective"}.`)}</p>
          <div class="mini-profile-list">${groupMembers.map((member) => memberMiniProfile(member, `${member.type} · ${member.availability}${member.unitLeader ? " · Unit leader" : ""}`)).join("")}</div>
        </article>`;
      }).join("") || `<p class="muted">No selected members assigned.</p>`}</div>
    </section>`;
  }).join("");
}

async function handleEventListClick(event) {
  const button = event.target.closest("[data-delete-event]");
  if (!button || !confirm("Delete this draft battle plan? This cannot be undone.")) return;
  try {
    await api.deleteEvent(button.dataset.deleteEvent);
    await refreshState();
    setStatus("Draft battle plan deleted");
  } catch (error) {
    setStatus(error.message, true);
  }
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
    const date = elements.nextBattleDate.value;
    if (!date) throw new Error("Choose the upcoming battle date");
    if (date < new Date().toISOString().slice(0, 10)) throw new Error("Choose today or an upcoming battle date");
    await api.createEvent({ date });
    await refreshState();
    setStatus("Draft battle created");
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function publishDsSetup() {
  if (!state.activeEvent) {
    setStatus("Create the new DS battle week first", true);
    return;
  }
  try {
    const strategyA = elements.createStrategyA.value;
    const strategyB = elements.createStrategyB.value;
    const templateA = state.strategyTemplates.find((template) => template.name === strategyA);
    const templateB = state.strategyTemplates.find((template) => template.name === strategyB);
    if (!templateA || !templateB) throw new Error("Choose a valid strategy for both teams");
    await api.updateEvent(state.activeEvent.id, {
      battleTimeA: elements.createBattleTimeA.value,
      battleTimeB: elements.createBattleTimeB.value,
      strategyA,
      strategyB,
      setupPublishedAt: new Date().toISOString(),
      version: state.activeEvent.version
    });
    await api.applyStrategy(state.activeEvent.id, { templateId: templateA.id, team: "A" });
    await api.applyStrategy(state.activeEvent.id, { templateId: templateB.id, team: "B" });
    await refreshState();
    setStatus("DS setup published; weekly roster editing is unlocked");
  } catch (error) {
    setStatus(error.message, true);
    await refreshState();
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
  elements.announcementList.innerHTML = (state.announcements || []).map((announcement) => `<article class="panel announcement-card">
    <div>
      <p class="eyebrow">Posted by ${escapeHtml(announcement.createdByName || "EWAR Officer")} · ${escapeHtml(formatDateTime(announcement.createdAt))}</p>
      <h3>${escapeHtml(announcement.title)}</h3><p>${escapeHtml(announcement.summary)}</p>
    </div>
    ${announcement.attachment ? (announcement.attachment.startsWith("data:image/") ? `<img src="${announcement.attachment}" alt="">` : `<a class="secondary-button" href="${announcement.attachment}" download="${escapeHtml(announcement.attachmentName || "attachment")}">Download attachment</a>`) : ""}
    <div class="announcement-feedback">
      <button class="secondary-button ${announcement.markedHelpful ? "is-active" : ""}" type="button" data-announcement-helpful="${escapeHtml(announcement.id)}">Helpful · ${Number(announcement.helpfulCount || 0)}</button>
      <span>${(announcement.replies || []).length} ${(announcement.replies || []).length === 1 ? "reply" : "replies"}</span>
    </div>
    <div class="announcement-replies">
      ${(announcement.replies || []).map((reply) => `<div class="announcement-reply">${memberMiniProfile({ id: reply.playerId, name: reply.playerName, profileImage: reply.profileImage }, formatDateTime(reply.createdAt))}<p>${escapeHtml(reply.text)}</p></div>`).join("")}
      <div class="announcement-reply-editor">
        <input type="text" maxlength="500" placeholder="Reply to this announcement" data-announcement-reply-text="${escapeHtml(announcement.id)}">
        <button class="secondary-button" type="button" data-announcement-reply="${escapeHtml(announcement.id)}">Reply</button>
      </div>
    </div>
    ${state.permissions.isOfficer ? `<button class="danger-button" type="button" data-delete-announcement="${escapeHtml(announcement.id)}">Delete</button>` : ""}
  </article>`).join("") || emptyState("No Ewar announcements posted.");
  elements.privateMessageRecipient.innerHTML = `<option value="">Choose a member</option>${(state.messageRecipients || []).map((member) =>
    `<option value="${escapeHtml(member.uid)}">${escapeHtml(member.name)}</option>`
  ).join("")}`;
  elements.privateMessageList.innerHTML = [...(state.privateMessages || [])].reverse().map((message) =>
    `<div class="community-message ${message.direction}"><strong>${message.direction === "sent" ? `To ${escapeHtml(message.recipientName)}` : `From ${escapeHtml(message.senderName)}`}</strong><small>${escapeHtml(formatDateTime(message.createdAt))}</small><p>${escapeHtml(message.text)}</p></div>`
  ).join("") || `<p class="muted">No private messages yet.</p>`;
  elements.dailyChatDate.textContent = `${state.dailyChatDate || "Today"} · resets daily`;
  elements.dailyChatList.innerHTML = (state.dailyChat || []).map((message) =>
    `<div class="community-message">${memberMiniProfile({ id: message.playerId, name: message.playerName, profileImage: message.profileImage }, formatDateTime(message.createdAt))}<p>${escapeHtml(message.text)}</p></div>`
  ).join("") || `<p class="muted">No team chat messages today.</p>`;
}

async function handlePrivateMessageSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    await api.sendPrivateMessage({ recipientUid: form.get("recipientUid"), text: form.get("text") });
    event.currentTarget.reset();
    await refreshState();
    setStatus("Private message sent");
  } catch (error) { setStatus(error.message, true); }
}

async function handleDailyChatSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    await api.postDailyChat(form.get("text"));
    event.currentTarget.reset();
    await refreshState();
    setStatus("Team chat message posted");
  } catch (error) { setStatus(error.message, true); }
}

async function postAnnouncement(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const file = formData.get("attachmentFile");
  try {
    let attachment = "";
    if (file?.size) {
      if (file.type.startsWith("image/")) attachment = await compressProfileImage(file);
      else {
        if (file.size > 3_000_000) throw new Error("Keep non-image announcement attachments under 3 MB");
        attachment = await fileToDataUrl(file);
      }
    }
    await api.addAnnouncement({
      title: formData.get("title"),
      summary: formData.get("summary"),
      attachment,
      attachmentName: file?.name || ""
    });
    event.currentTarget.reset();
    await refreshState();
    setStatus("Announcement posted");
  } catch (error) { setStatus(error.message, true); }
}

async function handleAnnouncementClick(event) {
  const deleteButton = event.target.closest("[data-delete-announcement]");
  const helpfulButton = event.target.closest("[data-announcement-helpful]");
  const replyButton = event.target.closest("[data-announcement-reply]");
  if (!deleteButton && !helpfulButton && !replyButton) return;
  try {
    if (deleteButton) {
      if (!confirm("Delete this announcement?")) return;
      await api.deleteAnnouncement(deleteButton.dataset.deleteAnnouncement);
    } else if (helpfulButton) {
      await api.toggleAnnouncementHelpful(helpfulButton.dataset.announcementHelpful);
    } else {
      const id = replyButton.dataset.announcementReply;
      const input = elements.announcementList.querySelector(`[data-announcement-reply-text="${CSS.escape(id)}"]`);
      await api.replyToAnnouncement(id, input?.value || "");
    }
    await refreshState();
  } catch (error) { setStatus(error.message, true); }
}

function renderDirectory() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const filter = elements.filterInput.value;
  const teamFilter = elements.directoryTeamFilter.value;
  const rankFilter = elements.rankSort.value;
  const members = state.members
    .filter((member) => !query || member.name.toLowerCase().includes(query))
    .filter((member) => !teamFilter || member.team === teamFilter)
    .filter((member) => rankFilter === "grouped" || member.rank === rankFilter)
    .filter((member) => {
      if (filter === "selected") return member.selected;
      if (filter === "reserve") return member.team === "Reserve";
      return true;
    });
  members.sort(masterRosterComparator);
  let previousGroup = "";
  const rows = members.map((member) => {
    const group = `${member.team} · ${member.rank || "No rank"}`;
    const heading = group === previousGroup ? "" : `<tr class="directory-group-row"><th colspan="9">Team ${escapeHtml(group)}</th></tr>`;
    previousGroup = group;
    return `${heading}${directoryRow(member)}`;
  }).join("");

  const lockRow = !state.activeEvent?.setupPublishedAt
    ? `<tr class="directory-group-row"><th colspan="9">Roster locked — create and publish Team A/B server times and strategies in Create.</th></tr>`
    : "";
  const selectedMembers = state.members.filter((member) => member.selected);
  const confirmedMembers = selectedMembers.filter((member) => member.availability === "Confirmed");
  elements.directorySummary.innerHTML = `
    <article><span>Alliance members</span><strong>${state.members.length}</strong><small>Registered roster profiles</small></article>
    <article><span>Team A</span><strong>${state.members.filter((member) => member.team === "A").length}</strong><small>${selectedMembers.filter((member) => member.team === "A").length} selected this week</small></article>
    <article><span>Team B</span><strong>${state.members.filter((member) => member.team === "B").length}</strong><small>${selectedMembers.filter((member) => member.team === "B").length} selected this week</small></article>
    <article><span>Confirmed</span><strong>${confirmedMembers.length}/${selectedMembers.length}</strong><small>Selected players signed up</small></article>
  `;
  elements.directoryRows.innerHTML = `${lockRow}${rows || `<tr><td colspan="9">No members match this view.</td></tr>`}`;
}

function masterRosterComparator(left, right) {
  const rankOrder = { R5: 0, R4: 1, R3: 2, R2: 3, R1: 4 };
  const teamOrder = { A: 0, B: 1, Reserve: 2 };
  const leftRank = String(left.rank || "").trim().toUpperCase();
  const rightRank = String(right.rank || "").trim().toUpperCase();
  return (rankOrder[leftRank] ?? 9) - (rankOrder[rightRank] ?? 9)
    || (teamOrder[left.team] ?? 9) - (teamOrder[right.team] ?? 9)
    || String(left.name || "").localeCompare(String(right.name || ""), undefined, { sensitivity: "base", numeric: true })
    || String(left.id || "").localeCompare(String(right.id || ""));
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
            ${memberMiniProfile(member, `${member.type} · ${member.availability}`)}
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
        ${state.permissions.isOfficer ? `<button class="danger-button history-delete-button" type="button" data-delete-battle="${escapeHtml(battle.id)}">Delete</button>` : ""}
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
  elements.duelLeagueHistoryList.innerHTML = (state.duelLeagueGroups || []).filter((group) =>
    group.archived || (state.vsWeeks || []).some((week) =>
      week.duelLeagueGroupId === group.id && Object.keys(week.publishedDays || {}).length
    )
  ).map((group) => {
    const weeks = (state.vsWeeks || []).filter((week) => week.duelLeagueGroupId === group.id).sort((left, right) => left.duelLeagueWeek - right.duelLeagueWeek);
    return `<details class="history-card" data-duel-history-group="${escapeHtml(group.id)}"><summary><strong>Duel League ${escapeHtml(group.code)} · ${group.archived ? "Archived four-week cycle" : "Published daily history"}</strong></summary>
      <label>Reference week<select data-history-duel-week>${weeks.map((week) => `<option value="${week.id}">Week ${week.duelLeagueWeek}/4 · vs ${escapeHtml(week.opponent)}</option>`).join("")}</select></label>
      ${weeks.map((week, index) => {
        const dates = vsWeekDays(week.beginDate);
        return `<section data-history-week-panel="${escapeHtml(week.id)}" ${index ? "hidden" : ""}>
          <h4>${escapeHtml(group.code)} · Week ${week.duelLeagueWeek}/4 · EWAR vs ${escapeHtml(week.opponent)}</h4>
          <p class="muted">Server ${escapeHtml(week.server)} · ${week.opponentMembers} opponent members · begins ${escapeHtml(week.beginDate)}</p>
          ${duelRankingTable(week.standings)}
          <div class="history-score-table"><table><thead><tr><th>Day</th><th>Final</th><th>Result</th><th>Published</th></tr></thead><tbody>
          ${dates.map((day) => {
            const result = week.dailyResults?.[day.date] || {};
            const outcome = Number(result.ourScore) === Number(result.opponentScore) ? "Pending" : Number(result.ourScore) > Number(result.opponentScore) ? "Win" : "Loss";
            return `<tr><td>${day.label}</td><td>${Number(result.ourScore || 0).toLocaleString()} – ${Number(result.opponentScore || 0).toLocaleString()}</td><td>${outcome}</td><td>${week.publishedDays?.[day.date] ? formatDateTime(week.publishedDays[day.date].publishedAt) : "Not published"}</td></tr>`;
          }).join("")}</tbody></table></div>
        </section>`;
      }).join("")}
    </details>`;
  }).join("") || emptyState("No Duel League cycles archived yet.");
}

function renderAllianceWeeklyEvents() {
  elements.allianceEventList.innerHTML = (state.allianceWeeklyEvents || []).map((item) => `
    <article class="history-card weekly-manage-card">
      <div data-alliance-display="${escapeHtml(item.id)}"><h3>${escapeHtml(item.name)} · ${escapeHtml(item.date)}</h3><p>${escapeHtml(item.time)} server · ${escapeHtml(item.overview)}</p></div>
    </article>
  `).join("") || emptyState("No alliance weekly events have been published.");
}

function renderThemeWeeks() {
  const renderTheme = (theme, archived = false) => {
    const entries = Object.values(theme.submissions || {});
    const finalists = theme.finalistIds || [];
    const visibleEntries = theme.status === "voting"
      ? entries.filter((entry) => finalists.includes(entry.playerId))
      : entries;
    const stages = [["open", "1. Submissions"], ["finalists", "2. Finalists"], ["voting", "3. Vote"], ["finalized", "4. Results"]];
    return `<article class="panel theme-week-card">
      <div class="assignment-profile-heading"><div><p class="eyebrow">${escapeHtml(theme.weekOf)} · ${escapeHtml(theme.status)}</p><h3>${escapeHtml(theme.title)}</h3></div>${statusBadge(theme.status)}</div>
      <div class="theme-stage-track">${stages.map(([key, label]) => `<span class="${theme.status === key || (theme.status === "archived" && key === "finalized") ? "active" : ""}">${label}</span>`).join("")}</div>
      <div data-theme-display="${escapeHtml(theme.id)}"><p>${escapeHtml(theme.description)}</p><div class="important-instructions"><strong>Rules</strong><p>${escapeHtml(theme.rules)}</p></div></div>
      ${false ? `<form class="inline-edit-form" data-theme-edit-form="${escapeHtml(theme.id)}" hidden>
        <label>Theme title<input name="title" value="${escapeHtml(theme.title)}" maxlength="100" required></label>
        <label>Week of<input name="weekOf" type="date" value="${escapeHtml(theme.weekOf)}" required></label>
        <label class="wide-field">Description<textarea name="description" maxlength="1200" required>${escapeHtml(theme.description)}</textarea></label>
        <label class="wide-field">Rules<textarea name="rules" maxlength="1200" required>${escapeHtml(theme.rules)}</textarea></label>
      </form>` : ""}
      ${!archived && theme.status === "open" ? `<form class="theme-submission-form" data-theme-submission-form="${escapeHtml(theme.id)}">
        <label>Screenshot / profile picture<input type="file" accept="image/*" data-theme-image="${escapeHtml(theme.id)}"></label>
        <img class="theme-image-preview" data-theme-preview="${escapeHtml(theme.id)}" alt="" hidden>
        <label>Submission entry and OCR text<textarea data-theme-entry="${escapeHtml(theme.id)}" maxlength="4000" placeholder="Upload a screenshot to extract text, then review before submitting.">${escapeHtml(theme.submissions?.[state.me.playerId]?.text || "")}</textarea></label>
        <button class="primary-button" type="button" data-theme-submit="${escapeHtml(theme.id)}">Post my submission</button>
      </form>` : ""}
      <div class="theme-submission-grid">${visibleEntries.map((entry) => `<article class="theme-entry">
        ${memberMiniProfile({ id: entry.playerId, name: entry.playerName, profileImage: entry.profileImage }, "Theme submission")}
        ${finalists.includes(entry.playerId) && theme.status !== "open" ? `<span class="status-badge">Finalist</span>` : ""}
        ${entry.image ? `<img src="${entry.image}" alt="${escapeHtml(entry.playerName)} submission">` : ""}
        <p>${escapeHtml(entry.text)}</p>
        ${false ? `<label class="finalist-toggle"><input type="checkbox" data-theme-finalist="${escapeHtml(theme.id)}" value="${escapeHtml(entry.playerId)}" ${finalists.includes(entry.playerId) ? "checked" : ""}> Finalist</label>` : ""}
        ${theme.status === "voting" && finalists.includes(entry.playerId) ? `<button class="${theme.myVote === entry.playerId ? "primary-button" : "secondary-button"}" type="button" data-theme-vote="${escapeHtml(theme.id)}" data-finalist="${escapeHtml(entry.playerId)}" ${theme.myVote ? "disabled" : ""}>${theme.myVote === entry.playerId ? "Your vote is locked" : theme.myVote ? "Vote already submitted" : "Cast my one vote"}</button>` : ""}
      </article>`).join("") || `<p class="muted">No submissions yet.</p>`}</div>
      ${false ? `<div class="theme-officer-actions">
        <button class="secondary-button" type="button" data-edit-theme="${escapeHtml(theme.id)}">Edit details</button>
        <button class="primary-button" type="button" data-save-theme="${escapeHtml(theme.id)}" hidden>Save changes</button>
        <button class="secondary-button" type="button" data-cancel-theme="${escapeHtml(theme.id)}" hidden>Cancel</button>
        <button class="secondary-button" type="button" data-theme-status="${escapeHtml(theme.id)}" data-status="open">Open submissions</button>
        <button class="secondary-button" type="button" data-theme-status="${escapeHtml(theme.id)}" data-status="voting">Open voting</button>
        <button class="primary-button" type="button" data-theme-status="${escapeHtml(theme.id)}" data-status="archived">Archive & save results</button>
        <button class="danger-button" type="button" data-delete-theme="${escapeHtml(theme.id)}">Delete</button>
      </div>` : ""}
      ${false ? `<div class="theme-officer-actions"><button class="danger-button" type="button" data-delete-theme="${escapeHtml(theme.id)}">Delete archived theme</button></div>` : ""}
      ${(theme.rankings || []).length ? `<div class="theme-results"><h4>Final Rankings</h4><div class="theme-podium">${theme.rankings.slice(0, 3).map((item, index) => `<article class="theme-place theme-place-${index + 1}">${item.submissionImage ? `<img src="${item.submissionImage}" alt="${escapeHtml(item.playerName)} submission">` : ""}<span>${index + 1}${index === 0 ? "st" : index === 1 ? "nd" : "rd"} place</span><strong>${escapeHtml(item.playerName)}</strong><small>${item.votes} vote${item.votes === 1 ? "" : "s"}</small></article>`).join("")}</div><ol class="theme-remaining-ranks">${theme.rankings.slice(3).map((item) => `<li><strong>${escapeHtml(item.playerName)}</strong><span>${item.votes} vote${item.votes === 1 ? "" : "s"}</span></li>`).join("")}</ol></div>` : ""}
      ${!archived ? `<div class="theme-comments"><h4>Member discussion</h4>${(theme.comments || []).map((comment) => `<div>${memberMiniProfile({ id: comment.playerId, name: comment.playerName, profileImage: comment.profileImage }, formatDateTime(comment.createdAt))}<p>${escapeHtml(comment.text)}</p></div>`).join("")}<label>Comment<input data-theme-comment-text="${escapeHtml(theme.id)}" maxlength="500"></label><button class="secondary-button" type="button" data-theme-comment="${escapeHtml(theme.id)}">Post comment</button></div>` : ""}
    </article>`;
  };
  elements.themeWeekContent.innerHTML = (state.themeWeeks || []).map((theme) => renderTheme(theme)).join("") || emptyState("No active theme week has been created.");
  elements.themeHistoryList.innerHTML = (state.archivedThemeWeeks || []).map((theme) => renderTheme(theme, true)).join("") || emptyState("No theme-week archives yet.");
}

function renderCreateManagement() {
  if (!state.permissions.isOfficer) return;
  const event = state.activeEvent;
  elements.createdDsManagement.innerHTML = event ? `<article class="panel compact-management-card">
    <div><p class="eyebrow">${escapeHtml(eventStatusLabel(event.status))}</p><h4>${escapeHtml(event.date)} · ${escapeHtml(event.opponent || "Opponent pending")}</h4></div>
    <div class="inline-edit-form">
      <label>Date<input data-event-field="date" type="date" value="${escapeHtml(event.date)}" ${event.status !== "draft" ? "disabled" : ""}></label>
      <label>Opponent<input data-event-field="opponent" value="${escapeHtml(event.opponent)}"></label>
      <label class="wide-field">Instructions<textarea data-event-field="importantInstructions">${escapeHtml(event.importantInstructions || "")}</textarea></label>
    </div>
    <div class="record-actions">
      ${event.status === "draft" ? `<button class="primary-button" data-event-action="publish" type="button">Publish</button><button class="danger-button" data-delete-event="${escapeHtml(event.id)}" type="button">Delete</button>` : ""}
      ${event.status === "published" ? `<button class="primary-button" data-event-action="start" type="button">Start</button>` : ""}
      ${event.status === "in_progress" ? `<button class="primary-button" data-event-action="complete" type="button">Complete</button>` : ""}
      ${event.status === "completed" ? `<button class="primary-button" data-event-action="archive" type="button">Archive</button>` : ""}
    </div>
  </article>` : emptyState("No DS battle created.");

  elements.createdAllianceManagement.innerHTML = (state.allianceWeeklyEvents || []).map((item) => `<article class="panel compact-management-card">
    <div data-alliance-display="${escapeHtml(item.id)}"><h4>${escapeHtml(item.name)} · ${escapeHtml(item.date)}</h4><p>${escapeHtml(item.time)} server · ${escapeHtml(item.overview)}</p></div>
    <form class="inline-edit-form" data-alliance-edit-form="${escapeHtml(item.id)}" hidden>
      <label>Event<select name="name">${["MG", "ZS", "Shark", "Blimp", "Shark Blimp", "Other"].map((name) => `<option ${name === item.name ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}</select></label>
      <label>Date<input name="date" type="date" value="${escapeHtml(item.date)}"></label>
      <label>Time<input name="time" type="time" value="${escapeHtml(item.time)}"></label>
      <label class="wide-field">Overview<textarea name="overview">${escapeHtml(item.overview)}</textarea></label>
    </form>
    <div class="record-actions"><button class="secondary-button" data-edit-alliance-event="${escapeHtml(item.id)}" type="button">Edit</button><button class="primary-button" data-save-alliance-event="${escapeHtml(item.id)}" type="button" hidden>Save</button><button class="secondary-button" data-cancel-alliance-event="${escapeHtml(item.id)}" type="button" hidden>Cancel</button><button class="danger-button" data-delete-alliance-event="${escapeHtml(item.id)}" type="button">Delete</button></div>
  </article>`).join("") || emptyState("No alliance events created.");

  const duelGroups = (state.duelLeagueGroups || []).map((group) => {
    const weeks = (state.vsWeeks || []).filter((week) => week.duelLeagueGroupId === group.id);
    return `<article class="panel compact-management-card">
      <div><p class="eyebrow">${group.archived ? "Archived cycle" : "Active grouping set"}</p><h4>Duel League ${escapeHtml(group.code)}</h4>
      <p>${weeks.length}/4 weeks assigned</p></div>
      ${!group.archived ? `<div class="record-actions"><button class="primary-button" type="button" data-archive-duel-group="${escapeHtml(group.id)}">Archive 4-Week Cycle</button></div>` : ""}
    </article>`;
  }).join("");
  const vsWeeks = (state.vsWeeks || []).map((week) => {
    const group = (state.duelLeagueGroups || []).find((item) => item.id === week.duelLeagueGroupId);
    const completed = Object.values(week.dailyResults || {}).filter((result) => Number(result.ourScore) || Number(result.opponentScore)).length;
    return `<article class="panel compact-management-card">
      <div><p class="eyebrow">${escapeHtml(group?.code || "Duel League")} · ${week.duelLeagueWeek}/4 · Week of ${escapeHtml(week.beginDate)}</p><h4>VS ${escapeHtml(week.opponent)}</h4>
      <p>Server ${escapeHtml(week.server)} · ${week.opponentMembers} members · ${completed}/6 daily results</p></div>
      <div class="record-actions"><button class="danger-button" type="button" data-delete-vs-week="${escapeHtml(week.id)}">Delete</button></div>
    </article>`;
  }).join("");
  elements.createdVsManagement.innerHTML = duelGroups + vsWeeks || emptyState("No Duel League groups or VS weeks created.");

  elements.createdThemeManagement.innerHTML = (state.themeWeeks || []).map((theme) => `<article class="panel compact-management-card">
    <div data-theme-display="${escapeHtml(theme.id)}"><h4>${escapeHtml(theme.title)} · ${escapeHtml(theme.weekOf)}</h4><p>${escapeHtml(theme.description)}</p></div>
    <form class="inline-edit-form" data-theme-edit-form="${escapeHtml(theme.id)}" hidden>
      <label>Title<input name="title" value="${escapeHtml(theme.title)}"></label><label>Week<input name="weekOf" type="date" value="${escapeHtml(theme.weekOf)}"></label>
      <label class="wide-field">Description<textarea name="description">${escapeHtml(theme.description)}</textarea></label><label class="wide-field">Rules<textarea name="rules">${escapeHtml(theme.rules)}</textarea></label>
    </form>
    ${theme.status === "open" ? `<form class="theme-officer-submission" data-theme-officer-submission="${escapeHtml(theme.id)}"><h5>Add a member submission</h5><label>Roster member<select name="playerId" required><option value="">Choose member</option>${state.players.filter((player) => player.active !== false).sort((a, b) => a.gameName.localeCompare(b.gameName)).map((player) => `<option value="${escapeHtml(player.id)}">${escapeHtml(player.gameName)}</option>`).join("")}</select></label><label>Profile-picture submission<input name="imageFile" type="file" accept="image/*" required></label><label>Submission note<textarea name="text" maxlength="4000" placeholder="Optional submission details"></textarea></label><button class="primary-button">Add submission</button></form>` : ""}
    ${theme.status === "finalists" ? `<div class="compact-finalist-picker">${Object.values(theme.submissions || {}).map((entry) => `<label>${memberMiniProfile(entry.playerId, "Submission")}<input type="checkbox" data-theme-finalist="${escapeHtml(theme.id)}" value="${escapeHtml(entry.playerId)}" ${(theme.finalistIds || []).includes(entry.playerId) ? "checked" : ""}> Finalist</label>`).join("") || `<p class="muted">No submissions available for finalist selection.</p>`}</div>` : ""}
    <div class="record-actions"><button class="secondary-button" data-edit-theme="${escapeHtml(theme.id)}" type="button">Edit</button><button class="primary-button" data-save-theme="${escapeHtml(theme.id)}" type="button" hidden>Save</button><button class="secondary-button" data-cancel-theme="${escapeHtml(theme.id)}" type="button" hidden>Cancel</button>${theme.status === "open" ? `<button class="secondary-button" data-theme-status="${escapeHtml(theme.id)}" data-status="finalists" type="button">Close submissions &amp; select finalists</button>` : ""}${theme.status === "finalists" ? `<button class="secondary-button" data-theme-status="${escapeHtml(theme.id)}" data-status="voting" type="button">Open secret voting</button>` : ""}${theme.status === "voting" ? `<button class="primary-button" data-theme-status="${escapeHtml(theme.id)}" data-status="finalized" type="button">Finalize voting &amp; reveal results</button>` : ""}${theme.status === "finalized" ? `<button class="primary-button" data-theme-status="${escapeHtml(theme.id)}" data-status="archived" type="button">Archive rankings to History</button>` : ""}<button class="danger-button" data-delete-theme="${escapeHtml(theme.id)}" type="button">Delete</button></div>
  </article>`).join("") || emptyState("No theme weeks created.");
}

async function handleAllianceEventSubmit(event) {
  event.preventDefault();
  try {
    await api.createAllianceEvent(Object.fromEntries(new FormData(event.currentTarget)));
    event.currentTarget.reset();
    await refreshState();
    setStatus("Alliance event published to every member briefing");
  } catch (error) { setStatus(error.message, true); }
}

async function handleAllianceEventClick(event) {
  const edit = event.target.closest("[data-edit-alliance-event]");
  const save = event.target.closest("[data-save-alliance-event]");
  const cancel = event.target.closest("[data-cancel-alliance-event]");
  const remove = event.target.closest("[data-delete-alliance-event]");
  const id = edit?.dataset.editAllianceEvent || save?.dataset.saveAllianceEvent || cancel?.dataset.cancelAllianceEvent || remove?.dataset.deleteAllianceEvent;
  if (!id) return;
  if (edit || cancel) {
    toggleInlineEditor("alliance", id, Boolean(edit));
    return;
  }
  if (remove && !confirm("Delete this alliance event? It will be removed from every member briefing.")) return;
  try {
    if (save) {
      const form = elements.createdAllianceManagement.querySelector(`[data-alliance-edit-form="${CSS.escape(id)}"]`);
      await api.updateAllianceEvent(id, Object.fromEntries(new FormData(form)));
    } else {
      await api.deleteAllianceEvent(id);
    }
    await refreshState();
    setStatus(save ? "Alliance event changes saved" : "Alliance event deleted");
  }
  catch (error) { setStatus(error.message, true); }
}

async function handleThemeWeekCreate(event) {
  event.preventDefault();
  try {
    await api.createThemeWeek(Object.fromEntries(new FormData(event.currentTarget)));
    event.currentTarget.reset();
    await refreshState();
    setStatus("Theme week created");
  } catch (error) { setStatus(error.message, true); }
}

async function handleThemeScreenshotChange(event) {
  const input = event.target.closest("[data-theme-image]");
  if (!input?.files?.[0]) return;
  const themeId = input.dataset.themeImage;
  try {
    setStatus("Compressing screenshot and reading text...");
    const image = await compressProfileImage(input.files[0]);
    input.dataset.compressedImage = image;
    const preview = elements.themeWeekContent.querySelector(`[data-theme-preview="${CSS.escape(themeId)}"]`);
    preview.src = image; preview.hidden = false;
    const result = await api.themeOcr(await (await fetch(image)).blob());
    const textarea = elements.themeWeekContent.querySelector(`[data-theme-entry="${CSS.escape(themeId)}"]`);
    if (result.text) textarea.value = result.text;
    setStatus("Screenshot ready; review the extracted text");
  } catch (error) { setStatus(error.message, true); }
}

async function handleOfficerThemeSubmission(event) {
  const form = event.target.closest("[data-theme-officer-submission]");
  if (!form) return;
  event.preventDefault();
  const formData = new FormData(form);
  const file = formData.get("imageFile");
  if (!file?.size) return setStatus("Choose the member's profile-picture submission", true);
  try {
    setStatus("Preparing member Theme Week submission...");
    await api.addThemeSubmissionForMember(form.dataset.themeOfficerSubmission, {
      playerId: formData.get("playerId"),
      text: formData.get("text"),
      image: await compressProfileImage(file)
    });
    form.reset();
    await refreshState();
    setStatus("Member submission added by officer");
  } catch (error) { setStatus(error.message, true); }
}

async function handleThemeWeekClick(event) {
  const announcementAck = event.target.closest("[data-announcement-acknowledge]");
  const acknowledge = event.target.closest("[data-theme-acknowledge]");
  const submit = event.target.closest("[data-theme-submit]");
  const vote = event.target.closest("[data-theme-vote]");
  const comment = event.target.closest("[data-theme-comment]");
  const status = event.target.closest("[data-theme-status]");
  const remove = event.target.closest("[data-delete-theme]");
  const finalist = event.target.closest("[data-theme-finalist]");
  const edit = event.target.closest("[data-edit-theme]");
  const save = event.target.closest("[data-save-theme]");
  const cancel = event.target.closest("[data-cancel-theme]");
  try {
    if (announcementAck) await api.acknowledgeAnnouncement(announcementAck.dataset.announcementAcknowledge);
    else if (acknowledge) await api.themeAction(acknowledge.dataset.themeAcknowledge, "acknowledge");
    else if (submit) {
      const id = submit.dataset.themeSubmit;
      const input = elements.themeWeekContent.querySelector(`[data-theme-image="${CSS.escape(id)}"]`);
      const textInput = elements.themeWeekContent.querySelector(`[data-theme-entry="${CSS.escape(id)}"]`);
      await api.themeAction(id, "submit", { text: textInput.value, image: input.dataset.compressedImage || "" });
    } else if (vote) await api.themeAction(vote.dataset.themeVote, "vote", { finalistId: vote.dataset.finalist });
    else if (comment) {
      const input = elements.themeWeekContent.querySelector(`[data-theme-comment-text="${CSS.escape(comment.dataset.themeComment)}"]`);
      await api.themeAction(comment.dataset.themeComment, "comment", { text: input.value });
    } else if (edit || cancel) {
      const id = edit?.dataset.editTheme || cancel.dataset.cancelTheme;
      toggleInlineEditor("theme", id, Boolean(edit));
      return;
    } else if (save) {
      const form = elements.createdThemeManagement.querySelector(`[data-theme-edit-form="${CSS.escape(save.dataset.saveTheme)}"]`);
      await api.updateThemeWeek(save.dataset.saveTheme, Object.fromEntries(new FormData(form)));
    } else if (status) await api.updateThemeWeek(status.dataset.themeStatus, { status: status.dataset.status });
    else if (remove && confirm("Delete this theme week and its saved results?")) await api.deleteThemeWeek(remove.dataset.deleteTheme);
    else if (finalist) {
      const id = finalist.dataset.themeFinalist;
      const checked = [...elements.createdThemeManagement.querySelectorAll(`[data-theme-finalist="${CSS.escape(id)}"]:checked`)].map((item) => item.value);
      await api.updateThemeWeek(id, { finalistIds: checked });
    } else return;
    await refreshState();
  } catch (error) { setStatus(error.message, true); }
}

function toggleInlineEditor(type, id, editing) {
  const root = type === "alliance" ? elements.createdAllianceManagement : elements.createdThemeManagement;
  const suffix = type === "alliance" ? "alliance-event" : "theme";
  root.querySelector(`[data-${type}-display="${CSS.escape(id)}"]`)?.toggleAttribute("hidden", editing);
  root.querySelector(`[data-${type}-edit-form="${CSS.escape(id)}"]`)?.toggleAttribute("hidden", !editing);
  root.querySelector(`[data-edit-${suffix}="${CSS.escape(id)}"]`)?.toggleAttribute("hidden", editing);
  root.querySelector(`[data-save-${suffix}="${CSS.escape(id)}"]`)?.toggleAttribute("hidden", !editing);
  root.querySelector(`[data-cancel-${suffix}="${CSS.escape(id)}"]`)?.toggleAttribute("hidden", !editing);
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
          <div class="member-card-heading">${memberMiniProfile(item.playerId, `${item.attendancePercentage}% attendance`)}<strong>${item.attendancePercentage}%</strong></div>
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
    elements.strategyControls.classList.toggle("planning-mode-active", timelineEditMode);
    elements.strategyControls.innerHTML = `<div class="planning-mode-heading"><div><strong>${timelineEditMode ? "Planning mode" : "Tactical view"}</strong><span>${timelineEditMode ? "Strategy and squad orders are editable." : "Playback and squad reference only."}</span></div><button class="${timelineEditMode ? "primary-button" : "secondary-button"}" type="button" data-toggle-planning-mode>${timelineEditMode ? "Close planning mode" : "Open planning mode"}</button></div>
      ${timelineEditMode ? `<label>Strategy template<select id="strategyTemplateSelect"><option value="">Choose template</option>${state.strategyTemplates.map((template) => `<option value="${escapeHtml(template.id)}">${escapeHtml(template.name)}</option>`).join("")}</select></label><label>Apply template to<select id="strategyApplyTeam"><option>A</option><option>B</option></select></label>` : ""}`;
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
  if (!timelineSelectedGroup || !orders.some((order) => order.group === timelineSelectedGroup)) {
    timelineSelectedGroup = orders.find((order) => order.members.length)?.group || orders[0]?.group || "";
  }
  const selectedOrder = orders.find((order) => order.group === timelineSelectedGroup);
  const displayedOrders = timelineMovementView === "selected" && selectedOrder ? [selectedOrder] : orders;
  const activeObjectives = new Set(displayedOrders.flatMap((order) => [order.primaryObjective, order.secondaryObjective]).filter(Boolean));

  elements.strategyTimelineContent.innerHTML = `
    <div class="tactical-command-shell">
    <div class="timeline-map-controls">
      <div class="timeline-team-switch" aria-label="Choose tactical team">${teams.map((team) => `<button type="button" data-timeline-team="${team}" class="${team === timelineTeam ? "active" : ""}"><small>Battle group</small><strong>Team ${team}</strong></button>`).join("")}</div>
      <div class="tactical-strategy-identity"><span>Active strategy</span><strong>${escapeHtml(strategy?.name || event[`strategy${timelineTeam}`])}</strong><small>${escapeHtml(event[`battleTime${timelineTeam}`])} server time · ${escapeHtml(event.date || "Current battle")}</small></div>
    </div>
    ${phases.length ? `
      <div class="timeline-playback-bar">
        <button class="tactical-play-button" type="button" data-timeline-play><span>${timelinePlaybackTimer ? "Ⅱ" : "▶"}</span>${timelinePlaybackTimer ? "Pause playback" : "Play battle plan"}</button>
        <div><span>Battle progress</span><input aria-label="Battle timeline" data-timeline-scrubber type="range" min="0" max="5" step="1" value="${timelinePhaseIndex}"></div>
        <strong><small>Live interval</small>${Number(phase.startMinute)}–${Number(phase.endMinute)} min</strong>
      </div>
      <div class="timeline-phase-buttons">${phases.map((item, index) => `<button type="button" data-timeline-phase="${index}" class="${index === timelinePhaseIndex ? "active" : ""}"><small>Phase ${index + 1}</small><strong>${Number(item.startMinute)}–${Number(item.endMinute)}</strong></button>`).join("")}</div>
      <article class="timeline-phase-summary panel">
        <div class="phase-indicator"><span>Battle phase ${timelinePhaseIndex + 1} of ${phases.length}</span><strong>${Number(phase.startMinute)}–${Number(phase.endMinute)} minutes · ${escapeHtml(phase.name)}</strong></div>
        <div class="phase-explanation"><p>${escapeHtml(phase.instructions || "")}</p><small>${escapeHtml(phase.fallbackPlan ? `Fallback: ${phase.fallbackPlan}` : "Maintain the primary command until an officer calls the secondary objective.")}</small></div>
      </article>
      <div class="strategy-map-layout">
        <div class="strategy-map-stage">
          <div class="strategy-map-heading">
            <div><span>Live tactical position</span><strong>${timelineMovementView === "selected" ? `${escapeHtml(selectedOrder?.group || "Selected squad")} movement` : `Team ${timelineTeam} movement map`}</strong></div>
            <div class="movement-view-switch" aria-label="Movement display mode">
              <button type="button" data-movement-view="all" class="${timelineMovementView === "all" ? "active" : ""}">All unit movements</button>
              <button type="button" data-movement-view="selected" class="${timelineMovementView === "selected" ? "active" : ""}" ${selectedOrder ? "" : "disabled"}>Watch selected squad</button>
            </div>
          </div>
          <div class="strategy-tactical-map" aria-label="Interactive Desert Storm objective map">
            <img src="/assets/desert-storm-map-clean.png" alt="Desert Storm battle map">
            <div class="strategy-route-layer">${timelineRoutes(displayedOrders)}</div>
            <div class="strategy-group-layer">${timelineGroupMarkers(displayedOrders)}</div>
            <div class="strategy-objective-layer">${Object.entries(objectivePositions).map(([objective, [x, y]]) => `
              <button type="button" class="strategy-objective ${activeObjectives.has(objective) ? "active" : ""}" style="left:${x}%;top:${y}%" data-map-objective="${escapeHtml(objective)}"><span>${escapeHtml(objective)}</span></button>
            `).join("")}</div>
          </div>
        </div>
        <aside class="strategy-unit-rail">
          <div class="strategy-legend-heading"><span>Unit legend</span><small>Choose a unit to inspect its orders</small></div>
          <div class="strategy-map-legend">${orders.map((order) => `<button type="button" data-map-group="${escapeHtml(order.group)}" class="${timelineSelectedGroup === order.group ? "active" : ""}"><i style="background:${tacticalGroupColor(order.group)}"></i><span><strong>${escapeHtml(order.group)}</strong><small>${order.members.length} players</small></span></button>`).join("")}</div>
          ${selectedOrder ? timelineSelectedUnitPanel(selectedOrder, phases) : `<article class="map-selection-hint panel"><strong>No units available</strong><span>Assign players to tactical units to display battle commands.</span></article>`}
        </aside>
      </div>
    ` : `<article class="panel"><p class="muted">Apply a reusable strategy template to add timed battle phases and map commands.</p></article>`}
    </div>
  `;
}

function timelineSelectedUnitPanel(order, phases) {
  const phaseRows = phases.map((phase, index) => {
    const phaseOrder = timelineGroupOrders(timelineTeam, phase, index).find((item) => item.group === order.group);
    return `<button type="button" data-timeline-phase="${index}" class="unit-phase-row ${index === timelinePhaseIndex ? "active" : ""}">
      <span>${phase.startMinute}–${phase.endMinute}</span>
      <strong>${escapeHtml(phaseOrder?.primaryAction || "Hold")} · ${escapeHtml(phaseOrder?.primaryObjective || "Officer call")}</strong>
      <small>${escapeHtml(phaseOrder?.secondaryAction || "Support")} · ${escapeHtml(phaseOrder?.secondaryObjective || "Officer call")}</small>
    </button>`;
  }).join("");
  return `<article class="map-unit-brief panel">
    <div class="selected-unit-heading"><i style="background:${tacticalGroupColor(order.group)}"></i><div><p class="eyebrow">Team ${timelineTeam} · Active unit</p><h3>${escapeHtml(order.group)}</h3></div><span>${order.members.length} players</span></div>
    <div class="selected-unit-phase"><span>Phase ${timelinePhaseIndex + 1} · ${battlePhases[timelinePhaseIndex]} min</span><p>${escapeHtml(order.goal || "Follow the active phase order.")}</p></div>
    <div class="unit-command-grid">
      <div><span>Primary command</span><strong>${escapeHtml(order.primaryAction)}</strong><small>${escapeHtml(order.primaryObjective || "Officer call")}</small></div>
      <div><span>Secondary command</span><strong>${escapeHtml(order.secondaryAction)}</strong><small>${escapeHtml(order.secondaryObjective || "Officer call")}</small></div>
    </div>
    ${state.permissions.isOfficer && timelineEditMode && state.eventStrategy?.[timelineTeam] ? timelineOrderEditor(order) : ""}
    <details class="selected-unit-members"><summary>Assigned members (${order.members.length})</summary><div class="mini-profile-list">${order.members.map((member) => memberMiniProfile(member.playerId, `${member.rosterStatus} · Team ${timelineTeam}`)).join("") || "<small>No assigned players</small>"}</div></details>
    <div class="unit-phase-breakdown"><div><strong>Full battle breakdown</strong><small>Primary and secondary command by phase</small></div>${phaseRows}</div>
  </article>`;
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
      secondaryAction: saved.secondaryAction || "Support",
      goal: saved.goal || fallback.instruction || phase.instructions || ""
    };
  });
}

function timelineOrderCard(order) {
  const isSelected = timelineSelectedGroup === order.group;
  return `<details class="strategy-unit-order ${isSelected ? "highlighted" : ""}" ${isSelected ? "open" : ""}>
    <summary class="strategy-unit-summary">
      <span class="squad-color-dot" style="background:${tacticalGroupColor(order.group)}"></span>
      <span><strong>${escapeHtml(order.group)}</strong><small>${escapeHtml(order.primaryAction)} · ${escapeHtml(order.primaryObjective || "Officer call")}</small></span>
      <em>${order.members.length} players</em>
    </summary>
    <dl class="strategy-order-details">
      <div><dt>Primary objective</dt><dd>${escapeHtml(order.primaryObjective || "Officer call")}</dd></div>
      <div><dt>Secondary objective</dt><dd>${escapeHtml(order.secondaryObjective || "Officer call")}</dd></div>
      <div><dt>Primary action</dt><dd>${escapeHtml(order.primaryAction)}</dd></div>
      <div><dt>Secondary action</dt><dd>${escapeHtml(order.secondaryAction)}</dd></div>
      <div><dt>Group goal</dt><dd>${escapeHtml(order.goal || "Follow officer direction for this interval.")}</dd></div>
    </dl>
    <div class="mini-profile-list">${order.members.length
      ? order.members.map((member) => memberMiniProfile(member.playerId, `${order.group} · Team ${timelineTeam}`)).join("")
      : "<small>No assigned members</small>"}</div>
    ${state.permissions.isOfficer && timelineEditMode && state.eventStrategy?.[timelineTeam] ? timelineOrderEditor(order) : ""}
  </details>`;
}

function handleStrategyControlsClick(event) {
  if (!event.target.closest("[data-toggle-planning-mode]")) return;
  timelineEditMode = !timelineEditMode;
  renderStrategyTimeline();
}

function timelineOrderEditor(order) {
  const objectives = ["", ...Object.keys(objectivePositions)];
  const actions = ["Secure", "Support", "Rotate", "Attack", "Contest", "Hold", "Defend"];
  return `<div class="timeline-order-editor">
    <fieldset class="command-edit-group primary"><legend>Primary command</legend>
      <label>Action<select data-strategy-group="${escapeHtml(order.group)}" data-strategy-field="primaryAction">${optionHtml(actions, order.primaryAction)}</select></label>
      <label>Objective<select data-strategy-group="${escapeHtml(order.group)}" data-strategy-field="primaryObjective">${optionHtml(objectives, order.primaryObjective)}</select></label>
    </fieldset>
    <fieldset class="command-edit-group secondary"><legend>Secondary command</legend>
      <label>Action<select data-strategy-group="${escapeHtml(order.group)}" data-strategy-field="secondaryAction">${optionHtml(actions, order.secondaryAction)}</select></label>
      <label>Objective<select data-strategy-group="${escapeHtml(order.group)}" data-strategy-field="secondaryObjective">${optionHtml(objectives, order.secondaryObjective)}</select></label>
    </fieldset>
    <label class="timeline-goal-editor">Group goal<input data-strategy-group="${escapeHtml(order.group)}" data-strategy-field="goal" maxlength="240" value="${escapeHtml(order.goal)}"></label>
    <small class="timeline-save-note">Changes save automatically to this team, unit, and battle phase.</small>
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
    return `<button type="button" class="strategy-group-marker ${timelineSelectedGroup === order.group ? "selected" : ""}" style="left:${position[0] + offset}%;top:${position[1] + offset}%;--squad-color:${tacticalGroupColor(order.group)}" data-map-group="${escapeHtml(order.group)}" title="${escapeHtml(order.group)}: ${escapeHtml(order.members.map((member) => member.playerName).join(", ") || "No assigned members")}">${escapeHtml(tacticalGroupInitial(order.group))}</button>`;
  }).join("");
}

function tacticalGroupInitial(group) {
  return { "Unit A": "A", "Unit B": "B", "Unit C": "C", "Unit D": "D", "Strike Team": "ST", "Scout + Support": "SS", "Disrupters": "DI", "Reserve": "R" }[group] || "?";
}

function tacticalGroupColor(group) {
  return {
    "Unit A": "#53c8ff",
    "Unit B": "#72e2a5",
    "Unit C": "#f0c75e",
    "Unit D": "#d58cff",
    "Strike Team": "#ff6f6f",
    "Scout + Support": "#ff9d52",
    "Disrupters": "#f06fc2",
    "Reserve": "#a6b2c1"
  }[group] || "#d7a84d";
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
    return `<span class="strategy-route team-${timelineTeam}" style="left:${from[0]}%;top:${from[1]}%;width:${Math.hypot(dx, dy)}%;transform:rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg);--route-color:${tacticalGroupColor(order.group)}" title="${escapeHtml(order.group)} movement"></span>`;
  }).join("");
}

function handleTimelineClick(event) {
  const teamButton = event.target.closest("[data-timeline-team]");
  const phaseButton = event.target.closest("[data-timeline-phase]");
  const playButton = event.target.closest("[data-timeline-play]");
  const objectiveButton = event.target.closest("[data-map-objective]");
  const groupButton = event.target.closest("[data-map-group]");
  const movementViewButton = event.target.closest("[data-movement-view]");
  if (teamButton) {
    stopTimelinePlayback();
    timelineTeam = teamButton.dataset.timelineTeam;
    timelinePhaseIndex = 0;
    timelineSelectedGroup = "";
    timelineMovementView = "all";
    renderStrategyTimeline();
  } else if (phaseButton) {
    stopTimelinePlayback();
    timelinePhaseIndex = Number(phaseButton.dataset.timelinePhase);
    timelineSelectedGroup = "";
    renderStrategyTimeline();
  } else if (playButton) {
    toggleTimelinePlayback();
  } else if (groupButton) {
    timelineSelectedGroup = groupButton.dataset.mapGroup;
    renderStrategyTimeline();
  } else if (movementViewButton) {
    timelineMovementView = movementViewButton.dataset.movementView;
    renderStrategyTimeline();
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
  if (!state?.permissions?.isAdministrator) return;
  try {
    const entries = await api.getAllAudit();
    elements.auditList.innerHTML = entries.slice(0, 200).map((entry) => `
      <article class="audit-entry panel">
        <div><strong>${escapeHtml(humanize(entry.action))}</strong><span>${escapeHtml(entry.userDisplayName)}</span></div>
        <p>${escapeHtml(entry.recordType)} · ${escapeHtml(entry.field || entry.recordId || "")}</p>
        <small>${escapeHtml(formatDateTime(entry.timestamp))}${entry.reason ? ` · ${escapeHtml(entry.reason)}` : ""}</small>
      </article>
    `).join("") || emptyState("No important changes have been recorded.");
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
  if (event.target.dataset.playerField) {
    try {
      await api.updatePlayer(event.target.dataset.memberId, { [event.target.dataset.playerField]: event.target.value });
      await refreshState();
      setStatus("Player profile updated");
    } catch (error) {
      setStatus(error.message, true);
    }
    return;
  }
  if (event.target.matches("[data-player-image]")) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus("Choose an image file", true);
      return;
    }
    setStatus("Optimizing profile picture...");
    try {
      const profileImage = await compressProfileImage(file);
      await api.updatePlayer(event.target.dataset.memberId, { profileImage });
      await refreshState();
      setStatus("Profile picture updated");
    } catch (error) {
      setStatus(error.message, true);
    }
    return;
  }
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

function renderVsScores() {
  const weeks = state.vsWeeks || [];
  if (!weeks.some((week) => week.id === selectedVsWeekId)) selectedVsWeekId = weeks[0]?.id || "";
  const week = weeks.find((item) => item.id === selectedVsWeekId);
  const duelGroup = (state.duelLeagueGroups || []).find((group) => group.id === week?.duelLeagueGroupId);
  elements.vsWeekSelect.innerHTML = weeks.map((item) =>
    `<option value="${escapeHtml(item.id)}" ${item.id === selectedVsWeekId ? "selected" : ""}>${escapeHtml(item.beginDate)} · vs ${escapeHtml(item.opponent)}</option>`
  ).join("") || `<option value="">No VS week created</option>`;
  const days = week ? vsWeekDays(week.beginDate) : [];
  if (!days.some((day) => day.date === selectedVsDate)) selectedVsDate = days[0]?.date || "";
  elements.vsDayNavigation.innerHTML = days.map((day) => {
    const dayResult = week?.dailyResults?.[day.date];
    const resultStyle = !dayResult || Number(dayResult.ourScore) === Number(dayResult.opponentScore)
      ? ""
      : Number(dayResult.ourScore) > Number(dayResult.opponentScore) ? "vs-day-win" : "vs-day-loss";
    return `<button class="${day.date === selectedVsDate ? "primary-button" : "secondary-button"} ${resultStyle}" type="button" data-vs-day="${day.date}">${day.label}<small>${day.shortDate}</small></button>`;
  }).join("");
  elements.vsScoreDate.innerHTML = days.map((day) =>
    `<option value="${day.date}" ${day.date === selectedVsDate ? "selected" : ""}>${day.label} · ${day.date}</option>`
  ).join("");
  const manualDate = elements.vsManualForm.querySelector("[name='date']");
  manualDate.value = selectedVsDate;
  elements.vsImportButton.disabled = !week;
  elements.vsManualForm.querySelector("button").disabled = !week;
  const vsScoreSaveButton = elements.vsDailyResultForm.querySelector("button");
  if (vsScoreSaveButton) vsScoreSaveButton.disabled = !week;
  elements.vsPlayerSelect.innerHTML = `<option value="">Choose roster player</option>${state.players
    .filter((player) => player.active !== false)
    .sort((left, right) => left.gameName.localeCompare(right.gameName))
    .map((player) => `<option value="${escapeHtml(player.id)}">${escapeHtml(player.gameName)} · ${escapeHtml(player.rank || "Unranked")}</option>`).join("")}`;

  const scores = (state.vsScores || []).filter((entry) =>
    week && (entry.vsWeekId === week.id || (!entry.vsWeekId && days.some((day) => day.date === entry.date)))
  );
  const dailyScores = scores.filter((entry) => entry.date === selectedVsDate);
  const byPlayer = new Map();
  for (const entry of scores) {
    const record = byPlayer.get(entry.playerId) || { name: entry.playerName, total: 0, entries: [] };
    record.total += Number(entry.score || 0);
    record.entries.push(entry);
    byPlayer.set(entry.playerId, record);
  }
  const ranking = [...byPlayer.values()].sort((left, right) => right.total - left.total || left.name.localeCompare(right.name));
  const total = scores.reduce((sum, entry) => sum + Number(entry.score || 0), 0);
  const submittedDates = [...new Set(scores.map((entry) => entry.date).filter((date) => days.some((day) => day.date === date)))];
  const weeklyDailyAverage = submittedDates.length ? Math.round(total / submittedDates.length) : 0;
  const aboveTargetCounts = submittedDates.map((date) =>
    scores.filter((entry) => entry.date === date && Number(entry.score) >= 7_200_000).length
  );
  const averageAboveTarget = aboveTargetCounts.length
    ? aboveTargetCounts.reduce((sum, count) => sum + count, 0) / aboveTargetCounts.length
    : 0;
  const result = week?.dailyResults?.[selectedVsDate] || { ourScore: 0, opponentScore: 0 };
  const published = Boolean(week?.publishedDays?.[selectedVsDate]);
  const outcome = Number(result.ourScore) === Number(result.opponentScore) ? "Pending" : Number(result.ourScore) > Number(result.opponentScore) ? "Win" : "Loss";
  const resultClass = outcome === "Win" ? "vs-win" : outcome === "Loss" ? "vs-loss" : "vs-pending";
  const weeklyTeamTotals = days.reduce((totals, day) => {
    const dailyResult = week?.dailyResults?.[day.date];
    if (!dailyResult) return totals;
    totals.ewar += Number(dailyResult.ourScore || 0);
    totals.opponent += Number(dailyResult.opponentScore || 0);
    return totals;
  }, { ewar: 0, opponent: 0 });
  elements.vsMatchupHeader.innerHTML = week ? `<article class="panel vs-matchup-header ${resultClass}">
    <div class="vs-scoreboard-context">
      <p class="eyebrow">${escapeHtml(duelGroup?.code || "Duel League")} · Week ${week.duelLeagueWeek}/4 · ${escapeHtml(days.find((day) => day.date === selectedVsDate)?.label || "")} · ${escapeHtml(selectedVsDate)}</p>
      <span>Server ${escapeHtml(week.server)} · ${week.opponentMembers} opponent members${published ? " · Published" : ""}</span>
    </div>
    <div class="vs-scoreboard-team vs-scoreboard-ewar ${outcome === "Win" ? "vs-team-leading" : outcome === "Loss" ? "vs-team-trailing" : ""}">
      <h3>EWAR</h3>
      <label>Daily team points<input name="ourScore" type="number" min="0" value="${Number(result.ourScore || 0)}" required aria-label="EWAR daily team points"></label>
      <small>Weekly total · ${weeklyTeamTotals.ewar.toLocaleString()}</small>
    </div>
    <div class="vs-scoreboard-outcome"><span>${outcome}</span><small>Highest daily score wins</small>${state.permissions.isOfficer ? `<button class="primary-button" type="submit">${published ? "Scores locked" : "Save scores"}</button>` : ""}</div>
    <div class="vs-scoreboard-team vs-scoreboard-opponent ${outcome === "Loss" ? "vs-team-leading" : outcome === "Win" ? "vs-team-trailing" : ""}">
      <h3>${escapeHtml(week.opponent || "Opponent")}</h3>
      <label>Daily team points<input name="opponentScore" type="number" min="0" value="${Number(result.opponentScore || 0)}" required aria-label="${escapeHtml(week.opponent || "Opponent")} daily team points"></label>
      <small>Weekly total · ${weeklyTeamTotals.opponent.toLocaleString()}</small>
    </div>
  </article>` : emptyState("Create a VS week in the Create tab to begin scoring.");
  elements.vsDailyResultForm.querySelector("[name='ourScore']").value = Number(result.ourScore || 0);
  elements.vsDailyResultForm.querySelector("[name='opponentScore']").value = Number(result.opponentScore || 0);
  elements.vsDailyResultForm.querySelectorAll("input, button").forEach((control) => {
    control.disabled = !week || published || !state.permissions.isOfficer;
  });
  elements.vsImportButton.disabled = !week || published;
  elements.vsManualForm.querySelectorAll("select, input, button").forEach((control) => { control.disabled = !week || published; });
  elements.vsDuelGroupReference.innerHTML = week
    ? `<p class="muted">${escapeHtml(duelGroup?.code || "")} · VS Week ${week.duelLeagueWeek}/4 standings snapshot</p>${duelRankingTable(week.standings, state.permissions.isOfficer && !published)}`
    : duelRankingTable([]);
  elements.vsStandingsImportButton.disabled = !week || published;
  elements.vsStandingsRefreshButton.disabled = !week;
  elements.vsStandingsClearButton.disabled = !week || published || !week.standings?.length;
  elements.vsStandingsPaste.disabled = !week || published;
  elements.vsStandingsFillButton.disabled = !week || published;
  elements.vsStandingsSaveButton.disabled = !week || published;
  elements.vsStandingsStatus.textContent = week?.standings?.length
    ? `${week.standings.length} alliances imported for this VS week.`
    : "No standings imported for this week.";
  elements.vsSummary.innerHTML = `
    <article class="summary-card"><span>Scoring days submitted</span><strong>${submittedDates.length}/6</strong><small>${submittedDates.length === 6 ? "Ready for day 7 finalization" : `${6 - submittedDates.length} scoring days remaining`}</small></article>
    <article class="summary-card"><span>EWAR VS weekly average</span><strong>${weeklyDailyAverage.toLocaleString()}</strong><small>Average team total per submitted day</small></article>
    <article class="summary-card"><span>Members ≥ 7,200,000</span><strong>${averageAboveTarget.toFixed(1)}</strong><small>Average number per submitted day</small></article>
    <article class="summary-card"><span>Selected day entries</span><strong>${dailyScores.length}</strong><small>${escapeHtml(days.find((day) => day.date === selectedVsDate)?.label || "")}</small></article>`;
  elements.vsTopThree.innerHTML = ranking.slice(0, 3).map((record, index) =>
    `<article><span>#${index + 1}</span><strong>${escapeHtml(record.name)}</strong><span>${record.total.toLocaleString()} total</span><small>${record.entries.length}/6 days · ${Math.round(record.total / record.entries.length).toLocaleString()} daily avg</small></article>`
  ).join("") || `<p class="muted">Top members will appear after scores are submitted.</p>`;
  const daily = [...dailyScores].sort((left, right) => Number(right.score) - Number(left.score));
  const selectedDayAverage = daily.length ? daily.reduce((sum, entry) => sum + Number(entry.score), 0) / daily.length : 0;
  const filteredDaily = selectedVsScoreFilter === "top10" ? daily.slice(0, 10)
    : selectedVsScoreFilter === "above-average" ? daily.filter((entry) => Number(entry.score) >= selectedDayAverage)
    : selectedVsScoreFilter === "below-average" ? daily.filter((entry) => Number(entry.score) < selectedDayAverage)
    : selectedVsScoreFilter === "below-target" ? daily.filter((entry) => Number(entry.score) < 7_200_000)
    : daily;
  elements.vsScoreFilter.value = selectedVsScoreFilter;
  elements.vsDailyTables.innerHTML = week ? `<section class="vs-daily-panel"><div class="assignment-heading"><h3>${escapeHtml(days.find((day) => day.date === selectedVsDate)?.label || "")} Member Scores</h3><span>${filteredDaily.length} shown · team avg ${Math.round(selectedDayAverage).toLocaleString()}</span></div>
      <div class="table-frame"><table><thead><tr><th>Daily rank</th><th>Player</th><th>Score</th><th>Source</th>${state.permissions.isOfficer ? "<th>Action</th>" : ""}</tr></thead>
      <tbody>${filteredDaily.map((entry) => `<tr><td>#${daily.indexOf(entry) + 1}</td><td>${escapeHtml(entry.playerName)}</td><td>${Number(entry.score).toLocaleString()}</td><td>${escapeHtml(entry.source)}</td>${state.permissions.isOfficer ? `<td>${published ? "Locked" : `<button class="danger-button" type="button" data-delete-vs-score="${escapeHtml(entry.id)}">Delete</button>`}</td>` : ""}</tr>`).join("") || `<tr><td colspan="${state.permissions.isOfficer ? 5 : 4}">No scores match this filter.</td></tr>`}</tbody></table></div></section>`
  : "";
}

function duelRankingTable(rankings = [], editable = false) {
  const rowCount = editable ? 16 : Math.min(16, rankings.length);
  const rows = rankings.length || editable
    ? Array.from({ length: rowCount }, (_, index) => rankings[index] || ({ rank: index + 1, alliance: "", weeks: [] }))
    : [];
  if (!rows.length) return `<div class="table-frame duel-ranking-table"><table><thead><tr><th>Ranking</th><th>Alliance</th><th>Week 1</th><th>Week 2</th><th>Week 3</th><th>Week 4</th></tr></thead><tbody>${Array.from({ length: 16 }, (_, index) => `<tr><td>#${index + 1}</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>`).join("")}</tbody></table></div>`;
  return `<div class="table-frame duel-ranking-table"><table><thead><tr><th>Ranking</th><th>Alliance</th><th>Week 1</th><th>Week 2</th><th>Week 3</th><th>Week 4</th></tr></thead>
    <tbody>${rows.map((row, rowIndex) => `<tr data-vs-standing-row><td>${editable ? `<input data-standing-rank type="number" value="${rowIndex + 1}" readonly>` : `#${rowIndex + 1}`}</td><td>${editable ? `<input data-standing-alliance value="${escapeHtml(row.alliance || "")}" placeholder="[TAG] Alliance name">` : escapeHtml(row.alliance || "—")}</td>${Array.from({ length: 4 }, (_, index) => {
      const outcome = row.weeks?.[index] || "";
      return editable
        ? `<td><select data-standing-week="${index}"><option value="">—</option><option value="W" ${outcome === "W" ? "selected" : ""}>W</option><option value="L" ${outcome === "L" ? "selected" : ""}>L</option></select></td>`
        : `<td><span class="vs-standing-result ${outcome === "W" ? "vs-standing-win" : outcome === "L" ? "vs-standing-loss" : ""}">${outcome || "—"}</span></td>`;
    }).join("")}</tr>`).join("")}</tbody></table></div>`;
}

async function importVsScreenshot() {
  const file = elements.vsScreenshotInput.files[0];
  if (!file) {
    elements.vsImportStatus.textContent = "Choose a screenshot first.";
    return;
  }
  try {
    setStatus("Reading VS screenshot...");
    elements.vsImportStatus.textContent = "Reading screenshot. This can take a moment.";
    const result = await api.importVsScreenshot(file, elements.vsScoreDate.value, selectedVsWeekId);
    state = result.state;
    render();
    elements.vsImportStatus.textContent = `${result.matches.length} scores saved. ${result.unmatched.length} need a roster match.`;
    renderVsImportMatches(result.matches, result.unmatched);
    setStatus(`Saved ${result.matches.length} VS scores`);
  } catch (error) {
    elements.vsImportStatus.textContent = error.message;
    setStatus(error.message, true);
  }
}

function renderVsImportMatches(matches, unmatched) {
  elements.vsImportMatches.innerHTML = matches.map((match) =>
    `<div class="import-match"><strong>${escapeHtml(match.name)}</strong><span>${Number(match.score).toLocaleString()}</span></div>`
  ).join("") + unmatched.map((item) => `<div class="unmatched-card">
    <div><strong>${Number(item.score).toLocaleString()}</strong><p class="muted">${escapeHtml(item.ocrName)}</p></div>
    <select><option value="">Choose roster player</option>${state.players.map((player) => `<option value="${escapeHtml(player.id)}">${escapeHtml(player.gameName)}</option>`).join("")}</select>
    <button class="secondary-button" type="button" data-vs-match-score="${Number(item.score)}">Save Match</button>
  </div>`).join("");
}

async function handleVsMatchFix(event) {
  const button = event.target.closest("[data-vs-match-score]");
  if (!button) return;
  const card = button.closest(".unmatched-card");
  const playerId = card.querySelector("select").value;
  if (!playerId) return setStatus("Choose a roster player", true);
  try {
    state = await api.saveVsScore({ playerId, date: elements.vsScoreDate.value, vsWeekId: selectedVsWeekId, score: Number(button.dataset.vsMatchScore), source: "screenshot" });
    render();
    card.remove();
    setStatus("VS match saved");
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function saveManualVsScore(event) {
  event.preventDefault();
  try {
    state = await api.saveVsScore({ ...Object.fromEntries(new FormData(event.currentTarget)), vsWeekId: selectedVsWeekId });
    const retainedDate = event.currentTarget.querySelector("[name='date']").value;
    event.currentTarget.reset();
    event.currentTarget.querySelector("[name='date']").value = retainedDate;
    render();
    setStatus("VS score saved");
  } catch (error) {
    setStatus(error.message, true);
  }
}

function vsWeekDays(beginDate) {
  const labels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return labels.map((label, offset) => {
    const date = new Date(`${beginDate}T12:00:00`);
    date.setDate(date.getDate() + offset);
    return {
      label,
      date: date.toISOString().slice(0, 10),
      shortDate: date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    };
  });
}

function handleVsWeekSelection() {
  selectedVsWeekId = elements.vsWeekSelect.value;
  selectedVsDate = "";
  renderVsScores();
}

function handleVsDaySelection(event) {
  const button = event.target.closest("[data-vs-day]");
  if (!button) return;
  selectedVsDate = button.dataset.vsDay;
  renderVsScores();
}

function handleVsImportDaySelection() {
  selectedVsDate = elements.vsScoreDate.value;
  renderVsScores();
}

async function saveVsDailyResult(event) {
  event.preventDefault();
  if (!selectedVsWeekId || !selectedVsDate) return;
  try {
    state = await api.updateVsDayResult(selectedVsWeekId, { ...Object.fromEntries(new FormData(event.currentTarget)), date: selectedVsDate });
    render();
    setStatus("Daily VS final result saved");
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function createVsWeek(event) {
  event.preventDefault();
  try {
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData);
    state = await api.createVsWeek(payload);
    selectedVsWeekId = state.vsWeeks[0]?.id || "";
    selectedVsDate = "";
    event.currentTarget.reset();
    setDefaultVsMonday();
    render();
    setStatus("New VS week created with a blank Duel League standings table");
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function importVsStandings() {
  const file = elements.vsStandingsInput.files[0];
  if (!selectedVsWeekId) return setStatus("Create or select a VS week first", true);
  if (!file) return setStatus("Choose a Duel League standings screenshot", true);
  try {
    setStatus("Reading Duel League standings...");
    const result = await api.importVsStandings(selectedVsWeekId, file);
    state = result.state;
    render();
    setStatus(`Imported ${result.standings.length} alliances${result.unmatched.length ? `; ${result.unmatched.length} OCR lines were skipped` : ""}`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function refreshVsStandings() {
  try {
    await refreshState();
    setStatus("VS standings refreshed");
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function clearVsStandings() {
  if (!selectedVsWeekId) return setStatus("Select a VS week first", true);
  if (!confirm("Clear the imported Duel League standings for this VS week?")) return;
  try {
    state = await api.clearVsStandings(selectedVsWeekId);
    elements.vsStandingsInput.value = "";
    render();
    setStatus("Imported VS standings cleared");
  } catch (error) {
    setStatus(error.message, true);
  }
}

function fillVsStandingsFromPaste() {
  const parsed = elements.vsStandingsPaste.value.split(/\r?\n/).map((line, index) => {
    const parts = line.split(/\t|,/).map((part) => part.trim()).filter((part) => part !== "");
    if (!parts.length) return null;
    const hasRank = /^\d+$/.test(parts[0]);
    const rank = hasRank ? Number(parts.shift()) : index + 1;
    const outcomes = [];
    while (parts.length && outcomes.length < 4) {
      const token = String(parts[parts.length - 1]).toUpperCase();
      if (!["W", "L", "WIN", "LOSS"].includes(token)) break;
      outcomes.unshift(token.startsWith("W") ? "W" : "L");
      parts.pop();
    }
    return { rank, alliance: parts.join(" ").trim(), weeks: outcomes };
  }).filter((row) => row?.alliance);
  const rows = [...elements.vsDuelGroupReference.querySelectorAll("[data-vs-standing-row]")];
  rows.forEach((row, index) => {
    const value = parsed[index] || { rank: index + 1, alliance: "", weeks: [] };
    row.querySelector("[data-standing-rank]").value = index + 1;
    row.querySelector("[data-standing-alliance]").value = value.alliance;
    row.querySelectorAll("[data-standing-week]").forEach((select, weekIndex) => {
      select.value = value.weeks[weekIndex] || "";
    });
  });
  setStatus(`Filled ${Math.min(parsed.length, rows.length)} standings rows. Select Save Manual Table to keep them.`);
}

async function saveManualVsStandings() {
  if (!selectedVsWeekId) return setStatus("Select a VS week first", true);
  const standings = [...elements.vsDuelGroupReference.querySelectorAll("[data-vs-standing-row]")].map((row) => ({
    rank: Number(row.querySelector("[data-standing-rank]").value || 0),
    alliance: row.querySelector("[data-standing-alliance]").value.trim(),
    weeks: [...row.querySelectorAll("[data-standing-week]")].map((select) => select.value)
  })).filter((row) => row.alliance);
  if (!standings.length) return setStatus("Enter or paste at least one alliance", true);
  try {
    state = await api.saveVsStandings(selectedVsWeekId, standings);
    render();
    setStatus(`Saved ${standings.length} manual standings rows`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function handleDuelGroupAction(event) {
  const archiveButton = event.target.closest("[data-archive-duel-group]");
  if (!archiveButton) return;
  const groupId = archiveButton.dataset.archiveDuelGroup;
  try {
    state = await api.archiveDuelLeagueGroup(groupId);
    render();
    setStatus("Duel League four-week cycle archived");
  } catch (error) {
    setStatus(error.message, true);
  }
}

function handleVsAuditSelection() {
  latestVsAudit = null;
  renderVsAuditPanel();
}

async function handleVsAuditAction(event) {
  const run = event.target.closest("[data-run-vs-audit]");
  const publish = event.target.closest("[data-publish-vs-day]");
  if (!run && !publish) return;
  const weekId = elements.vsAuditPanel.querySelector("[data-vs-audit-week]")?.value;
  const date = elements.vsAuditPanel.querySelector("[data-vs-audit-date]")?.value;
  if (!weekId || !date) return;
  try {
    if (run) {
      latestVsAudit = await api.auditVsDay(weekId, date);
      renderVsAuditPanel();
      setStatus(latestVsAudit.passed ? "VS daily audit passed" : "VS daily audit found issues", !latestVsAudit.passed);
    } else {
      state = await api.publishVsDay(weekId, date);
      latestVsAudit = { ...latestVsAudit, published: true };
      render();
      setStatus("Daily VS scores published and locked");
    }
  } catch (error) {
    setStatus(error.message, true);
  }
}

function handleDuelHistoryWeek(event) {
  const select = event.target.closest("[data-history-duel-week]");
  if (!select) return;
  const card = select.closest("[data-duel-history-group]");
  card.querySelectorAll("[data-history-week-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.historyWeekPanel !== select.value;
  });
}

async function handleVsWeekDelete(event) {
  const button = event.target.closest("[data-delete-vs-week]");
  if (!button || !confirm("Delete this VS week and all of its linked player scores?")) return;
  try {
    state = await api.deleteVsWeek(button.dataset.deleteVsWeek);
    selectedVsWeekId = "";
    selectedVsDate = "";
    render();
    setStatus("VS week deleted");
  } catch (error) {
    setStatus(error.message, true);
  }
}

function setDefaultVsMonday() {
  const input = elements.vsWeekForm?.querySelector("[name='beginDate']");
  if (!input || input.value) return;
  const date = new Date();
  const daysUntilMonday = (8 - date.getDay()) % 7 || 7;
  date.setDate(date.getDate() + daysUntilMonday);
  input.value = date.toISOString().slice(0, 10);
}

async function handleVsScoreDelete(event) {
  const button = event.target.closest("[data-delete-vs-score]");
  if (!button || !confirm("Delete this daily VS score?")) return;
  try {
    state = await api.deleteVsScore(button.dataset.deleteVsScore);
    render();
    setStatus("VS score deleted");
  } catch (error) {
    setStatus(error.message, true);
  }
}

function directoryRow(member) {
  const history = playerHistory(member.id);
  const expanded = expandedPlayers.has(member.id);
  const rosterLocked = !state.activeEvent?.setupPublishedAt;
  const locked = rosterLocked ? "disabled title=\"Publish the DS setup in Create to unlock this roster\"" : "";
  return `
    <tr class="roster-member-row team-${escapeHtml(member.team)} ${member.selected ? "selected" : ""}">
      <td data-label="Selected"><input data-member-id="${member.id}" data-field="selected" type="checkbox" ${member.selected ? "checked" : ""} ${locked}></td>
      <td data-label="Player">
        ${memberMiniProfile(member, `${member.rank} · Team ${member.team}`)}
        ${member.availabilityGuidance ? `<small class="availability-guidance">Availability: ${escapeHtml(member.availabilityGuidance)}</small>` : ""}
        <div class="roster-player-actions">
          <button class="row-expander" type="button" data-expand-player="${member.id}" aria-expanded="${expanded}">${expanded ? "Close history" : `${history.length} DS records`}</button>
          <details class="roster-profile-tools">
            <summary>Profile tools</summary>
            <div>
              <label>In-game name<input class="directory-name-input" data-member-id="${member.id}" data-player-field="gameName" value="${escapeHtml(member.name)}"></label>
              <label class="profile-image-picker">Replace picture<input data-member-id="${member.id}" data-player-image type="file" accept="image/*"></label>
              ${state.permissions.isAdministrator ? `<button class="delete-member-button" type="button" data-delete-player="${member.id}">Delete profile</button>` : ""}
            </div>
          </details>
        </div>
      </td>
      <td data-label="Rank"><span class="roster-rank-badge rank-${escapeHtml(member.rank)}">${escapeHtml(member.rank)}</span></td>
      <td data-label="Team"><select data-member-id="${member.id}" data-field="team" ${locked}>${optionHtml(["Reserve", "A", "B"], member.team)}</select></td>
      <td data-label="Role"><select data-member-id="${member.id}" data-field="type" ${locked}>${optionHtml(["Starter", "Sub"], member.type)}</select></td>
      <td data-label="Unit"><select data-member-id="${member.id}" data-field="tacticalGroup" ${locked}>${optionHtml(tacticalGroups, member.tacticalGroup || "Reserve")}</select></td>
      <td data-label="Structure focus"><select data-member-id="${member.id}" data-field="unit" ${locked}>${optionHtml(units, assignedUnit(member))}</select></td>
      <td data-label="In-game signup"><select data-member-id="${member.id}" data-field="availability" ${locked}>
        <option value="Pending" ${member.availability !== "Confirmed" ? "selected" : ""}>Not confirmed</option>
        <option value="Confirmed" ${member.availability === "Confirmed" ? "selected" : ""}>Confirmed in game</option>
      </select></td>
      <td data-label="Leader"><input data-member-id="${member.id}" data-field="unitLeader" type="checkbox" ${member.unitLeader ? "checked" : ""} aria-label="Optional unit or team leader" ${locked}></td>
    </tr>
    ${expanded ? playerHistoryRow(member, history) : ""}
  `;
}

function handleDirectoryClick(event) {
  const deleteButton = event.target.closest("[data-delete-player]");
  if (deleteButton) {
    deletePlayerProfile(deleteButton.dataset.deletePlayer);
    return;
  }
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

async function deletePlayerProfile(playerId) {
  const player = state.players.find((item) => item.id === playerId);
  if (!player || !confirm(`Delete ${player.gameName} from the database? Their archived battle records will be retained.`)) return;
  try {
    await api.deletePlayer(playerId);
    await refreshState();
    setStatus("Player deleted");
  } catch (error) {
    setStatus(error.message, true);
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function compressProfileImage(file) {
  const bitmap = await createImageBitmap(file);
  const maxDimension = 900;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  for (const quality of [0.86, 0.76, 0.66, 0.56]) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && (blob.size <= 600000 || quality === 0.56)) return fileToDataUrl(blob);
  }
  throw new Error("The selected picture could not be optimized");
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
    <article class="panel readiness-panel ${data.score >= 75 ? "ready" : data.score >= 45 ? "forming" : "attention"}">
      <div class="panel-heading">
        <h3><i class="readiness-live-dot"></i>Team ${team} Readiness</h3>
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
      ${members.map((member) => memberMiniProfile(member, `${assignedUnit(member)} · ${member.availability}`)).join("") || `<p class="muted">None assigned</p>`}
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

function serverToLocal(date, time) {
  if (!date || !time) return "Not scheduled";
  const [hour, minute] = String(time).split(":").map(Number);
  const utc = new Date(`${date}T${String(hour || 0).padStart(2, "0")}:${String(minute || 0).padStart(2, "0")}:00Z`);
  return Number.isNaN(utc.getTime())
    ? "Not scheduled"
    : utc.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
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
