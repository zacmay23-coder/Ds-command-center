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
const expandedPlayers = new Set();
let liveSource = null;

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  requireSession();
  bindNavigation();
  bindControls();
  fillStrategySelects();
  await refreshState();
  if (!state?.me?.profileConfirmedAt) {
    window.location.href = "/profile-link.html";
    return;
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
  });
}

function bindControls() {
  document.querySelector("#refreshButton").addEventListener("click", refreshState);
  document.querySelector("#logoutButton").addEventListener("click", logout);
  document.querySelector("#profileTabButton").addEventListener("click", () => showView("userProfile"));
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
  elements.publishDsSetupButton.addEventListener("click", publishDsSetup);
  elements.announcementForm.addEventListener("submit", postAnnouncement);
  elements.announcementList.addEventListener("click", handleAnnouncementClick);
  elements.allianceEventForm.addEventListener("submit", handleAllianceEventSubmit);
  elements.allianceEventList.addEventListener("click", handleAllianceEventClick);
  elements.themeWeekForm.addEventListener("submit", handleThemeWeekCreate);
  elements.themeWeekContent.addEventListener("click", handleThemeWeekClick);
  elements.themeWeekContent.addEventListener("change", handleThemeScreenshotChange);
  elements.themeHistoryList.addEventListener("click", handleThemeWeekClick);
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
}

function showView(viewId) {
  document.querySelectorAll(".sidebar button").forEach((item) => item.classList.remove("active"));
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  document.querySelector(`#${viewId}`)?.classList.add("active");
}

function render() {
  applyRoleVisibility();
  syncStrategySelects();
  renderEventBanner();
  renderUserProfile();
  renderHeaderProfile();
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
    const memberViews = ["myAssignment", "dashboard", "events", "allianceWeeklyEvents", "themeWeek", "history", "strategyTimeline", "userProfile"];
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
        <p class="eyebrow">${escapeHtml(user.role)} account</p>
        <h3>${escapeHtml(player.gameName)}</h3>
        <div class="profile-facts">
          ${detail("Email", user.email)}
          ${detail("Rank", player.rank || "Not set")}
          ${detail("Team", participant?.team || player.defaultTeam || "Reserve")}
          ${detail("Unit", participant?.tacticalGroup || player.defaultTacticalGroup || "Reserve")}
          ${detail("Structure focus", participant?.unit || player.defaultUnit || "Unassigned")}
          ${detail("Profile link", user.profileConfirmedAt ? "Confirmed" : "Confirmation required")}
        </div>
        <label>Member title<input name="profileTitle" maxlength="60" value="${escapeHtml(user.profileTitle || "Alliance Member")}"></label>
        <label>Member bio<textarea name="profileBio" maxlength="400" placeholder="Add a short alliance or battle profile.">${escapeHtml(user.profileBio || "")}</textarea></label>
        <div class="profile-image-settings">
          <label>Picture fit<select name="profileImageFit">${optionHtml(["cover", "contain"], player.profileImageFit || "cover")}</select></label>
          <label>Picture position<select name="profileImagePosition">${optionHtml(["center", "top", "bottom", "left", "right"], player.profileImagePosition || "center")}</select></label>
        </div>
        <button class="primary-button" type="submit">Save My Profile</button>
      </form>
    </article>
  `;
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
  elements.headerProfileLabel.textContent = player?.gameName || "My Profile";
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
    <div><p class="eyebrow">${escapeHtml(formatDateTime(announcement.createdAt))}</p><h3>${escapeHtml(announcement.title)}</h3><p>${escapeHtml(announcement.summary)}</p></div>
    ${announcement.attachment ? (announcement.attachment.startsWith("data:image/") ? `<img src="${announcement.attachment}" alt="">` : `<a class="secondary-button" href="${announcement.attachment}" download="${escapeHtml(announcement.attachmentName || "attachment")}">Download attachment</a>`) : ""}
    ${state.permissions.isOfficer ? `<button class="danger-button" type="button" data-delete-announcement="${escapeHtml(announcement.id)}">Delete</button>` : ""}
  </article>`).join("") || emptyState("No Ewar announcements posted.");
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
  const button = event.target.closest("[data-delete-announcement]");
  if (!button || !confirm("Delete this announcement?")) return;
  try { await api.deleteAnnouncement(button.dataset.deleteAnnouncement); await refreshState(); }
  catch (error) { setStatus(error.message, true); }
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
  const teamOrder = { A: 0, B: 1, Reserve: 2 };
  members.sort((left, right) =>
    (teamOrder[left.team] ?? 9) - (teamOrder[right.team] ?? 9)
    || Number(String(left.rank).replace(/\D/g, "")) - Number(String(right.rank).replace(/\D/g, ""))
    || left.name.localeCompare(right.name)
  );
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
  elements.directoryRows.innerHTML = `${lockRow}${rows || `<tr><td colspan="9">No members match this view.</td></tr>`}`;
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
    const ranked = finalists.map((id) => ({ id, entry: theme.submissions[id], votes: theme.tally?.[id] || 0 }))
      .filter((item) => item.entry).sort((left, right) => right.votes - left.votes);
    return `<article class="panel theme-week-card">
      <div class="assignment-profile-heading"><div><p class="eyebrow">${escapeHtml(theme.weekOf)} · ${escapeHtml(theme.status)}</p><h3>${escapeHtml(theme.title)}</h3></div>${statusBadge(theme.status)}</div>
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
      <div class="theme-submission-grid">${entries.map((entry) => `<article class="theme-entry">
        ${memberMiniProfile({ id: entry.playerId, name: entry.playerName, profileImage: entry.profileImage }, "Theme submission")}
        ${entry.image ? `<img src="${entry.image}" alt="${escapeHtml(entry.playerName)} submission">` : ""}
        <p>${escapeHtml(entry.text)}</p>
        ${false ? `<label class="finalist-toggle"><input type="checkbox" data-theme-finalist="${escapeHtml(theme.id)}" value="${escapeHtml(entry.playerId)}" ${finalists.includes(entry.playerId) ? "checked" : ""}> Finalist</label>` : ""}
        ${theme.status === "voting" && finalists.includes(entry.playerId) ? `<button class="${theme.myVote === entry.playerId ? "primary-button" : "secondary-button"}" type="button" data-theme-vote="${escapeHtml(theme.id)}" data-finalist="${escapeHtml(entry.playerId)}">${theme.myVote === entry.playerId ? "Your vote" : "Vote"} · ${theme.tally?.[entry.playerId] || 0}</button>` : ""}
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
      ${ranked.length ? `<div class="theme-results"><h4>Results</h4>${ranked.slice(0, 3).map((item, index) => `<p><strong>${index + 1}${index === 0 ? "st" : index === 1 ? "nd" : "rd"} · ${escapeHtml(item.entry.playerName)}</strong> — ${item.votes} vote${item.votes === 1 ? "" : "s"}</p>`).join("")}</div>` : ""}
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

  elements.createdThemeManagement.innerHTML = (state.themeWeeks || []).map((theme) => `<article class="panel compact-management-card">
    <div data-theme-display="${escapeHtml(theme.id)}"><h4>${escapeHtml(theme.title)} · ${escapeHtml(theme.weekOf)}</h4><p>${escapeHtml(theme.description)}</p></div>
    <form class="inline-edit-form" data-theme-edit-form="${escapeHtml(theme.id)}" hidden>
      <label>Title<input name="title" value="${escapeHtml(theme.title)}"></label><label>Week<input name="weekOf" type="date" value="${escapeHtml(theme.weekOf)}"></label>
      <label class="wide-field">Description<textarea name="description">${escapeHtml(theme.description)}</textarea></label><label class="wide-field">Rules<textarea name="rules">${escapeHtml(theme.rules)}</textarea></label>
    </form>
    <div class="compact-finalist-picker">${Object.values(theme.submissions || {}).map((entry) => `<label>${memberMiniProfile(entry.playerId, "Submission")}<input type="checkbox" data-theme-finalist="${escapeHtml(theme.id)}" value="${escapeHtml(entry.playerId)}" ${(theme.finalistIds || []).includes(entry.playerId) ? "checked" : ""}> Finalist</label>`).join("") || `<p class="muted">No submissions available for finalist selection.</p>`}</div>
    <div class="record-actions"><button class="secondary-button" data-edit-theme="${escapeHtml(theme.id)}" type="button">Edit</button><button class="primary-button" data-save-theme="${escapeHtml(theme.id)}" type="button" hidden>Save</button><button class="secondary-button" data-cancel-theme="${escapeHtml(theme.id)}" type="button" hidden>Cancel</button><button class="secondary-button" data-theme-status="${escapeHtml(theme.id)}" data-status="voting" type="button">Open voting</button><button class="primary-button" data-theme-status="${escapeHtml(theme.id)}" data-status="archived" type="button">Close vote &amp; finalize</button><button class="danger-button" data-delete-theme="${escapeHtml(theme.id)}" type="button">Delete</button></div>
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
      secondaryAction: saved.secondaryAction || "Support",
      goal: saved.goal || fallback.instruction || phase.instructions || ""
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
      <div><dt>Group goal</dt><dd>${escapeHtml(order.goal || "Follow officer direction for this interval.")}</dd></div>
    </dl>
    <div class="mini-profile-list">${order.members.length
      ? order.members.map((member) => memberMiniProfile(member.playerId, `${order.group} · Team ${timelineTeam}`)).join("")
      : "<small>No assigned members</small>"}</div>
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
    <label class="timeline-goal-editor">Group goal<input data-strategy-group="${escapeHtml(order.group)}" data-strategy-field="goal" maxlength="240" value="${escapeHtml(order.goal)}"></label>
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
  return { "Unit A": "A", "Unit B": "B", "Unit C": "C", "Unit D": "D", "Strike Team": "ST", "Scout + Support": "SS", "Disrupters": "DI", "Reserve": "R" }[group] || "?";
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

function directoryRow(member) {
  const history = playerHistory(member.id);
  const expanded = expandedPlayers.has(member.id);
  const rosterLocked = !state.activeEvent?.setupPublishedAt;
  const locked = rosterLocked ? "disabled title=\"Publish the DS setup in Create to unlock this roster\"" : "";
  return `
    <tr>
      <td data-label="Selected"><input data-member-id="${member.id}" data-field="selected" type="checkbox" ${member.selected ? "checked" : ""} ${locked}></td>
      <td data-label="Player">
        ${memberMiniProfile(member, `${member.rank} · Team ${member.team}`)}
        ${member.availabilityGuidance ? `<small class="availability-guidance">Availability: ${escapeHtml(member.availabilityGuidance)}</small>` : ""}
        <button class="row-expander" type="button" data-expand-player="${member.id}" aria-expanded="${expanded}">${expanded ? "Hide" : "Show"}</button>
        <input class="directory-name-input" data-member-id="${member.id}" data-player-field="gameName" value="${escapeHtml(member.name)}" aria-label="In-game name">
        <label class="profile-image-picker">Picture<input data-member-id="${member.id}" data-player-image type="file" accept="image/*"></label>
        ${state.permissions.isAdministrator ? `<button class="delete-member-button" type="button" data-delete-player="${member.id}">Delete</button>` : ""}
        <span class="history-count">${history.length} DS</span>
      </td>
      <td data-label="Rank">${escapeHtml(member.rank)}</td>
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
