import { clearSession, liveUpdatesUrl, requireSession } from "./auth.js";
import { api } from "./api.js";
import { battlePhases, objectivePositions, strategyPlans, tacticalGroups } from "./battle-plan.js";
import { chooseBriefingPriority } from "./briefing-priority.js";

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
let selectedGoalTab = "today";
let timelineTeam = "A";
let timelinePhaseIndex = 0;
let timelinePlaybackTimer = null;
let timelineSelectedGroup = "";
let timelineEditMode = false;
let timelineMovementView = "all";
let timelineSelectedObjective = "";
let selectedVsWeekId = "";
let selectedVsDate = "";
let selectedVsScoreFilter = "all";
let latestVsAudit = null;
let selectedEventFilter = "all";
let selectedSeasonBattleId = "";
let seasonBattleTool = "select";
let selectedSeasonObjectId = "";
let seasonBattleDraft = null;
const seasonBattleUndo = [];
const seasonBattleRedo = [];
let seasonBattleDrag = null;
let seasonBattleSuppressClick = false;
let seasonBattleZoom = 1;
const rosterStore = { membersById: new Map(), orderedMemberIds: [], viewModel: null, loaded: false, updatedAt: null };
const rosterSelectorState = { selectedMemberIds: new Set(), config: null };
const eventRosterConfig = {
  desert_storm: { teamOptions: ["A", "B", "Reserve"], participationTypes: ["Starter", "Sub", "Reserve"], capacityByTeam: { A: { maximumSignUps: 30, starters: 20, substitutes: 10 }, B: { maximumSignUps: 30, starters: 20, substitutes: 10 } } },
  theme_week: { teamOptions: [], participationTypes: ["Participant"], capacityByTeam: {} },
  alliance_event: { teamOptions: [], participationTypes: ["Participant", "Reserve"], capacityByTeam: {} }
};

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
  eventTypeSelector: document.querySelector("#eventTypeSelector"),
  eventsHubContent: document.querySelector("#eventsHubContent"),
  rosterSelectorDialog: document.querySelector("#rosterSelectorDialog"),
  rosterSelectorForm: document.querySelector("#rosterSelectorForm"),
  rosterSelectorCandidates: document.querySelector("#rosterSelectorCandidates"),
  rosterSelectionSummary: document.querySelector("#rosterSelectionSummary"),
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
  rosterReviewAlerts: document.querySelector("#rosterReviewAlerts"),
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
elements.activateDsButton = document.querySelector("#activateDsButton");
elements.battlePlanningOverview = document.querySelector("#battlePlanningOverview");
elements.seasonBattleWorkspace = document.querySelector("#seasonBattleWorkspace");
elements.seasonBattleCreateForm = document.querySelector("#seasonBattleCreateForm");
elements.announcementForm = document.querySelector("#announcementForm");
elements.announcementList = document.querySelector("#announcementList");
elements.privateMessageForm = document.querySelector("#privateMessageForm");
elements.privateMessageRecipient = document.querySelector("#privateMessageRecipient");
elements.privateMessageList = document.querySelector("#privateMessageList");
elements.dailyChatForm = document.querySelector("#dailyChatForm");
elements.dailyChatList = document.querySelector("#dailyChatList");
elements.dailyChatDate = document.querySelector("#dailyChatDate");
elements.dailyChatHistoryDate = document.querySelector("#dailyChatHistoryDate");
elements.allianceCelebrationsList = document.querySelector("#allianceCelebrationsList");
elements.journalForm = document.querySelector("#journalForm");
elements.journalEntries = document.querySelector("#journalEntries");
elements.journalTabButton = document.querySelector("#journalTabButton");
elements.planVsWeekButton = document.querySelector("#planVsWeekButton");
elements.leadership = document.querySelector("#leadership");
elements.goalForm = document.querySelector("#goalForm");
elements.journalSearch = document.querySelector("#journalSearch");
elements.journalTypeFilter = document.querySelector("#journalTypeFilter");
elements.journalDateFilter = document.querySelector("#journalDateFilter");
elements.journalStateFilter = document.querySelector("#journalStateFilter");
elements.journalGoalLinks = document.querySelector("#journalGoalLinks");
elements.goalJournalLink = document.querySelector("#goalJournalLink");
elements.allGoalList = document.querySelector("#allGoalList");
elements.achievementSettingsForm = document.querySelector("#achievementSettingsForm");
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
    const params = new URLSearchParams(window.location.search);
    const requestedView = params.get("view");
    const requestedButton = requestedView && document.querySelector(`.sidebar button[data-view="${requestedView}"]`);
    const requestedPanel = requestedView && document.querySelector(`#${requestedView}`);
    if (requestedButton && requestedPanel && !requestedButton.hidden) showView(requestedView);
    else if (state.me.role === "member") showView("myAssignment");
    if (requestedView === "events") {
      selectedEventFilter = { ds: "ds", theme: "theme", alliance: "alliance", vs: "vs", all: "all" }[params.get("tab") || "all"] || "all";
      showView("events");
      renderEvents();
    }
  }
  connectLiveUpdates();
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
  const navigation = document.querySelector("#primaryNavigation");
  const navigationToggle = document.querySelector("#navigationToggle");
  navigationToggle.addEventListener("click", () => {
    const open = navigation.classList.toggle("open");
    navigationToggle.setAttribute("aria-expanded", String(open));
  });
  document.querySelector(".sidebar").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-view]");
    if (!button) return;

    document.querySelectorAll(".sidebar button").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
    button.classList.add("active");
    document.querySelector(`#${button.dataset.view}`).classList.add("active");
    history.replaceState(null, "", `?view=${encodeURIComponent(button.dataset.view)}`);
    navigation.classList.remove("open");
    navigationToggle.setAttribute("aria-expanded", "false");
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
  elements.journalSearch.addEventListener("input", renderJournal);
  elements.journalTypeFilter.addEventListener("change", renderJournal);
  elements.journalDateFilter.addEventListener("change", renderJournal);
  elements.journalStateFilter.addEventListener("change", renderJournal);
  elements.goalForm.addEventListener("submit", saveGoal);
  elements.allGoalList.addEventListener("click", handleGoalClick);
  elements.goalForm.addEventListener("reset", () => window.setTimeout(() => { elements.goalForm.elements.id.value = ""; }));
  elements.myAssignmentContent.addEventListener("click", handleGoalClick);
  elements.myAssignmentContent.addEventListener("click", handleAchievementClick);
  elements.myAssignmentContent.addEventListener("click", handleBriefingMessageClick);
  elements.leadership.addEventListener("submit", handleLeadershipSubmit);
  elements.leadership.addEventListener("click", handleLeadershipClick);
  elements.searchInput.addEventListener("input", renderDirectory);
  elements.filterInput.addEventListener("change", renderDirectory);
  elements.rankSort.addEventListener("change", renderDirectory);
  elements.directoryTeamFilter.addEventListener("change", renderDirectory);
  elements.directoryRows.addEventListener("change", handleMemberChange);
  elements.directoryRows.addEventListener("click", handleDirectoryClick);
  elements.memberProfileDialog.addEventListener("change", handleMemberChange);
  document.body.addEventListener("click", handleRosterSelectorOpen);
  elements.rosterSelectorDialog.addEventListener("click", handleRosterSelectorClick);
  elements.rosterSelectorForm.addEventListener("input", renderRosterSelector);
  elements.rosterSelectorForm.addEventListener("change", renderRosterSelector);
  elements.rosterSelectorForm.addEventListener("submit", assignSelectedRosterMembers);
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
  elements.eventTypeSelector.addEventListener("click", handleEventHubClick);
  elements.eventsHubContent.addEventListener("click", handleEventHubClick);
  elements.participationTeam.addEventListener("change", renderParticipation);
  elements.participationUnit.addEventListener("change", renderParticipation);
  elements.myAssignmentContent.addEventListener("click", handleAvailabilityClick);
  elements.myAssignmentContent.addEventListener("click", (event) => {
    const shortcut = event.target.closest("[data-briefing-scroll]");
    if (!shortcut) return;
    elements.myAssignmentContent.querySelector(`[data-briefing-section="${CSS.escape(shortcut.dataset.briefingScroll)}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  elements.myAssignmentContent.addEventListener("click", handleAvailabilityPrompt);
  elements.myAssignmentContent.addEventListener("click", handleThemeWeekClick);
  elements.myAssignmentContent.addEventListener("change", handleAvailabilityNote);
  elements.strategyControls.addEventListener("change", handleStrategyApply);
  elements.strategyControls.addEventListener("click", handleStrategyControlsClick);
  elements.strategyTimelineContent.addEventListener("click", handleTimelineClick);
  elements.strategyTimelineContent.addEventListener("change", handleTimelineChange);
  elements.userList.addEventListener("change", handleUserChange);
  elements.userList.addEventListener("submit", handleAdminAccountSave);
  document.querySelector("#adminAccountSearch")?.addEventListener("input", renderAdministration);
  elements.customStrategyForm.addEventListener("submit", createCustomStrategy);
  elements.strategyLibraryCards.addEventListener("click", handleStrategyLibraryClick);
  elements.userProfileContent.addEventListener("submit", handleOwnProfileSave);
  elements.userProfileContent.addEventListener("submit", handleProfileMessageSubmit);
  elements.userProfileContent.addEventListener("change", handleOwnProfileImage);
  elements.userProfileContent.addEventListener("click", handleOwnProfileClick);
  elements.userProfileContent.addEventListener("click", handleBriefingMessageClick);
  document.body.addEventListener("click", handleMiniProfileClick);
  document.body.addEventListener("click", handleEventSubviewClick);
  document.body.addEventListener("click", handleNestedSubviewClick);
  document.body.addEventListener("click", handleWorkflowNavigation);
  document.body.addEventListener("change", handleWorkflowFieldSync);
  elements.myAssignmentContent.addEventListener("submit", handleBriefingAction);
  elements.createdDsManagement.addEventListener("click", handleEventAction);
  elements.createdDsManagement.addEventListener("click", handleEventListClick);
  elements.createdDsManagement.addEventListener("change", handleEventFieldChange);
  elements.createdAllianceManagement.addEventListener("click", handleAllianceEventClick);
  elements.createdThemeManagement.addEventListener("click", handleThemeWeekClick);
  elements.createdThemeManagement.addEventListener("submit", handleOfficerThemeSubmission);
  elements.publishDsSetupButton.addEventListener("click", publishDsSetup);
  elements.activateDsButton.addEventListener("click", activateDsEvent);
  elements.seasonBattleCreateForm.addEventListener("submit", createSeasonBattlePlan);
  elements.seasonBattleWorkspace.addEventListener("click", handleSeasonBattleClick);
  elements.seasonBattleWorkspace.addEventListener("submit", handleSeasonBattleSubmit);
  elements.seasonBattleWorkspace.addEventListener("change", handleSeasonBattleChange);
  elements.seasonBattleWorkspace.addEventListener("keydown", handleSeasonBattleKeydown);
  elements.seasonBattleWorkspace.addEventListener("pointerdown", handleSeasonBattlePointerDown);
  elements.seasonBattleWorkspace.addEventListener("pointerup", handleSeasonBattlePointerUp);
  elements.announcementForm.addEventListener("submit", postAnnouncement);
  elements.announcementList.addEventListener("click", handleAnnouncementClick);
  elements.announcementList.addEventListener("submit", handleAnnouncementEditSubmit);
  elements.privateMessageForm?.addEventListener("submit", handlePrivateMessageSubmit);
  elements.dailyChatForm.addEventListener("submit", handleDailyChatSubmit);
  elements.dailyChatHistoryDate?.addEventListener("change", renderDashboardChat);
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
  document.querySelector("#sanitizeTextDryRun")?.addEventListener("click", () => runTextSanitization(true));
  document.querySelector("#sanitizeTextApply")?.addEventListener("click", () => runTextSanitization(false));
  elements.achievementSettingsForm?.addEventListener("submit", saveAchievementSettings);
  elements.achievementSettingsForm?.querySelector("[data-achievement-dry-run]")?.addEventListener("click", previewAchievementTrigger);
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
  buildMasterRosterViewModel(true);
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
  renderBattlePlanningOverview();
  renderSeasonBattles();
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
  const tab = { events: "ds", themeWeek: "theme", allianceWeeklyEvents: "alliance", vsEvents: "vs" }[button.dataset.eventSubview];
  history.replaceState(null, "", `?view=events&tab=${tab}`);
}

async function runTextSanitization(dryRun) {
  if (!dryRun && !window.confirm("Clean malformed control characters from legacy text records? This action will be audited.")) return;
  const status = document.querySelector("#sanitizeTextStatus");
  status.textContent = dryRun ? "Scanning records…" : "Cleaning affected records…";
  try {
    const result = await api.sanitizeLegacyText(dryRun);
    status.textContent = `${result.changedValues} affected text values across ${result.affectedRecords} records${dryRun ? " found. No data changed." : " cleaned."}`;
    if (!dryRun) await refreshState();
  } catch (error) {
    status.textContent = error.message;
  }
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
  const officerOnlyViews = ["teams", "assignmentsA", "assignmentsB", "results"];
  document.querySelectorAll(".sidebar button").forEach((button) => {
    if (officerOnlyViews.includes(button.dataset.view)) button.hidden = !state.permissions.isOfficer;
  });
  if (state.permissions.isMember) {
    const activeView = document.querySelector(".view.active")?.id;
    const memberViews = ["myAssignment", "dashboard", "events", "directory", "allianceWeeklyEvents", "themeWeek", "history", "strategyTimeline", "userProfile", "playerJournal"];
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
        <label>Current in-game name<input name="gameName" maxlength="80" value="${escapeHtml(player.gameName)}" required></label>
        <div class="profile-thp-editor"><label>Current THP<input name="thp" type="number" min="0" max="1000000000000000" step="1" value="${Number(player.thp || 0)}" required></label><p><strong>${escapeHtml(formatThp(player.thp))}</strong><small>${player.thpUpdatedAt ? `Last updated ${escapeHtml(formatDateTime(player.thpUpdatedAt))}${player.thpVerifiedAt ? " · Verified" : ""}` : "THP has not been updated."}</small></p></div>
        <label>Member title<input name="profileTitle" maxlength="60" value="${escapeHtml(user.profileTitle || "Alliance Member")}" required></label>
        <label>Member description<textarea name="profileBio" maxlength="400" placeholder="Add a short alliance or battle profile." required>${escapeHtml(user.profileBio || "")}</textarea></label>
        <button class="primary-button" type="submit">Save Profile and THP</button>
      </form>
    </article>
    <section class="panel profile-messages" aria-labelledby="myMessagesTitle"><div class="assignment-heading"><div><p class="eyebrow">Private conversations</p><h3 id="myMessagesTitle">My Messages</h3></div><span>${(state.privateMessages || []).filter((message) => message.direction === "received" && !message.readAtByRecipient).length} unread</span></div><form data-profile-message-form><label>Member<select name="recipientUid" data-profile-message-recipient required><option value="">Choose a registered member</option>${(state.messageRecipients || []).map((member) => `<option value="${escapeHtml(member.uid)}" data-player-id="${escapeHtml(member.playerId)}">${escapeHtml(member.name)}</option>`).join("")}</select></label><label>Message<textarea name="text" maxlength="1000" required></textarea></label><button class="primary-button" type="submit">Send Private Message</button></form><div class="profile-message-list">${[...(state.privateMessages || [])].reverse().map((message) => `<article class="profile-message ${escapeHtml(message.direction)}"><div><strong>${message.direction === "sent" ? `To ${escapeHtml(message.recipientName)}` : `From ${escapeHtml(message.senderName)}`}</strong><small>${escapeHtml(formatDateTime(message.createdAt))}</small></div><p>${escapeHtml(message.text)}</p>${message.direction === "received" && !message.readAtByRecipient ? `<button class="secondary-button" type="button" data-read-message="${escapeHtml(message.id)}">Mark Read</button>` : ""}</article>`).join("") || `<p class="muted">No private messages yet.</p>`}</div></section>
  `;
}

async function handleProfileMessageSubmit(event) {
  const form = event.target.closest("[data-profile-message-form]");
  if (!form) return;
  event.preventDefault();
  const submit = form.querySelector("[type='submit']");
  try {
    submit.disabled = true;
    const payload = Object.fromEntries(new FormData(form));
    await api.sendPrivateMessage(payload);
    form.reset();
    await refreshState();
    showView("userProfile");
    setStatus("Private message sent");
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    submit.disabled = false;
  }
}

function handleWorkflowNavigation(event) {
  const shortcut = event.target.closest("[data-view-shortcut]");
  if (shortcut) {
    const viewTarget = shortcut.dataset.viewShortcut === "createManagement" ? "create" : shortcut.dataset.viewShortcut;
    showView(viewTarget);
    history.replaceState(null, "", `?view=${encodeURIComponent(viewTarget)}`);
    return;
  }

  const trigger = event.target.closest("[data-workflow-tab], [data-workflow-next]");
  if (!trigger) return;
  const targetId = trigger.dataset.workflowTab || trigger.dataset.workflowNext;
  const target = document.querySelector(`[data-workflow-panel="${CSS.escape(targetId)}"]`);
  if (!target) return;
  const scope = targetId.startsWith("vs-") ? "vs-" : "result-";
  document.querySelectorAll(`[data-workflow-panel^="${scope}"]`).forEach((panel) => panel.classList.remove("active"));
  document.querySelectorAll(`[data-workflow-tab^="${scope}"]`).forEach((button) => {
    const selected = button.dataset.workflowTab === targetId;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-selected", String(selected));
    button.closest("li")?.classList.toggle("active", selected);
  });
  target.classList.add("active");
}

function handleWorkflowFieldSync(event) {
  if (!event.target.matches("[data-result-team-proxy]")) return;
  elements.screenshotTeam.value = event.target.value;
}

function renderJournal() {
  const search = elements.journalSearch.value.trim().toLowerCase();
  const typeFilter = elements.journalTypeFilter.value;
  const dateFilter = elements.journalDateFilter.value;
  const stateFilter = elements.journalStateFilter.value;
  const entries = (state.myJournal || []).filter((entry) => {
    if (typeFilter && entry.entryType !== typeFilter) return false;
    if (dateFilter && String(entry.createdAt || "").slice(0, 10) !== dateFilter) return false;
    if (stateFilter === "active" && entry.archivedAt) return false;
    if (stateFilter === "archived" && !entry.archivedAt) return false;
    if (stateFilter === "pinned" && (!entry.isPinned || entry.archivedAt)) return false;
    const haystack = `${entry.title} ${entry.body} ${(entry.tags || []).join(" ")}`.toLowerCase();
    return !search || haystack.includes(search);
  }).sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
  elements.journalGoalLinks.innerHTML = (state.myGoals || []).map((goal) => `<option value="${escapeHtml(goal.id)}">${escapeHtml(goal.title)}</option>`).join("");
  elements.goalJournalLink.innerHTML = `<option value="">No linked entry</option>${(state.myJournal || []).filter((entry) => !entry.archivedAt).map((entry) => `<option value="${escapeHtml(entry.id)}">${escapeHtml(entry.title)}</option>`).join("")}`;
  elements.journalEntries.innerHTML = entries.map((entry) => {
    const week = (state.vsWeeks || []).find((item) => item.id === entry.vsWeekId);
    const schedule = entry.type === "plan" && week
      ? `<p class="journal-schedule">${vsWeekDays(week.beginDate).map((day) => `${day.label} ${day.shortDate}`).join(" · ")}</p><small>EWAR vs ${escapeHtml(week.opponent)}</small>`
      : "";
    const label = humanize(entry.entryType || entry.type);
    return `<article class="panel journal-entry journal-${escapeHtml(entry.type)}">
      <div class="journal-entry-heading"><span>${entry.isPinned ? "Pinned · " : ""}${label}${entry.archivedAt ? " · Archived" : ""}</span><small>Updated ${escapeHtml(formatDateTime(entry.updatedAt))}</small></div>
      <h3>${escapeHtml(entry.title)}</h3>
      ${schedule}
      <p>${escapeHtml(entry.body || entry.text)}</p>
      ${(entry.tags || []).length ? `<div class="journal-tags">${entry.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
      ${entry.reminderAt ? `<small>Reminder: ${escapeHtml(formatDateTime(entry.reminderAt))}</small>` : ""}
      <div class="journal-actions">
        <button class="secondary-button" type="button" data-edit-journal="${escapeHtml(entry.id)}">Edit</button>
        <button class="secondary-button" type="button" data-pin-journal="${escapeHtml(entry.id)}">${entry.isPinned ? "Unpin" : "Pin"}</button>
        <button class="secondary-button" type="button" data-duplicate-journal="${escapeHtml(entry.id)}">Duplicate</button>
        <button class="secondary-button" type="button" data-archive-journal="${escapeHtml(entry.id)}">${entry.archivedAt ? "Restore" : "Archive"}</button>
        <button class="danger-button" type="button" data-delete-journal="${escapeHtml(entry.id)}">Delete</button>
      </div>
    </article>`;
  }).join("") || `<div class="panel journal-empty"><h3>Your journal is ready.</h3><p>Create a private note, plan your VS week, or set a personal goal.</p></div>`;
  elements.allGoalList.innerHTML = (state.myGoals || []).map(goalCard).join("")
    || `<div class="empty-state"><strong>No goals yet.</strong><p>Create a daily, weekly, VS, event, or personal goal.</p></div>`;
}

function goalCard(goal) {
  const target = Math.max(1, Number(goal.targetValue || 1));
  const current = Math.max(0, Number(goal.currentValue || 0));
  const percent = goal.status === "completed" ? 100 : Math.min(100, Math.round(current / target * 100));
  return `<article class="goal-card">
    <div><span class="status-badge">${escapeHtml(humanize(goal.goalType))}</span><small>${escapeHtml(goal.dueDate || "No due date")}</small></div>
    <h3>${escapeHtml(goal.title)}</h3>
    <p>${escapeHtml(goal.description || "")}</p>
    <div class="goal-progress" aria-label="${percent}% complete"><i style="width:${percent}%"></i></div>
    <strong>${goal.progressMode === "checkbox" ? escapeHtml(humanize(goal.status)) : `${current.toLocaleString()} / ${target.toLocaleString()} · ${percent}%`}</strong>
    <div class="action-row">
      ${goal.status !== "completed" ? `<button class="primary-button" type="button" data-complete-goal="${escapeHtml(goal.id)}">Complete</button>` : ""}
      ${goal.status === "paused"
        ? `<button class="secondary-button" type="button" data-resume-goal="${escapeHtml(goal.id)}">Reopen</button>`
        : goal.status !== "completed" ? `<button class="secondary-button" type="button" data-pause-goal="${escapeHtml(goal.id)}">Pause</button>` : ""}
      <button class="secondary-button" type="button" data-edit-goal="${escapeHtml(goal.id)}">Edit</button>
      ${goal.relatedJournalId ? `<button class="secondary-button" type="button" data-open-related-journal="${escapeHtml(goal.relatedJournalId)}">Open Journal</button>` : ""}
      <button class="danger-button" type="button" data-delete-goal="${escapeHtml(goal.id)}">Delete</button>
    </div>
  </article>`;
}

async function saveGoal(event) {
  event.preventDefault();
  try {
    await api.saveGoal(Object.fromEntries(new FormData(event.currentTarget)));
    event.currentTarget.reset();
    await refreshState();
    showView("playerJournal");
    setStatus("Private goal saved");
  } catch (error) { setStatus(error.message, true); }
}

async function handleGoalClick(event) {
  const relatedJournal = event.target.closest("[data-open-related-journal]");
  if (relatedJournal) {
    const entry = (state.myJournal || []).find((item) => item.id === relatedJournal.dataset.openRelatedJournal);
    if (!entry) return;
    elements.journalSearch.value = entry.title;
    elements.journalTypeFilter.value = "";
    elements.journalDateFilter.value = "";
    elements.journalStateFilter.value = "all";
    showView("playerJournal");
    renderJournal();
    elements.journalEntries.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const reminder = event.target.closest("[data-dismiss-reminder]");
  if (reminder) {
    const entry = (state.myJournal || []).find((item) => item.id === reminder.dataset.dismissReminder);
    if (!entry) return;
    try {
      await api.saveJournalItem({ ...entry, reminderAt: null });
      await refreshState();
      showView("myAssignment");
      setStatus("Private reminder dismissed");
    } catch (error) { setStatus(error.message, true); }
    return;
  }
  const edit = event.target.closest("[data-edit-goal]");
  const complete = event.target.closest("[data-complete-goal]");
  const pause = event.target.closest("[data-pause-goal]");
  const resume = event.target.closest("[data-resume-goal]");
  const remove = event.target.closest("[data-delete-goal]");
  const tab = event.target.closest("[data-goal-tab]");
  if (tab) {
    selectedGoalTab = tab.dataset.goalTab;
    renderMyAssignment();
    return;
  }
  const id = edit?.dataset.editGoal || complete?.dataset.completeGoal || pause?.dataset.pauseGoal
    || resume?.dataset.resumeGoal || remove?.dataset.deleteGoal;
  if (!id) return;
  const goal = (state.myGoals || []).find((item) => item.id === id);
  if (!goal) return;
  try {
    if (remove) {
      if (!confirm(`Delete "${goal.title}"?`)) return;
      await api.deleteGoal(id);
    } else if (complete) {
      await api.saveGoal({ ...goal, status: "completed", currentValue: goal.targetValue });
    } else if (pause || resume) {
      await api.saveGoal({ ...goal, status: pause ? "paused" : "in_progress" });
    } else {
      showView("playerJournal");
      for (const [key, value] of Object.entries(goal)) {
        if (elements.goalForm.elements[key] && value !== null) elements.goalForm.elements[key].value = value;
      }
      elements.goalForm.closest("details").open = true;
      elements.goalForm.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    await refreshState();
    showView("myAssignment");
  } catch (error) { setStatus(error.message, true); }
}

async function handleAchievementClick(event) {
  const seen = event.target.closest("[data-see-achievement]");
  const dismiss = event.target.closest("[data-dismiss-achievement]");
  const restore = event.target.closest("[data-restore-achievement]");
  const id = seen?.dataset.seeAchievement || dismiss?.dataset.dismissAchievement || restore?.dataset.restoreAchievement;
  if (!id) return;
  try {
    await api.updateAchievement(id, seen ? { seen: true } : { dismissed: !restore });
    await refreshState();
    showView("myAssignment");
  } catch (error) { setStatus(error.message, true); }
}

async function handleBriefingMessageClick(event) {
  const read = event.target.closest("[data-read-message]");
  const reply = event.target.closest("[data-reply-message]");
  if (reply) {
    if (!elements.privateMessageForm || !elements.privateMessageRecipient) {
      showView("userProfile");
      setStatus("Continue this conversation in My Profile → My Messages");
      return;
    }
    elements.privateMessageRecipient.value = reply.dataset.replyMessage;
    elements.privateMessageForm.scrollIntoView({ behavior: "smooth", block: "start" });
    elements.privateMessageForm.querySelector("textarea, input[name='message']")?.focus();
    return;
  }
  if (!read) return;
  const fromProfileMessages = Boolean(event.target.closest("#userProfileContent"));
  try {
    await api.markPrivateMessageRead(read.dataset.readMessage);
    await refreshState();
    showView(fromProfileMessages ? "userProfile" : "myAssignment");
  } catch (error) { setStatus(error.message, true); }
}

function openVsWeekPlan() {
  const week = (state.vsWeeks || []).find((item) => item.id === selectedVsWeekId);
  if (!week) return setStatus("Select a VS week first", true);
  showView("playerJournal");
  const form = elements.journalForm;
  form.reset();
  form.elements.entryType.value = "plan";
  form.elements.vsWeekId.value = week.id;
  form.elements.title.value = `EWAR vs ${week.opponent} · Week plan`;
  form.elements.body.value = `Scoring focus for ${vsWeekDays(week.beginDate).map((day) => `${day.label} ${day.shortDate}`).join(", ")}:\n`;
  form.elements.body.focus();
}

async function saveJournalEntry(event) {
  event.preventDefault();
  try {
    const payload = Object.fromEntries(new FormData(event.currentTarget));
    payload.goalIds = new FormData(event.currentTarget).getAll("goalIds");
    payload.tags = String(payload.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean);
    payload.isPinned = event.currentTarget.elements.isPinned.checked;
    await api.saveJournalItem(payload);
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
  const pinButton = event.target.closest("[data-pin-journal]");
  const duplicateButton = event.target.closest("[data-duplicate-journal]");
  const archiveButton = event.target.closest("[data-archive-journal]");
  const id = editButton?.dataset.editJournal || deleteButton?.dataset.deleteJournal || pinButton?.dataset.pinJournal || duplicateButton?.dataset.duplicateJournal || archiveButton?.dataset.archiveJournal;
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
  if (pinButton || archiveButton || duplicateButton) {
    try {
      const patch = duplicateButton
        ? { ...entry, id: "", title: `${entry.title} copy`, createdAt: undefined, updatedAt: undefined }
        : archiveButton ? { ...entry, archivedAt: entry.archivedAt ? null : new Date().toISOString() }
          : { ...entry, isPinned: !entry.isPinned };
      await api.saveJournalItem(patch);
      await refreshState();
      showView("playerJournal");
      setStatus(duplicateButton ? "Journal entry duplicated" : archiveButton ? (entry.archivedAt ? "Journal entry restored" : "Journal entry archived") : "Journal pin updated");
    } catch (error) { setStatus(error.message, true); }
    return;
  }
  const form = elements.journalForm;
  form.elements.id.value = entry.id;
  form.elements.vsWeekId.value = entry.vsWeekId || "";
  form.elements.entryType.value = entry.entryType || entry.type;
  form.elements.title.value = entry.title;
  form.elements.body.value = entry.body || entry.text;
  form.elements.tags.value = (entry.tags || []).join(", ");
  form.elements.reminderAt.value = entry.reminderAt ? String(entry.reminderAt).slice(0, 16) : "";
  form.elements.isPinned.checked = Boolean(entry.isPinned);
  [...form.elements.goalIds.options].forEach((option) => { option.selected = (entry.goalIds || []).includes(option.value); });
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
  for (const category of ["strategy", "weekly", "other"]) {
    const meeting = state.leadership.meetings?.[category];
    const card = elements.leadership.querySelector(`[data-leadership-meeting-card="${category}"]`);
    card.innerHTML = meeting ? `<article class="leadership-meeting-card">
      <span>Scheduled leadership session</span><strong>${escapeHtml(meeting.date)} · ${escapeHtml(meeting.time)}</strong>
      <small>20 minutes</small><p>${escapeHtml(meeting.agenda || "Agenda to be confirmed.")}</p>
    </article>` : `<p class="muted">No meeting scheduled.</p>`;
  }
}

async function handleLeadershipSubmit(event) {
  const meetingForm = event.target.closest("[data-leadership-meeting]");
  const schedulerForm = event.target.closest("[data-leadership-scheduler]");
  const postForm = event.target.closest("[data-leadership-post]");
  const requestForm = event.target.closest("[data-leadership-request-form]");
  if (!meetingForm && !schedulerForm && !postForm && !requestForm) return;
  event.preventDefault();
  try {
    const form = Object.fromEntries(new FormData(event.target));
    if (schedulerForm) await api.scheduleLeadershipMeeting(form);
    else if (meetingForm) await api.scheduleLeadershipMeeting({ ...form, category: meetingForm.dataset.leadershipMeeting });
    else if (requestForm) await api.requestLeadershipMeeting({ ...form, category: requestForm.dataset.leadershipRequestForm });
    else await api.addLeadershipPost({ ...form, category: postForm.dataset.leadershipPost });
    if (postForm || requestForm || schedulerForm) event.target.reset();
    await refreshState();
    showView("leadership");
    setStatus(meetingForm || schedulerForm ? "Leadership meeting scheduled" : requestForm ? "Leadership meeting request sent" : "Leadership collaboration updated");
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
    renderUserProfile();
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
  const member = buildMasterRosterViewModel().members.find((item) => item.id === button.dataset.miniProfile);
  if (!player || !member) return;
  const history = playerHistory(member.id);
  const officerDetails = state.permissions.isOfficer ? `<section class="personnel-drawer-officer"><p class="eyebrow">Officer details</p><dl><div><dt>Stable member ID</dt><dd><code>${escapeHtml(member.id)}</code></dd></div><div><dt>Account link</dt><dd>${escapeHtml(member.registrationStatus)}</dd></div>${member.account.uid ? `<div><dt>Authentication UID</dt><dd><code>${escapeHtml(member.account.uid)}</code></dd></div><div><dt>Account email</dt><dd>${escapeHtml(member.account.email || "Not available")}</dd></div>` : ""}<div><dt>Profile completion</dt><dd>${member.profileComplete ? "Complete" : "Needs attention"}</dd></div><div><dt>Last THP update</dt><dd>${escapeHtml(member.thpUpdatedAt ? formatDateTime(member.thpUpdatedAt) : "Not updated")}</dd></div></dl><details class="personnel-officer-actions"><summary class="secondary-button">Officer Actions</summary><div><label>Player name<input data-member-id="${escapeHtml(member.id)}" data-player-field="gameName" value="${escapeHtml(member.name)}"></label><label>Alliance role<select data-member-id="${escapeHtml(member.id)}" data-player-field="rank">${optionHtml(["R1", "R2", "R3", "R4", "R5"], member.rank)}</select></label><label>THP<input data-member-id="${escapeHtml(member.id)}" data-player-field="thp" type="number" min="0" max="1000000000000000" value="${member.thp}"></label>${state.activeEvent ? `<label>Team<select data-member-id="${escapeHtml(member.id)}" data-field="team">${optionHtml(["Reserve", "A", "B"], member.team)}</select></label><label>Roster status<select data-member-id="${escapeHtml(member.id)}" data-field="type">${optionHtml(["Starter", "Sub"], member.rosterStatus || member.type)}</select></label><label>Unit<select data-member-id="${escapeHtml(member.id)}" data-field="tacticalGroup">${optionHtml(tacticalGroups, member.unit)}</select></label>` : ""}<label class="checkbox-label"><input data-member-id="${escapeHtml(member.id)}" data-player-field="active" type="checkbox" ${member.active ? "checked" : ""}> Active roster member</label>${state.permissions.isAdministrator ? `<button class="danger-button" type="button" data-delete-player="${escapeHtml(member.id)}">Remove from active roster</button>` : ""}</div></details></section>` : "";
  elements.memberProfileDialogContent.innerHTML = `
    <div class="profile-quick-view">
      ${player.profileImage
        ? `<img src="${escapeHtml(player.profileImage)}" alt="${escapeHtml(player.gameName)}" style="object-fit:${escapeHtml(player.profileImageFit || "cover")};object-position:${escapeHtml(player.profileImagePosition || "center")}">`
        : `<span>${escapeHtml(player.gameName.slice(0, 1))}</span>`}
      <div><p class="eyebrow">${escapeHtml(player.rank || "Member")}${member.isOfficer ? " · Officer" : ""}</p><h3>${escapeHtml(player.gameName)}</h3><p>${escapeHtml(`Team ${member.team} · ${member.unit}`)}</p></div>
    </div><section class="personnel-drawer-status"><div><span>THP</span><strong>${escapeHtml(formatThp(member.thp))}</strong></div><div><span>Availability</span>${personnelStatusBadge(member.availability)}</div><div><span>Confirmation</span>${personnelStatusBadge(member.confirmation)}</div><div><span>Registration</span>${personnelStatusBadge(member.registrationStatus)}</div></section>${member.previousNames.length ? `<p class="personnel-name-history"><strong>Previously:</strong> ${member.previousNames.map(escapeHtml).join(", ")}</p>` : ""}<section><p class="eyebrow">Public activity</p><p>${history.length} Desert Storm record${history.length === 1 ? "" : "s"} · Profile ${member.profileComplete ? "complete" : "in progress"}</p></section>${member.registered && member.active && member.id !== state.me.playerId ? `<button class="primary-button" type="button" data-message-member="${escapeHtml(member.id)}">Send Message</button>` : ""}${officerDetails}`;
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
    const definitions = state.achievementDefinitions || {};
    if (elements.achievementSettingsForm) {
      elements.achievementSettingsForm.elements.vsDailyThreshold.value = definitions.vsDailyThreshold || 80000000;
      elements.achievementSettingsForm.elements.vsWeeklyThreshold.value = definitions.vsWeeklyThreshold || 500000000;
      elements.achievementSettingsForm.elements.topThreeEnabled.checked = definitions.topThreeEnabled !== false;
      elements.achievementSettingsForm.elements.publicAnnouncements.checked = Boolean(definitions.publicAnnouncements);
      elements.achievementSettingsForm.elements.icon.value = definitions.icon || "star";
      elements.achievementSettingsForm.elements.badgeStyle.value = definitions.badgeStyle || "gold";
      elements.achievementSettingsForm.elements.messageTemplate.value = definitions.messageTemplate || "You reached {value} in {event}.";
    }
    const [allUsers, quality] = await Promise.all([api.getAdminAccounts(), api.getDataQuality()]);
    const accountSearch = document.querySelector("#adminAccountSearch")?.value.trim().toLowerCase() || "";
    const users = allUsers.filter((user) => !accountSearch || [user.uid, user.email, user.displayName, user.member?.inGameName, user.member?.allianceRank, user.applicationRole, user.accountStatus, user.linkStatus].some((value) => String(value || "").toLowerCase().includes(accountSearch)));
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
      <form class="panel admin-account-card" data-admin-account="${escapeHtml(user.uid)}">
        <input name="expectedVersion" type="hidden" value="${Number(user.version)}">
        <div class="admin-account-identity"><img src="${escapeHtml(user.member?.profileImageUrl || "/icons/icon-192.png")}" alt=""><div><strong>${escapeHtml(user.member?.inGameName || user.displayName)}</strong><span>${escapeHtml(user.email)}</span><small>${escapeHtml(user.uid)} · ${escapeHtml(user.linkStatus)} · signup ${escapeHtml(formatDateTime(user.createdAt))}</small></div></div>
        <div class="admin-account-fields">
          <label>Alliance rank<strong>${escapeHtml(user.member?.allianceRank || "Unlinked")}</strong></label>
          <label>Application role<select name="applicationRole">${optionHtml(["member", "officer", "administrator"], user.applicationRole)}</select></label>
          <label>Account status<select name="accountStatus">${optionHtml(["pending", "active", "suspended", "revoked"], user.accountStatus)}</select></label>
          <label>Roster linkage<select name="playerId"><option value="">Unlinked</option>${state.players.map((player) => `<option value="${escapeHtml(player.id)}" ${player.id === (user.playerId || user.requestedPlayerId) ? "selected" : ""}>${escapeHtml(player.gameName)} · ${escapeHtml(player.rank)}</option>`).join("")}</select></label>
        </div>
        <fieldset class="admin-capability-grid"><legend>Officer capabilities</legend>${["manageRoster", "manageEvents", "manageStrategies", "manageMap", "manageVsScores", "manageBriefings", "viewAdministration", "manageAccountAccess", "manageOfficerPermissions", "viewSeasonBattlePlans", "manageSeasonBattlePlans", "publishSeasonBattlePlans", "archiveSeasonBattlePlans", "deleteSeasonBattleDrafts"].map((permission) => `<label><input name="officerPermissions" type="checkbox" value="${permission}" ${user.officerPermissions.includes("*") || user.officerPermissions.includes(permission) ? "checked" : ""}> ${escapeHtml(humanize(permission))}</label>`).join("")}</fieldset>
        <label>Administrative notes<textarea name="administrativeNotes" maxlength="1000">${escapeHtml(user.administrativeNotes || "")}</textarea></label>
        <div class="record-actions">${user.accountStatus === "pending" ? `<button class="secondary-button" name="reviewAction" value="approve-member">Approve as Member</button><button class="secondary-button" name="reviewAction" value="approve-officer">Approve as Officer</button><button class="danger-button" name="reviewAction" value="reject">Reject</button>` : ""}<button class="primary-button" type="submit">Save Account & Permissions</button></div>
        <small>Last reviewed: ${escapeHtml(user.reviewedAt ? formatDateTime(user.reviewedAt) : "Not reviewed")} ${user.reviewedBy ? `· ${escapeHtml(user.reviewedBy)}` : ""}</small>
      </form>
    `).join("") || emptyState("No accounts match this search.");
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
    ${audit?.publishable && !audit.published ? `<button class="primary-button" type="button" data-publish-vs-day>${audit.hasWarnings ? "Publish Reviewed Rows" : "Publish Daily Scores"}</button>` : ""}
  </div>
  ${week ? `<p class="muted">${escapeHtml(group?.code || "")} Week ${week.duelLeagueWeek}/4</p>` : emptyState("No active VS weeks are available for audit.")}
  ${audit ? `<div class="readiness-grid">
    ${validationPanel("Missing player scores", audit.missingPlayers.map((player) => player.name), audit.missingPlayers.length ? "warning" : "passed")}
    ${validationPanel("Valid zero scores", audit.zeroScores || [], audit.zeroScores?.length ? "warning" : "passed")}
    ${validationPanel("Duplicate player scores", audit.duplicatePlayers.map((player) => `${player.name} Ã— ${player.count}`), audit.duplicatePlayers.length ? "error" : "passed")}
    ${validationPanel("Invalid scores", audit.invalidScores, audit.invalidScores.length ? "error" : "passed")}
    ${validationPanel("Team final result", audit.missingTeamResult ? ["Daily team totals are missing"] : [], audit.missingTeamResult ? "error" : "passed")}
  </div><p class="${audit.publishable ? "audit-pass" : "audit-fail"}">${audit.published ? "Published and locked" : audit.publishable ? `${audit.hasWarnings ? "Publishable with warnings" : "Ready to publish"}: ${audit.submittedScores} reviewed scores. Zero scores are valid.` : "Resolve the critical issues above before publishing."}</p>` : ""}`;
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

function renderLegacyMyAssignment() {
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
  const upcomingAllianceEvents = (state.allianceWeeklyEvents || []).filter((item) => item.date >= todayKey);
  const dsIsToday = event?.date === todayKey;
  const availabilityEventOptions = [
    ...(event ? [{ value: `DS · ${event.date} · ${event.opponent || "Opponent pending"}`, label: `Desert Storm · ${event.date}` }] : []),
    ...activeThemes.map((theme) => ({ value: `Theme Week · ${theme.title}`, label: `Theme Week · ${theme.title}` })),
    ...upcomingAllianceEvents.map((item) => ({ value: `${item.name} · ${item.date} · ${item.time}`, label: `${item.name} · ${item.date}` }))
  ];
  const briefingUpdates = [
    ...(state.announcements || []).map((announcement) => ({
      type: "Announcement",
      title: announcement.title,
      detail: announcement.summary,
      timestamp: announcement.createdAt,
      tone: "announcement"
    })),
    ...upcomingAllianceEvents.map((item) => ({
      type: "Alliance Event",
      title: `${item.name} · ${item.date}`,
      detail: `${item.time} server · ${item.overview}`,
      timestamp: item.updatedAt || item.createdAt || `${item.date}T${item.time}:00`,
      tone: "event"
    })),
    ...activeThemes.map((theme) => ({
      type: theme.status === "finalized" ? "Theme Week Result" : "Theme Week",
      title: theme.status === "finalized" && theme.winner ? `${theme.winner.playerName} won ${theme.title}` : `${theme.title} · ${theme.status}`,
      detail: theme.status === "voting" ? "Secret voting is open. Cast your one vote." : theme.description,
      timestamp: theme.updatedAt,
      tone: theme.status === "finalized" ? "winner" : "theme"
    })),
    ...(event && participant ? [{
      type: "My DS Assignment",
      title: `Team ${participant.team} · ${participant.tacticalGroup || "Unit pending"}`,
      detail: `${event.date} vs ${event.opponent || "Opponent pending"} · ${battleTime} server · ${participant.role || "Role pending"}`,
      timestamp: participant.updatedAt || event.updatedAt,
      tone: "assignment"
    }] : [])
  ].filter((item) => item.timestamp)
    .sort((left, right) => String(right.timestamp).localeCompare(String(left.timestamp)))
    .slice(0, 12);
  const allGoals = state.myGoals || [];
  const activeGoals = allGoals.filter((goal) => !["archived", "missed", "completed"].includes(goal.status));
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndKey = weekEnd.toISOString().slice(0, 10);
  const activeVsWeek = (state.vsWeeks || []).find((candidate) => {
    const end = new Date(`${candidate.beginDate}T12:00:00`);
    end.setDate(end.getDate() + 6);
    return todayKey >= candidate.beginDate && todayKey <= end.toISOString().slice(0, 10);
  });
  const goalsByTab = {
    today: activeGoals.filter((goal) => ["daily", "vs_daily"].includes(goal.goalType)
      ? (!goal.startDate || goal.startDate <= todayKey) && (!goal.dueDate || goal.dueDate >= todayKey)
      : goal.dueDate === todayKey),
    week: activeGoals.filter((goal) => !goal.dueDate || goal.dueDate <= weekEndKey),
    vs: activeGoals.filter((goal) => ["vs_daily", "vs_weekly"].includes(goal.goalType)
      && (!activeVsWeek || !goal.relatedEventId || goal.relatedEventId === activeVsWeek.id)),
    event: activeGoals.filter((goal) => ["desert_storm", "theme_week", "alliance_event"].includes(goal.goalType)),
    completed: allGoals.filter((goal) => goal.status === "completed")
  };
  const visibleGoals = goalsByTab[selectedGoalTab] || goalsByTab.today;
  const recentAchievements = (state.myAchievements || []).filter((item) => !item.dismissedAt).slice(0, 5);
  const dueReminders = (state.myJournal || []).filter((entry) => entry.reminderAt && !entry.archivedAt && new Date(entry.reminderAt) <= new Date());
  const receivedMessages = (state.privateMessages || []).filter((message) => message.direction === "received");
  const unreadMessages = receivedMessages.filter((message) => !message.readAtByRecipient);
  const latestLeadershipMessage = [...receivedMessages]
    .filter((message) => ["officer", "administrator"].includes(message.senderRole))
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))[0];
  const actionableGoals = activeGoals.filter((goal) => goal.status !== "paused");
  const priorityGoal = actionableGoals.find((goal) => goal.priority === "critical")
    || actionableGoals.find((goal) => goal.priority === "high")
    || actionableGoals.find((goal) => goal.status !== "completed");
  let priorityAction = pendingAnnouncements[0]
    ? { label: "Leadership update", title: pendingAnnouncements[0].title, detail: pendingAnnouncements[0].summary, action: "Review updates" }
    : participant && participant.availability !== "Confirmed"
      ? { label: "Attendance confirmation", title: "Confirm your Desert Storm availability", detail: `${event?.date || "Upcoming battle"} · Team ${participant.team}`, action: "Review assignment" }
      : priorityGoal
        ? { label: "Personal goal", title: priorityGoal.title, detail: priorityGoal.dueDate ? `Due ${priorityGoal.dueDate}` : "Continue your active goal", action: "Update goal" }
        : { label: "All caught up", title: "No required action right now", detail: "Review the upcoming schedule when you are ready.", action: "View schedule" };
  const urgentLeadershipMessage = unreadMessages.find((message) => ["action_required", "assignment_change"].includes(message.priority));
  const eventDaysAway = event?.date ? Math.ceil((new Date(`${event.date}T23:59:59`) - new Date()) / 86400000) : null;
  const eventBeginsSoon = eventDaysAway !== null && eventDaysAway >= 0 && eventDaysAway <= 1;
  const priorityType = chooseBriefingPriority({
    urgentLeadershipMessage, eventBeginsSoon,
    attendanceUnconfirmed: participant && participant.availability !== "Confirmed",
    assignmentChanged: false,
    incompleteDailyGoal: actionableGoals.find((goal) => ["daily", "vs_daily"].includes(goal.goalType) && goal.status !== "completed"),
    incompleteWeeklyGoal: priorityGoal,
    unreadMessage: unreadMessages[0],
    pendingAnnouncement: pendingAnnouncements[0]
  });
  if (priorityType === "urgent_leadership") priorityAction = { label: "Leadership action required", title: urgentLeadershipMessage.senderName, detail: urgentLeadershipMessage.text, action: "Read message", target: "dashboard" };
  else if (priorityType === "event_soon") priorityAction = { label: "Event beginning soon", title: `Desert Storm · ${event.date}`, detail: `Team ${participant?.team || "pending"} · ${battleTime} server`, action: "Review operation", target: "events" };
  else if (priorityType === "attendance") priorityAction.target = "myAssignment";
  else if (["daily_goal", "weekly_goal"].includes(priorityType)) priorityAction.target = "playerJournal";
  else if (priorityType === "message") priorityAction = { label: "Unread message", title: unreadMessages[0].senderName, detail: unreadMessages[0].text, action: "Open messages", target: "dashboard" };
  else priorityAction.target ||= priorityType === "announcement" ? "dashboard" : "events";
  elements.myAssignmentContent.innerHTML = `
    <article class="weekly-welcome panel">
      ${memberMiniProfile(player, state.me.profileTitle || "Alliance Member")}
      <div><p class="eyebrow">${escapeHtml(today)}</p><h3>Welcome back, ${escapeHtml(player.gameName)}!</h3>
      <p>Today's plan highlights your scheduled events and current assignments.</p></div>
    </article>
    <article class="priority-action-card panel">
      <p class="eyebrow">${escapeHtml(priorityAction.label)}</p><h3>${escapeHtml(priorityAction.title)}</h3>
      <p>${escapeHtml(priorityAction.detail)}</p><button class="primary-button" type="button" data-view-shortcut="${escapeHtml(priorityAction.target)}">${escapeHtml(priorityAction.action)}</button>
    </article>
    <section class="panel briefing-goals">
      <div class="assignment-heading"><div><p class="eyebrow">Private progress</p><h3>My Goals</h3></div><button class="secondary-button" type="button" data-view-shortcut="playerJournal">Add Goal</button></div>
      <div class="local-tabs" role="tablist" aria-label="Goal time range">
        ${[["today", "Today"], ["week", "This Week"], ["vs", "VS Week"], ["event", "Event Goals"], ["completed", "Completed"]]
          .map(([key, label]) => `<button type="button" role="tab" data-goal-tab="${key}" aria-selected="${selectedGoalTab === key}" class="${selectedGoalTab === key ? "active" : ""}">${label}</button>`).join("")}
      </div>
      <div class="goal-grid">${visibleGoals.slice(0, 5).map(goalCard).join("") || `<div class="empty-state"><strong>No goals in this view.</strong><p>Create a goal or choose another time range.</p></div>`}</div>
      ${visibleGoals.length > 5 ? `<button class="secondary-button" type="button" data-view-shortcut="playerJournal">View all ${visibleGoals.length} goals</button>` : ""}
    </section>
    <section class="panel briefing-achievements">
      <div class="assignment-heading"><div><p class="eyebrow">Personal milestones</p><h3>Recent Achievements</h3></div></div>
      <div class="achievement-grid">${recentAchievements.map((item) => `<article class="achievement-card">
        <span>${escapeHtml(humanize(item.icon || "star"))} · ${escapeHtml(humanize(item.eventType))}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.message)}</p>
        <small>${escapeHtml(formatDateTime(item.earnedAt))}</small>
        <div class="action-row"><button class="secondary-button" type="button" data-view-shortcut="${item.eventType === "theme_week" ? "themeWeek" : "vsEvents"}">View Results</button>${!item.seenAt ? `<button class="secondary-button" type="button" data-see-achievement="${escapeHtml(item.id)}">Mark seen</button>` : ""}<button class="secondary-button" type="button" data-dismiss-achievement="${escapeHtml(item.id)}">Dismiss</button></div>
      </article>`).join("") || `<div class="empty-state"><p>Your achievements will appear here as alliance events and results are finalized.</p></div>`}</div>
      ${(state.myAchievements || []).some((item) => item.dismissedAt) ? `<details class="achievement-history"><summary>Achievement history</summary><div class="achievement-grid">${(state.myAchievements || []).map((item) => `<article class="achievement-card"><span>${escapeHtml(humanize(item.eventType))}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.message)}</p>${item.dismissedAt ? `<button class="secondary-button" type="button" data-restore-achievement="${escapeHtml(item.id)}">Show on briefing</button>` : ""}</article>`).join("")}</div></details>` : ""}
    </section>
    ${dueReminders.length ? `<section class="panel"><div class="assignment-heading"><h3>Private Reminders</h3><span>${dueReminders.length} due</span></div>${dueReminders.slice(0, 5).map((entry) => `<article class="briefing-update"><span>Journal reminder</span><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(formatDateTime(entry.reminderAt))}</small><div class="action-row"><button class="secondary-button" type="button" data-view-shortcut="playerJournal">Open Journal</button><button class="secondary-button" type="button" data-dismiss-reminder="${escapeHtml(entry.id)}">Dismiss</button></div></article>`).join("")}</section>` : ""}
    <section class="panel briefing-messages"><div class="assignment-heading"><div><p class="eyebrow">Private communication</p><h3>Messages &amp; Questions</h3></div><span>${unreadMessages.length} unread</span></div>
      ${latestLeadershipMessage ? `<article class="briefing-update"><span>${escapeHtml(humanize(latestLeadershipMessage.priority || "standard"))}</span><strong>${escapeHtml(latestLeadershipMessage.senderName)}</strong><p>${escapeHtml(latestLeadershipMessage.text)}</p><div class="action-row">${!latestLeadershipMessage.readAtByRecipient ? `<button class="secondary-button" type="button" data-read-message="${escapeHtml(latestLeadershipMessage.id)}">Mark read</button>` : ""}<button class="secondary-button" type="button" data-reply-message="${escapeHtml(latestLeadershipMessage.senderUid)}">Reply</button></div></article>` : `<p class="muted">No recent leadership messages.</p>`}
      <button class="secondary-button" type="button" data-view-shortcut="dashboard">Open private messages</button>
    </section>
    ${concludedThemes.map((theme) => theme.winner.playerId === playerId ? `<article class="panel theme-winner-briefing personal-winner">
      ${theme.winner.submissionImage ? `<img src="${theme.winner.submissionImage}" alt="${escapeHtml(theme.winner.playerName)} winning profile-picture submission">` : ""}
      <div><p class="eyebrow">Theme Week winner</p><h3>Congrats ${escapeHtml(theme.winner.playerName)}, you've won ${escapeHtml(theme.title)}!</h3><p>We loved your PFP submission just as much as the team—so much so you've been added as a conductor for the upcoming train! Pick a VIP of your choice, and enjoy the ride on the golden train!</p></div>
    </article>` : `<article class="panel theme-winner-briefing">
      ${theme.winner.submissionImage ? `<img src="${theme.winner.submissionImage}" alt="${escapeHtml(theme.winner.playerName)} winning profile-picture submission">` : ""}
      <div><p class="eyebrow">${escapeHtml(theme.title)} concluded</p><h3>${escapeHtml(theme.winner.playerName)} won Theme Week</h3><p>The winning profile-picture submission received ${theme.winner.votes} vote${theme.winner.votes === 1 ? "" : "s"}.</p></div>
    </article>`).join("")}
    <section class="panel personal-briefing-report">
      <div class="assignment-heading"><div><p class="eyebrow">Personal update feed</p><h3>This Week in My Briefing</h3></div><span>${briefingUpdates.length} update${briefingUpdates.length === 1 ? "" : "s"}</span></div>
      <div class="briefing-update-list">${briefingUpdates.map((item) => `<article class="briefing-update briefing-update-${item.tone}">
        <span>${escapeHtml(item.type)}</span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(formatDateTime(item.timestamp))}</small><p>${escapeHtml(item.detail)}</p>
      </article>`).join("") || `<p class="muted">No weekly updates have been posted yet.</p>`}</div>
    </section>
    <section class="today-strip">
      ${dsIsToday && participant ? `<article><strong>DS · Team ${escapeHtml(participant.team)}</strong><span>${escapeHtml(battleTime)} server · ${escapeHtml(serverToLocal(event.date, battleTime))} local</span></article>` : ""}
      ${todayAllianceEvents.map((item) => `<article><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.time)} server · ${escapeHtml(serverToLocal(item.date, item.time))} local</span></article>`).join("")}
      ${activeThemes.map((theme) => `<article><strong>${escapeHtml(theme.title)}</strong><span>${theme.status === "voting" ? "Voting is open — cast your one vote" : `Theme reminder · ${escapeHtml(theme.status)}`}</span></article>`).join("")}
      ${!dsIsToday && !todayAllianceEvents.length && !activeThemes.length ? `<article><strong>No timed events today</strong><span>Review the weekly plan below.</span></article>` : ""}
    </section>
    <section class="briefing-quick-actions">
      <form class="panel compact-action-form" data-briefing-action="notice">
        <strong>Event availability chat</strong>
        <p class="muted">Send officers a quick availability update for any current event.</p>
        <label>Event<select name="eventType" required>${availabilityEventOptions.map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`).join("") || `<option value="General availability">General availability</option>`}</select></label>
        <div class="availability-prompt-row">
          <button class="secondary-button" type="button" data-availability-prompt="I'm available and ready for this event.">Available</button>
          <button class="secondary-button" type="button" data-availability-prompt="I'm running late but still plan to attend.">Running late</button>
          <button class="secondary-button" type="button" data-availability-prompt="I'm unavailable for this event.">Unavailable</button>
          <button class="secondary-button" type="button" data-availability-prompt="">Clear</button>
        </div>
        <label>Availability message<textarea name="message" maxlength="300" required placeholder="Type any availability update for officers…"></textarea></label>
        <button class="primary-button" type="submit">Send availability message</button>
      </form>
        <form class="panel compact-action-form" data-briefing-action="question">
         <strong>Need Help?</strong>
         <label>Send to<select name="recipient"><option value="administrator">Administrator</option>${(state.officerRecipients || []).filter((account) => account.role === "officer").map((account) => `<option value="${escapeHtml(account.uid)}">${escapeHtml(account.displayName)}</option>`).join("")}</select></label>
        <label>Question<input name="message" maxlength="600" required placeholder="Ask an officer or administrator…"></label>
        <label>Topic<select name="subject"><option>General Question</option><option>Question About My Assignment</option><option>Question About an Event</option><option>Question About VS</option><option>Question About Strategy</option></select></label>
        <input name="context" type="hidden" value="${escapeHtml(participant && event ? `Battle: ${event.date}; Team ${participant.team}; Unit: ${participant.tacticalGroup || "pending"}; Primary: ${participant.primaryAssignment || "pending"}; Strategy: ${strategy?.name || "pending"}` : "No active Desert Storm assignment")}">
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
        ${upcomingAllianceEvents.map((item) => `<div class="briefing-line"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.date)} · ${escapeHtml(item.time)} server · ${escapeHtml(serverToLocal(item.date, item.time))} local</span><p>${escapeHtml(item.overview)}</p></div>`).join("") || `<p class="muted">No upcoming alliance events have been posted.</p>`}
        </article>
      <article class="panel"><h3>Theme-week updates</h3>
        ${activeThemes.map((theme) => `<div class="briefing-line ${theme.acknowledgedAt ? "" : "briefing-unread"}"><strong>${escapeHtml(theme.title)}</strong><span>${escapeHtml(theme.weekOf)} · ${escapeHtml(theme.status)}</span><p>${escapeHtml(theme.description)}</p>${theme.acknowledgedAt ? `<small>Acknowledged ${escapeHtml(formatDateTime(theme.acknowledgedAt))}</small>` : `<button class="primary-button" type="button" data-theme-acknowledge="${escapeHtml(theme.id)}">Acknowledge update</button>`}</div>`).join("") || `<p class="muted">No active theme week.</p>`}
      </article>
    </section>
    ${pendingThemes.length ? `<p class="weekly-notice">${pendingThemes.length} theme-week update${pendingThemes.length === 1 ? "" : "s"} require acknowledgement.</p>` : ""}
  `;
}

function buildMyBriefingsViewModel() {
  const player = state.players.find((item) => item.id === state.me.playerId);
  const participant = state.participants.find((item) => item.playerId === state.me.playerId);
  const event = state.activeEvent;
  const strategy = participant ? state.eventStrategy?.[participant.team] : null;
  const today = localDateKeyForBriefings();
  const { start: weekStart, end: weekEnd } = briefingWeekBounds();
  const updates = [
    ...(state.privateMessages || []).filter((item) => item.direction === "received").map((item) => ({ title: item.senderName, detail: item.text, time: item.createdAt, unread: !item.readAtByRecipient, type: item.priority === "assignment_change" ? "Assignment change" : "Officer instruction", tone: "officer" })),
    ...(state.announcements || []).map((item) => ({ title: item.title, detail: item.summary, time: item.createdAt, unread: !item.acknowledgedAt, type: "Alliance", tone: "announcement" })),
    ...(state.allianceWeeklyEvents || []).filter((item) => item.date >= today).map((item) => ({ title: item.name, detail: `${item.date} · ${item.time} server · ${item.overview}`, time: item.updatedAt || item.createdAt || `${item.date}T${item.time}:00`, type: "Event", tone: "event" })),
    ...(event && participant ? [{ title: `Team ${participant.team} · ${participant.tacticalGroup || "Unit pending"}`, detail: `${participant.role || "Role pending"} · ${participant.primaryAssignment || "Objective pending"}`, time: participant.updatedAt || event.updatedAt, type: "Assignment", tone: "assignment" }] : [])
  ].filter((item) => item.time).sort((a, b) => String(b.time).localeCompare(String(a.time)));
  const strategyName = strategy?.name || (participant && event?.[`strategy${participant.team}`]) || "";
  const todayEvents = [
    ...(event?.date === today ? [{
      id: event.id,
      title: event.name || event.title || "Desert Storm",
      localTime: serverToLocal(event.date, participant ? event[`battleTime${participant.team}`] : event.battleTimeA),
      detail: participant ? `Team ${participant.team} · ${participant.tacticalGroup || "Unit pending"}` : event.opponent ? `vs ${event.opponent}` : "Event details available",
      status: eventStatusLabel(event.status)
    }] : []),
    ...(state.allianceWeeklyEvents || []).filter((item) => item.date === today).map((item) => ({
      id: item.id,
      title: item.name,
      localTime: serverToLocal(item.date, item.time),
      detail: item.overview || "Alliance event",
      status: "Scheduled"
    }))
  ];
  const weeklyGoals = (state.myGoals || [])
    .filter((goal) => !["archived", "missed"].includes(goal.status))
    .filter((goal) => {
      if (["weekly", "vs_weekly"].includes(goal.goalType)) {
        const overlapsWeek = (!goal.startDate || goal.startDate <= weekEnd) && (!goal.dueDate || goal.dueDate >= weekStart);
        const completedThisWeek = goal.completedAt && localDateKeyForBriefings(new Date(goal.completedAt)) >= weekStart && localDateKeyForBriefings(new Date(goal.completedAt)) <= weekEnd;
        return overlapsWeek && (goal.status !== "completed" || completedThisWeek);
      }
      const startsThisWeek = goal.startDate && goal.startDate >= weekStart && goal.startDate <= weekEnd;
      const dueThisWeek = goal.dueDate && goal.dueDate >= weekStart && goal.dueDate <= weekEnd;
      const spansThisWeek = (!goal.startDate || goal.startDate <= weekEnd) && (!goal.dueDate || goal.dueDate >= weekStart);
      return startsThisWeek || dueThisWeek || spansThisWeek;
    })
    .sort((left, right) => String(left.dueDate || weekEnd).localeCompare(String(right.dueDate || weekEnd)))
    .slice(0, 5);
  return {
    player, participant, event, strategy, strategyName,
    battleTime: participant && event ? event[`battleTime${participant.team}`] : "",
    today, unreadCount: updates.filter((item) => item.unread).length,
    daily: updates.filter((item) => item.unread || ["assignment", "officer", "event"].includes(item.tone)).slice(0, 5),
    previous: updates.slice(5, 13),
    goals: (state.myGoals || []).filter((item) => !["archived", "missed"].includes(item.status)).slice(0, 4),
    achievements: (state.myAchievements || []).filter((item) => !item.dismissedAt).slice(0, 3),
    todayEvents, weeklyGoals, weekStart, weekEnd,
    supportsMap: Boolean(event && participant)
  };
}

async function handleAdminAccountSave(event) {
  const form = event.target.closest("[data-admin-account]");
  if (!form) return;
  event.preventDefault();
  const submitter = event.submitter;
  const data = new FormData(form);
  const payload = { expectedVersion: Number(data.get("expectedVersion")), applicationRole: data.get("applicationRole"), accountStatus: data.get("accountStatus"), playerId: data.get("playerId"), officerPermissions: data.getAll("officerPermissions"), administrativeNotes: data.get("administrativeNotes") };
  try {
    submitter.disabled = true;
    setStatus("Saving permissions…");
    if (submitter.name === "reviewAction") await api.reviewSignup(form.dataset.adminAccount, submitter.value, payload);
    else await api.updateAdminAccount(form.dataset.adminAccount, payload);
    await refreshState();
    showView("administration");
    setStatus("Account permissions updated");
  } catch (error) { setStatus(error.message, true); await renderAdministration(); }
  finally { submitter.disabled = false; }
}

function renderBriefingRows(items, emptyMessage) {
  return items.length ? items.map((item) => `<article class="my-briefings-update briefing-update-${escapeHtml(item.tone)}"><span aria-hidden="true">${item.tone === "assignment" ? "◆" : item.tone === "officer" ? "!" : "•"}</span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.detail)}</p><small>${escapeHtml(formatDateTime(item.time))}${item.unread ? " · New" : ""}</small></div></article>`).join("") : `<p class="muted">${escapeHtml(emptyMessage)}</p>`;
}

function localDateKeyForBriefings(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function briefingWeekBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: localDateKeyForBriefings(start), end: localDateKeyForBriefings(end) };
}

function renderWeeklyGoalRows(goals) {
  if (!goals.length) return `<p class="muted">No goals have been submitted for this week.</p>`;
  return goals.map((goal) => {
    const target = Math.max(1, Number(goal.targetValue || 1));
    const current = Math.max(0, Number(goal.currentValue || 0));
    const percent = goal.status === "completed" ? 100 : Math.min(100, Math.round(current / target * 100));
    return `<article class="my-briefings-weekly-goal"><div><strong>${escapeHtml(goal.title)}</strong><small>${escapeHtml(humanize(goal.goalType))}${goal.dueDate ? ` · due ${escapeHtml(goal.dueDate)}` : ""}</small></div><div class="my-briefings-goal-progress" aria-label="${percent}% complete"><i style="width:${percent}%"></i></div><span>${percent}%</span></article>`;
  }).join("");
}

function renderMyAssignment() {
  const vm = buildMyBriefingsViewModel();
  const { player, participant, event, strategy, battleTime } = vm;
  if (!player) {
    elements.myAssignmentContent.innerHTML = emptyState("Your account is not linked to a roster player yet. Ask an administrator to link it.");
    return;
  }
  const remove = event.target.closest("[data-delete-player]");
  if (remove && elements.memberProfileDialog.open) {
    deletePlayerProfile(remove.dataset.deletePlayer);
    return;
  }
  const message = event.target.closest("[data-message-member]");
  if (message) {
    const recipient = (state.messageRecipients || []).find((item) => item.playerId === message.dataset.messageMember);
    if (!recipient) return setStatus("That member does not have an active messaging account", true);
    elements.memberProfileDialog.close();
    showView("userProfile");
    const select = elements.userProfileContent.querySelector("[data-profile-message-recipient]");
    select.value = recipient.uid;
    select.closest("form").scrollIntoView({ behavior: "smooth", block: "start" });
    select.closest("form").querySelector("textarea").focus();
    return;
  }
  const eventTitle = event?.name || event?.title || "Desert Storm";
  const primary = participant?.primaryAssignment || participant?.unit || "";
  const backup = participant?.backupAssignment || "";
  const marker = objectivePositions[primary];
  const phases = battlePhases.map((phase) => {
    const order = strategy?.orders?.[phase]?.[participant?.tacticalGroup] || strategy?.orders?.[phase]?.[participant?.unit];
    return { phase, title: order?.action || (phase === "0-5" ? "Opening Move" : phase === "25-30" ? "Finish Strong" : "Control and Hold"), objective: order?.instruction || order?.objective || strategy?.description || "Follow the published team battle plan." };
  });
  const profileImage = player.profileImage || state.me.accountPhotoUrl || "";
  elements.myAssignmentContent.innerHTML = `
    <article class="panel my-briefings-identity"><div class="my-briefings-avatar">${profileImage ? `<img src="${escapeHtml(profileImage)}" alt="${escapeHtml(player.gameName)} profile picture" style="object-fit:${escapeHtml(player.profileImageFit || "cover")};object-position:${escapeHtml(player.profileImagePosition || "center")}">` : `<span>${escapeHtml(player.gameName.split(/\s+/).map((word) => word[0]).join("").slice(0, 2))}</span>`}</div><div><p class="eyebrow">Your command briefing</p><h3>Welcome, ${escapeHtml(player.gameName)}.</h3><p>${escapeHtml(player.rank || state.me.profileTitle || "Alliance Member")} · ${participant ? `Team ${escapeHtml(participant.team)} · ${escapeHtml(participant.tacticalGroup || "Reserve")}` : "Reserve"}</p></div><button class="secondary-button" type="button" data-view-shortcut="userProfile">View Profile</button></article>
    <div class="my-briefings-heading-row"><span>${vm.unreadCount} unread briefing${vm.unreadCount === 1 ? "" : "s"}</span></div>
    <section class="my-briefings-event-grid">
      <article class="panel my-briefings-event"><div class="my-briefings-event-title"><div><p class="eyebrow">Daily operations</p><h3>Today's Events</h3></div><span>${vm.todayEvents.length} item${vm.todayEvents.length === 1 ? "" : "s"}</span></div>${vm.todayEvents.length ? `<ul class="my-briefings-event-bulletins">${vm.todayEvents.map((item) => `<li><span class="my-briefings-event-check" aria-hidden="true">□</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.localTime)} · ${escapeHtml(item.detail)}</small></div><span>${escapeHtml(item.status)}</span></li>`).join("")}</ul>` : event ? `<div class="my-briefings-no-event"><p>No event is scheduled for today.</p><strong>Next: ${escapeHtml(eventTitle)}</strong><small>${escapeHtml(event.date)} · ${escapeHtml(serverToLocal(event.date, battleTime))}</small></div>` : `<div class="my-briefings-no-event"><p>No event is scheduled for today.</p><small>Your next published event will appear here automatically.</small></div>`}</article>
      <article class="panel my-briefings-availability"><p class="eyebrow">Availability</p><h3>${participant ? escapeHtml(humanize(participant.availability || "No response")) : "Assignment pending"}</h3>${event && participant ? `<div class="my-briefings-availability-buttons" role="group" aria-label="Availability for ${escapeHtml(eventTitle)}">${[["Confirmed", "I'm Ready"], ["Tentative", "Maybe"], ["Unavailable", "Not Available"]].map(([value, label]) => `<button class="${participant.availability === value ? "primary-button" : "secondary-button"}" type="button" data-availability="${value}">${label}</button>`).join("")}</div><label>Optional note<input id="availabilityNote" value="${escapeHtml(participant.availabilityNote || "")}" maxlength="180" placeholder="Add a short note"></label><small>Event-specific response · updated ${escapeHtml(formatDateTime(participant.updatedAt))}</small>` : `<p class="muted">Availability opens when your event assignment is published.</p>`}</article>
    </section>
    <nav class="panel my-briefings-quick-access" aria-label="Briefing quick access">${participant ? `<button type="button" data-briefing-scroll="assignment">My Assignment</button>` : ""}${event ? `<button type="button" data-view-shortcut="strategyTimeline">Battle Plan</button>` : ""}${vm.supportsMap ? `<button type="button" data-view-shortcut="strategyTimeline">DS Map</button>` : ""}${participant ? `<button type="button" data-view-shortcut="events">My Team</button>` : ""}${vm.strategyName ? `<button type="button" data-view-shortcut="strategyTimeline">Strategy Guide</button>` : ""}${event ? `<button type="button" data-view-shortcut="events">Event Details</button>` : ""}</nav>
    <section class="my-briefings-primary-grid"><article class="panel my-briefings-daily"><div class="my-briefings-card-heading"><div><p class="eyebrow">Priority updates</p><h3>My Daily Briefing</h3></div><span>${vm.daily.length}</span></div>${renderBriefingRows(vm.daily, "You are all caught up. No current briefings require attention.")}<button class="secondary-button" type="button" data-briefing-scroll="previous">View All Briefings</button></article>
      <article class="panel my-briefings-assignment" data-briefing-section="assignment"><p class="eyebrow">My assignment</p>${participant ? `<div class="my-briefings-assignment-title"><div><h3>Team ${escapeHtml(participant.team)}</h3><p>${escapeHtml(participant.tacticalGroup || "Unit pending")} · ${escapeHtml(participant.role || "Role pending")}</p></div>${statusBadge(participant.rosterStatus)}</div><div class="my-briefings-objective"><span>Primary objective</span><strong>${escapeHtml(primary || "Not published")}</strong><p>${escapeHtml(unitResponsibilities[participant.unit] || strategy?.description || "Follow officer instructions for this objective.")}</p></div>${backup ? `<div class="my-briefings-objective secondary"><span>Backup objective</span><strong>${escapeHtml(backup)}</strong></div>` : ""}${event?.importantInstructions ? `<p class="my-briefings-officer-note"><strong>Officer note</strong>${escapeHtml(event.importantInstructions)}</p>` : ""}<small>Updated ${escapeHtml(formatDateTime(participant.updatedAt))}</small><div class="action-row"><button class="primary-button" type="button" data-view-shortcut="events">View Full Assignment</button><button class="secondary-button" type="button" data-view-shortcut="events">View My Team</button></div>` : `<h3>Your assignment has not been published yet.</h3><p>You will receive an update when the event roster and battle plan are finalized.</p>`}</article></section>
    <section class="panel my-briefings-weekly-goals"><div class="my-briefings-card-heading"><div><p class="eyebrow">${escapeHtml(vm.weekStart)}–${escapeHtml(vm.weekEnd)}</p><h3>My Goals This Week</h3></div><button class="secondary-button" type="button" data-view-shortcut="playerJournal">View or Edit Goals</button></div>${renderWeeklyGoalRows(vm.weeklyGoals)}</section>
    <section class="panel my-briefings-plan-summary"><div><p class="eyebrow">Overall strategy</p><h3>Strategy Goal</h3><p>${escapeHtml(strategy?.description || (vm.strategyName ? `Execute ${vm.strategyName} and maintain the published team objectives.` : "The event strategy has not been published yet."))}</p></div><div><p class="eyebrow">Member responsibility</p><h3>Your Part</h3><p>${escapeHtml(participant ? (unitResponsibilities[participant.unit] || `Support Team ${participant.team} at ${primary || "the assigned objective"}.`) : "Your responsibility will appear when an assignment is published.")}</p></div></section>
    <section class="my-briefings-secondary-grid"><article class="panel my-briefings-plan"><p class="eyebrow">${escapeHtml(vm.strategyName || "Battle plan")}</p><h3>Battle Plan Overview</h3><div class="my-briefings-timeline">${event ? phases.map((item) => `<div><time>${escapeHtml(item.phase.replace("-", "–"))}</time><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.objective)}</small></span></div>`).join("") : `<p class="muted">The event timeline has not been published yet.</p>`}</div>${event ? `<button class="secondary-button" type="button" data-view-shortcut="strategyTimeline">View Full Battle Plan</button>` : ""}</article>
      <article class="panel my-briefings-map"><p class="eyebrow">Interactive event map</p><h3>${vm.supportsMap ? "Your Objective" : "Map unavailable"}</h3>${vm.supportsMap ? `<div class="my-briefings-map-preview"><img src="/assets/desert-storm-map-clean.png" alt="Desert Storm tactical map preview">${marker ? `<span class="my-briefings-map-marker" style="left:${marker[0]}%;top:${marker[1]}%"><b>◆</b><small>${escapeHtml(primary)}</small></span>` : ""}</div><p>${primary ? `Primary: <strong>${escapeHtml(primary)}</strong>` : "Your map objective has not been assigned."}</p><button class="primary-button" type="button" data-view-shortcut="strategyTimeline">Open Interactive Map</button>` : `<p>This event does not use an interactive map.</p>`}</article></section>
    <section class="panel my-briefings-history" data-briefing-section="previous"><div class="my-briefings-card-heading"><div><p class="eyebrow">Lower-priority history</p><h3>Previous Briefings</h3></div></div>${renderBriefingRows(vm.previous, "You are all caught up. No additional briefings are available.")}${vm.goals.length || vm.achievements.length ? `<details><summary>Goals and achievements</summary><div class="my-briefings-history-extras">${vm.goals.map((item) => `<p><strong>${escapeHtml(item.title)}</strong><span>Goal · ${escapeHtml(humanize(item.status))}</span></p>`).join("")}${vm.achievements.map((item) => `<p><strong>${escapeHtml(item.title)}</strong><span>Achievement · ${escapeHtml(formatDateTime(item.earnedAt))}</span></p>`).join("")}</div><button class="secondary-button" type="button" data-view-shortcut="playerJournal">Open Journal &amp; Goals</button></details>` : ""}</section>`;
}

async function handleBriefingAction(event) {
  const form = event.target.closest("[data-briefing-action]");
  if (!form) return;
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(form));
  try {
    if (form.dataset.briefingAction === "notice") await api.addMemberNotice(payload);
    else {
      payload.message = `${payload.subject}\n${payload.context}\n\n${payload.message}`;
      delete payload.subject;
      delete payload.context;
      await api.addOfficerQuestion(payload);
    }
    form.reset();
    await refreshState();
    setStatus(form.dataset.briefingAction === "notice" ? "Availability notice sent" : "Question sent");
  } catch (error) {
    setStatus(error.message, true);
  }
}

function renderEvents() {
  const vm = buildAllianceEventsViewModel();
  elements.eventTypeSelector.querySelectorAll("[data-event-filter]").forEach((button) => {
    const active = button.dataset.eventFilter === selectedEventFilter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  const attention = vm.attention.filter(eventMatchesSelectedFilter);
  const thisWeek = vm.thisWeek.filter(eventMatchesSelectedFilter);
  const upcoming = vm.upcoming.filter(eventMatchesSelectedFilter);
  const completed = vm.completed.filter(eventMatchesSelectedFilter).slice(0, 5);
  elements.eventsHubContent.innerHTML = `
    ${attention.length ? `<section class="alliance-events-section alliance-events-attention"><div class="alliance-events-section-heading"><div><p class="eyebrow">Action needed</p><h3>Requires Your Attention</h3></div></div><div class="alliance-events-attention-grid">${attention.map(renderEventAttentionCard).join("")}</div></section>` : ""}
    <section class="alliance-events-section"><div class="alliance-events-section-heading"><div><p class="eyebrow">Active schedule</p><h3>This Week</h3></div></div><div class="alliance-events-card-grid">${thisWeek.map(renderEventHubCard).join("") || `<p class="muted">No published events in this category this week.</p>`}</div></section>
    <section class="alliance-events-section"><div class="alliance-events-section-heading"><div><p class="eyebrow">Published events</p><h3>Upcoming</h3></div></div><div class="alliance-events-compact-list">${upcoming.map(renderEventCompactRow).join("") || `<p class="muted">No later published events in this category.</p>`}</div></section>
    <section class="alliance-events-section alliance-events-completed"><div class="alliance-events-section-heading"><div><p class="eyebrow">Latest results</p><h3>Recently Completed</h3></div><button class="secondary-button" type="button" data-view-shortcut="history">View Event History</button></div><div class="alliance-events-compact-list">${completed.map(renderEventCompactRow).join("") || `<p class="muted">No recent completed events in this category.</p>`}</div></section>
  `;
}

function buildAllianceEventsViewModel() {
  const today = new Date().toISOString().slice(0, 10);
  const weekEndDate = new Date(`${today}T12:00:00`);
  weekEndDate.setDate(weekEndDate.getDate() + 7);
  const weekEnd = weekEndDate.toISOString().slice(0, 10);
  const participant = (state.participants || []).find((item) => item.playerId === state.me.playerId);
  const activeDs = state.activeEvent && state.activeEvent.status !== "draft" ? state.activeEvent : null;
  const currentTheme = (state.themeWeeks || []).find((item) => !["finalized", "archived"].includes(item.status)) || (state.themeWeeks || [])[0];
  const currentVs = (state.vsWeeks || []).find((week) => {
    const end = vsWeekDays(week.beginDate).at(-1)?.date || week.beginDate;
    return week.beginDate <= today && end >= today;
  }) || (state.vsWeeks || []).find((week) => week.beginDate >= today);
  const myScores = (state.vsScores || []).filter((entry) => entry.playerId === state.me.playerId && (!currentVs || entry.vsWeekId === currentVs.id || vsWeekDays(currentVs.beginDate).some((day) => day.date === entry.date)));
  const currentVsDay = currentVs ? vsWeekDays(currentVs.beginDate).find((day) => day.date === today) : null;
  const records = [];

  if (activeDs) {
    const team = participant?.team || "Unassigned";
    const battleTime = participant && ["A", "B"].includes(team) ? activeDs[`battleTime${team}`] : activeDs.battleTimeA;
    records.push({ id: activeDs.id, type: "ds", label: "Desert Storm", name: `Ewar vs. ${activeDs.opponent || "Opponent pending"}`, date: activeDs.date, time: battleTime, localTime: serverToLocal(activeDs.date, battleTime), status: eventStatusLabel(activeDs.status), memberStatus: participant ? `${participant.availability || "Pending"} · Team ${team}` : "Not assigned", detail: participant ? `${participant.rosterStatus || "Unassigned"} · ${participant.tacticalGroup || participant.primaryAssignment || "Assignment pending"}` : "Assignment pending", strategy: participant && ["A", "B"].includes(team) ? state.eventStrategy?.[team]?.name || activeDs[`strategy${team}`] : "Strategy pending", target: "myAssignment", action: "Open Event", scheduleChange: activeDs.scheduleChange, sortDate: activeDs.date });
  }
  if (currentTheme) {
    const submitted = Boolean(currentTheme.submissions?.[state.me.playerId]);
    const finalist = (currentTheme.finalistIds || []).includes(state.me.playerId);
    records.push({ id: currentTheme.id, type: "theme", label: "Theme Week", name: currentTheme.title, date: currentTheme.weekOf, status: humanize(currentTheme.status), memberStatus: submitted ? (finalist ? "Finalist" : "Submitted") : "Not submitted", detail: currentTheme.status === "voting" ? (currentTheme.myVote ? "Vote submitted" : "Voting open") : currentTheme.description, target: "themeWeek", action: currentTheme.status === "open" ? (submitted ? "Edit Entry" : "Submit Entry") : currentTheme.status === "voting" ? (currentTheme.myVote ? "View Finalists" : "Vote") : "View Theme Week", sortDate: currentTheme.weekOf });
  }
  for (const item of state.allianceWeeklyEvents || []) records.push({ id: item.id, type: "alliance", label: "Alliance Event", name: item.name, date: item.date, time: item.time, localTime: serverToLocal(item.date, item.time), status: "Registration Open", memberStatus: "Response available in event details", detail: item.overview, target: "allianceWeeklyEvents", action: "View Event", scheduleChange: item.scheduleChange, sortDate: item.date });
  if (currentVs) {
    const weeklyTotal = myScores.reduce((sum, entry) => sum + Number(entry.score || 0), 0);
    records.push({ id: currentVs.id, type: "vs", label: "VS Week", name: `Ewar vs. ${currentVs.opponent || "Opponent pending"}`, date: currentVs.beginDate, endDate: vsWeekDays(currentVs.beginDate).at(-1)?.date, status: currentVsDay ? `${currentVsDay.label} in progress` : "Upcoming", memberStatus: `Weekly score ${weeklyTotal.toLocaleString()}`, detail: currentVsDay ? `Current day: ${currentVsDay.label}` : "Daily focus opens with the VS week", target: "vsEvents", action: "Open VS Week", sortDate: currentVs.beginDate });
  }

  const attention = [];
  if (activeDs?.scheduleChange && participant?.availability !== "Confirmed") attention.push({ ...records.find((item) => item.type === "ds"), attentionTitle: "Schedule Updated", attentionText: `Previous: ${activeDs.scheduleChange.previousDate} · ${activeDs.scheduleChange.previousBattleTimeA}/${activeDs.scheduleChange.previousBattleTimeB} server. New: ${activeDs.date} · ${activeDs.battleTimeA}/${activeDs.battleTimeB} server.`, attentionAction: "Reconfirm Availability", availabilityAction: true });
  else if (activeDs && participant && participant.availability !== "Confirmed") attention.push({ ...records.find((item) => item.type === "ds"), attentionTitle: "Availability Required", attentionText: "Availability has not been confirmed.", attentionAction: "Confirm Availability", availabilityAction: true });
  if (currentTheme?.status === "open" && !currentTheme.submissions?.[state.me.playerId]) attention.push({ ...records.find((item) => item.type === "theme"), attentionTitle: "Theme Entry Due", attentionText: "Your Theme Week entry has not been submitted.", attentionAction: "Submit Entry" });
  if (currentTheme?.status === "voting" && !currentTheme.myVote) attention.push({ ...records.find((item) => item.type === "theme"), attentionTitle: "Theme Vote Open", attentionText: "Your finalist vote has not been submitted.", attentionAction: "Vote Now" });
  if (currentVsDay && !myScores.some((entry) => entry.date === today)) attention.push({ ...records.find((item) => item.type === "vs"), attentionTitle: "VS Day Review", attentionText: `${currentVsDay.label}'s score has not been submitted.`, attentionAction: "Review VS Day" });

  const completed = [
    ...(state.events || []).filter((item) => ["completed", "archived"].includes(item.status)).map((item) => ({ id: item.id, type: "ds", label: "Desert Storm", name: `Ewar vs. ${item.opponent || "Opponent"}`, date: item.date, status: item.outcome || eventStatusLabel(item.status), memberStatus: "View participation and results", target: "history", action: "View Results", sortDate: item.date })),
    ...(state.archivedThemeWeeks || []).map((item) => ({ id: item.id, type: "theme", label: "Theme Week", name: item.title, date: item.weekOf, status: item.winner ? `${item.winner.playerName} won` : "Winner announced", memberStatus: "Final results published", target: "history", action: "View Results", sortDate: item.weekOf })),
    ...(state.vsWeeks || []).filter((item) => (vsWeekDays(item.beginDate).at(-1)?.date || item.beginDate) < today).map((item) => ({ id: item.id, type: "vs", label: "VS Week", name: `Ewar vs. ${item.opponent}`, date: item.beginDate, status: "Final results published", memberStatus: "Weekly summary available", target: "vsEvents", action: "View Summary", sortDate: item.beginDate }))
  ].sort((left, right) => String(right.sortDate).localeCompare(String(left.sortDate)));
  const live = records.filter(Boolean);
  return { attention: attention.filter(Boolean), thisWeek: live.filter((item) => item.sortDate <= weekEnd), upcoming: live.filter((item) => item.sortDate > weekEnd).sort((a, b) => a.sortDate.localeCompare(b.sortDate)), completed };
}

function eventMatchesSelectedFilter(item) {
  return selectedEventFilter === "all" || item.type === selectedEventFilter;
}

function renderEventAttentionCard(item) {
  return `<article class="panel alliance-event-attention-card ${item.scheduleChange ? "schedule-updated" : ""}"><p class="eyebrow">${escapeHtml(item.attentionTitle)}</p><h4>${escapeHtml(item.label)}</h4><p>${escapeHtml(item.attentionText)}</p>${item.availabilityAction ? `<div class="event-confirm-actions"><button class="primary-button" type="button" data-availability="Confirmed">${escapeHtml(item.attentionAction)}</button><button class="secondary-button" type="button" data-view-shortcut="myAssignment">Review Assignment</button></div>` : `<button class="primary-button" type="button" data-view-shortcut="${escapeHtml(item.target)}">${escapeHtml(item.attentionAction)}</button>`}</article>`;
}

function renderEventHubCard(item) {
  return `<article class="panel alliance-event-hub-card"><div class="alliance-event-card-heading"><div><p class="eyebrow">${escapeHtml(item.label)}</p><h4>${escapeHtml(item.name)}</h4></div>${statusBadge(item.status)}</div><p class="alliance-event-date">${escapeHtml(item.date)}${item.endDate ? `–${escapeHtml(item.endDate)}` : ""}${item.time ? ` · ${escapeHtml(item.time)} server` : ""}</p>${item.localTime ? `<p class="muted">${escapeHtml(item.localTime)} local</p>` : ""}<dl><div><dt>Current status</dt><dd>${escapeHtml(item.status)}</dd></div><div><dt>Your participation</dt><dd>${escapeHtml(item.memberStatus)}</dd></div>${item.detail ? `<div><dt>Details</dt><dd>${escapeHtml(item.detail)}</dd></div>` : ""}${item.strategy ? `<div><dt>Strategy</dt><dd>${escapeHtml(item.strategy)}</dd></div>` : ""}</dl><div class="alliance-event-card-actions"><button class="primary-button" type="button" data-view-shortcut="${escapeHtml(item.target)}">${escapeHtml(item.action)}</button>${state.permissions.isOfficer ? `<details class="event-officer-menu"><summary class="secondary-button">Officer Actions</summary><div><button class="secondary-button" type="button" data-view-shortcut="createManagement">Open Event Management</button>${item.type === "ds" ? `<button class="secondary-button" type="button" data-view-shortcut="teams">Open Roster Management</button>` : ""}</div></details>` : ""}</div></article>`;
}

function renderEventCompactRow(item) {
  return `<article class="alliance-event-compact-row"><span class="alliance-event-icon" aria-hidden="true">${{ ds: "DS", theme: "TW", alliance: "AE", vs: "VS" }[item.type]}</span><div><p class="eyebrow">${escapeHtml(item.label)}</p><h4>${escapeHtml(item.name)}</h4><p class="muted">${escapeHtml(item.date)}${item.time ? ` · ${escapeHtml(item.time)}` : ""}</p></div><div><strong>${escapeHtml(item.status)}</strong><p class="muted">${escapeHtml(item.memberStatus || "")}</p></div><button class="secondary-button" type="button" data-view-shortcut="${escapeHtml(item.target)}">${escapeHtml(item.action || "View")}</button></article>`;
}

function handleEventHubClick(event) {
  const filter = event.target.closest("[data-event-filter]");
  if (filter) {
    selectedEventFilter = filter.dataset.eventFilter;
    renderEvents();
    return;
  }
  handleAvailabilityClick(event);
}

function renderLegacyEvents() {
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
    const legacy = await api.createEvent({ date });
    await api.createManagedEvent({ type: "desertStorm", title: `Desert Storm — ${date}`, startDate: date, details: { teamA: { serverTime: "", strategyId: "" }, teamB: { serverTime: "", strategyId: "" }, opponent: "", rosterUnlocked: false }, legacyRef: { collection: "events", id: legacy.id } });
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
    const managedEvents = await api.listManagedEvents("?type=desertStorm");
    const managed = managedEvents.find((item) => item.legacyRef?.id === state.activeEvent.id);
    if (!managed) throw new Error("The canonical DS event record was not found");
    const saved = await api.updateEvent(managed.id, { expectedVersion: managed.version, patch: { details: { teamA: { serverTime: elements.createBattleTimeA.value, strategyId: templateA.id }, teamB: { serverTime: elements.createBattleTimeB.value, strategyId: templateB.id }, opponent: state.activeEvent.opponent || "", rosterUnlocked: true } } });
    await api.transitionEvent(saved.id, "publish", { expectedVersion: saved.version });
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

function renderLegacyDashboard() {
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

function buildEwarDashboardViewModel() {
  const teamA = selected("A");
  const teamB = selected("B");
  const confirmedA = teamA.filter((member) => member.availability === "Confirmed").length;
  const confirmedB = teamB.filter((member) => member.availability === "Confirmed").length;
  const capacityA = 30;
  const capacityB = 30;
  const readiness = Math.round((confirmedA + confirmedB) / (capacityA + capacityB) * 100);
  const readinessStatus = readiness >= 90 ? "Ready" : readiness >= 70 ? "Nearly Ready" : "Needs Attention";
  const priorityRank = { critical: 4, high: 3, normal: 2, low: 1 };
  const nowKey = localDateKeyForBriefings();
  const announcements = (state.announcements || [])
    .filter((item) => item.status !== "archived" && (!item.expiresAt || item.expiresAt >= nowKey))
    .map((item) => ({ ...item, priority: String(item.priority || "normal").toLowerCase(), status: item.status || "published" }))
    .sort((left, right) => Number(Boolean(right.pinned)) - Number(Boolean(left.pinned))
      || (priorityRank[right.priority] || 2) - (priorityRank[left.priority] || 2)
      || Number(!right.acknowledgedAt) - Number(!left.acknowledgedAt)
      || String(right.createdAt).localeCompare(String(left.createdAt)));
  const celebrations = [
    ...(state.announcements || []).filter((item) => item.sourceKey).map((item) => ({ id: item.sourceKey || item.id, title: item.title, detail: item.summary, date: item.createdAt, type: "Alliance achievement", target: "vsEvents" })),
    ...[...(state.themeWeeks || []), ...(state.archivedThemeWeeks || [])].filter((item) => item.winner).map((item) => ({ id: `theme-${item.id}`, title: `${item.winner.playerName} won ${item.title}`, detail: `Theme Week winner with ${item.winner.votes || 0} votes.`, date: item.updatedAt, type: "Theme Week", playerId: item.winner.playerId, target: "themeWeek" })),
    ...(state.battles || []).filter((item) => ["win", "victory"].includes(String(item.outcome).toLowerCase())).map((item) => ({ id: `battle-${item.id}`, title: "Ewar secured a Desert Storm victory", detail: `${item.scoreFor || 0}–${item.scoreAgainst || 0} vs ${item.opponent || "the opposing alliance"}.`, date: item.date, type: "Desert Storm", target: "history" }))
  ].filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
    .sort((left, right) => String(right.date).localeCompare(String(left.date))).slice(0, 8);
  return {
    metrics: [
      { id: "members", label: "Members", value: state.members.length },
      { id: "team-a-signups", label: "Team A Sign-ups", value: `${teamA.length}/${capacityA}` },
      { id: "team-b-signups", label: "Team B Sign-ups", value: `${teamB.length}/${capacityB}` },
      { id: "confirmed-a", label: "Confirmed A", value: confirmedA },
      { id: "confirmed-b", label: "Confirmed B", value: confirmedB },
      { id: "readiness", label: "Readiness", value: `${readiness}%`, status: readinessStatus }
    ],
    announcements, celebrations,
    canManageAnnouncements: state.permissions.isOfficer,
    chatDates: Object.keys(state.dailyChatHistory || {}).sort().reverse(),
    currentChatDate: state.dailyChatDate || nowKey
  };
}

async function activateDsEvent() {
  if (!state.activeEvent) return setStatus("Create and publish a DS event first", true);
  try {
    elements.activateDsButton.disabled = true;
    const managedEvents = await api.listManagedEvents("?type=desertStorm");
    const managed = managedEvents.find((item) => item.legacyRef?.id === state.activeEvent.id);
    if (!managed) throw new Error("The canonical DS event record was not found");
    await api.transitionEvent(managed.id, "activate", { expectedVersion: managed.version });
    setStatus("Desert Storm event activated");
  } catch (error) { setStatus(error.message, true); }
  finally { elements.activateDsButton.disabled = false; }
}

function renderDashboardMetric(metric) {
  return `<article class="ewar-dashboard-metric metric-${escapeHtml(metric.id)}"><span>${escapeHtml(metric.label)}</span><strong>${escapeHtml(metric.value)}</strong>${metric.status ? `<small>${escapeHtml(metric.status)}</small>` : ""}</article>`;
}

function renderAnnouncementCard(announcement, canManage) {
  const unread = !announcement.acknowledgedAt;
  return `<article class="ewar-dashboard-announcement priority-${escapeHtml(announcement.priority)} ${unread ? "is-unread" : "is-read"}">
    <div class="ewar-dashboard-announcement-marker"><span>${escapeHtml(humanize(announcement.priority))}</span>${announcement.pinned ? "<b>Pinned</b>" : ""}</div>
    <div class="ewar-dashboard-announcement-copy"><h4>${escapeHtml(announcement.title)}</h4><p>${escapeHtml(announcement.summary)}</p><small>${escapeHtml(announcement.createdByName || "Ewar Officer")} · ${escapeHtml(formatDateTime(announcement.createdAt))} · ${unread ? "Unread" : "Read"}</small></div>
    <details class="ewar-dashboard-announcement-details"><summary class="secondary-button">Open</summary><div><p>${escapeHtml(announcement.body || announcement.summary)}</p>${announcement.attachment ? (announcement.attachment.startsWith("data:image/") ? `<img src="${announcement.attachment}" alt="Attachment for ${escapeHtml(announcement.title)}">` : `<a class="secondary-button" href="${announcement.attachment}" download="${escapeHtml(announcement.attachmentName || "attachment")}">Download attachment</a>`) : ""}<div class="action-row">${unread ? `<button class="secondary-button" type="button" data-announcement-acknowledge="${escapeHtml(announcement.id)}">Mark read</button>` : ""}<button class="secondary-button ${announcement.markedHelpful ? "is-active" : ""}" type="button" data-announcement-helpful="${escapeHtml(announcement.id)}">Helpful · ${Number(announcement.helpfulCount || 0)}</button></div>${canManage ? `<details><summary>Edit announcement</summary><form data-edit-announcement="${escapeHtml(announcement.id)}" class="ewar-dashboard-edit-form"><label>Title<input name="title" maxlength="120" value="${escapeHtml(announcement.title)}" required></label><label>Summary<textarea name="summary" maxlength="280" required>${escapeHtml(announcement.summary)}</textarea></label><label>Full message<textarea name="body" maxlength="4000">${escapeHtml(announcement.body || "")}</textarea></label><label>Priority<select name="priority">${["Critical", "High", "Normal", "Low"].map((value) => `<option ${announcement.priority === value.toLowerCase() ? "selected" : ""}>${value}</option>`).join("")}</select></label><label>Expiration<input name="expiresAt" type="date" value="${escapeHtml(announcement.expiresAt || "")}"></label><label class="checkbox-label"><input name="pinned" type="checkbox" ${announcement.pinned ? "checked" : ""}> Pinned</label><button class="primary-button" type="submit">Save Changes</button><button class="danger-button" type="button" data-delete-announcement="${escapeHtml(announcement.id)}">Delete</button></form></details>` : ""}</div></details>
  </article>`;
}

function renderDashboardChat() {
  const selectedDate = elements.dailyChatHistoryDate?.value || state.dailyChatDate;
  const messages = state.dailyChatHistory?.[selectedDate] || (selectedDate === state.dailyChatDate ? state.dailyChat || [] : []);
  elements.dailyChatDate.textContent = selectedDate === state.dailyChatDate ? `${selectedDate} · Today's alliance chat` : `${selectedDate} · Chat history`;
  elements.dailyChatList.innerHTML = messages.map((message) => `<article class="ewar-dashboard-chat-message">${memberMiniProfile({ id: message.playerId, name: message.playerName, profileImage: message.profileImage }, formatDateTime(message.createdAt))}<p>${escapeHtml(message.text)}</p></article>`).join("") || `<p class="muted">No messages yet ${selectedDate === state.dailyChatDate ? "today. Start the daily conversation." : "for this day."}</p>`;
  elements.dailyChatForm.hidden = selectedDate !== state.dailyChatDate;
  elements.dailyChatList.scrollTop = elements.dailyChatList.scrollHeight;
}

function renderEwarDashboard() {
  const vm = buildEwarDashboardViewModel();
  elements.summaryCards.innerHTML = vm.metrics.map(renderDashboardMetric).join("");
  elements.announcementList.innerHTML = vm.announcements.map((item) => renderAnnouncementCard(item, vm.canManageAnnouncements)).join("") || `<p class="muted">${vm.canManageAnnouncements ? "No announcements have been published. Create the first announcement." : "No current Ewar announcements."}</p>`;
  if (elements.dailyChatHistoryDate) {
    const dates = vm.chatDates.includes(vm.currentChatDate) ? vm.chatDates : [vm.currentChatDate, ...vm.chatDates];
    const previous = elements.dailyChatHistoryDate.value;
    elements.dailyChatHistoryDate.innerHTML = dates.map((date) => `<option value="${escapeHtml(date)}">${date === vm.currentChatDate ? `${escapeHtml(date)} · Today` : escapeHtml(date)}</option>`).join("");
    elements.dailyChatHistoryDate.value = dates.includes(previous) ? previous : vm.currentChatDate;
  }
  renderDashboardChat();
  elements.allianceCelebrationsList.innerHTML = vm.celebrations.map((item) => `<article class="ewar-dashboard-celebration"><span aria-hidden="true">★</span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.detail)}</p><small>${escapeHtml(item.type)} · ${escapeHtml(formatDateTime(item.date))}</small></div><button class="secondary-button" type="button" data-view-shortcut="${escapeHtml(item.target)}">View Results</button></article>`).join("") || `<p class="muted">No recent celebration messages. New achievements will appear here.</p>`;
}

function renderDashboard() {
  renderEwarDashboard();
}

function handleAvailabilityPrompt(event) {
  const button = event.target.closest("[data-availability-prompt]");
  if (!button) return;
  const form = button.closest("[data-briefing-action='notice']");
  const message = form?.querySelector("[name='message']");
  if (!message) return;
  message.value = button.dataset.availabilityPrompt || "";
  message.focus();
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

async function saveAchievementSettings(event) {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.currentTarget));
  payload.topThreeEnabled = event.currentTarget.elements.topThreeEnabled.checked;
  payload.publicAnnouncements = event.currentTarget.elements.publicAnnouncements.checked;
  try {
    await api.updateAchievementDefinitions(payload);
    await refreshState();
    showView("administration");
    document.querySelector("#achievementSettingsStatus").textContent = "Achievement rules saved.";
  } catch (error) { document.querySelector("#achievementSettingsStatus").textContent = error.message; }
}

function previewAchievementTrigger() {
  const form = elements.achievementSettingsForm;
  const daily = Number(form.elements.vsDailyThreshold.value || 0).toLocaleString();
  const weekly = Number(form.elements.vsWeeklyThreshold.value || 0).toLocaleString();
  const preview = form.elements.messageTemplate.value.replace("{value}", daily).replace("{event}", "VS Daily");
  document.querySelector("#achievementSettingsStatus").textContent = `Dry run only: top-three ${form.elements.topThreeEnabled.checked ? "enabled" : "disabled"}; daily threshold ${daily}; weekly threshold ${weekly}. Preview: ${preview} No awards created.`;
}

async function handleDailyChatSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const submit = event.currentTarget.querySelector("[type='submit']");
  if (submit.disabled) return;
  try {
    submit.disabled = true;
    submit.textContent = "Sending…";
    await api.postDailyChat(form.get("text"));
    event.currentTarget.reset();
    await refreshState();
    setStatus("Team chat message posted");
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    submit.disabled = false;
    submit.textContent = "Send";
  }
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
      body: formData.get("body"),
      priority: formData.get("priority"),
      pinned: event.currentTarget.elements.pinned.checked,
      expiresAt: formData.get("expiresAt"),
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
  const acknowledgeButton = event.target.closest("[data-announcement-acknowledge]");
  if (!deleteButton && !helpfulButton && !replyButton && !acknowledgeButton) return;
  try {
    if (deleteButton) {
      if (!confirm("Delete this announcement?")) return;
      await api.deleteAnnouncement(deleteButton.dataset.deleteAnnouncement);
    } else if (helpfulButton) {
      await api.toggleAnnouncementHelpful(helpfulButton.dataset.announcementHelpful);
    } else if (acknowledgeButton) {
      await api.acknowledgeAnnouncement(acknowledgeButton.dataset.announcementAcknowledge);
    } else {
      const id = replyButton.dataset.announcementReply;
      const input = elements.announcementList.querySelector(`[data-announcement-reply-text="${CSS.escape(id)}"]`);
      await api.replyToAnnouncement(id, input?.value || "");
    }
    await refreshState();
  } catch (error) { setStatus(error.message, true); }
}

async function handleAnnouncementEditSubmit(event) {
  const form = event.target.closest("[data-edit-announcement]");
  if (!form) return;
  event.preventDefault();
  const submit = form.querySelector("[type='submit']");
  try {
    submit.disabled = true;
    const payload = Object.fromEntries(new FormData(form));
    payload.pinned = form.elements.pinned.checked;
    await api.updateAnnouncement(form.dataset.editAnnouncement, payload);
    await refreshState();
    setStatus("Announcement updated");
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    submit.disabled = false;
  }
}

function renderDirectory() {
  const query = normalizeRosterSearch(elements.searchInput.value);
  const filter = elements.filterInput.value;
  const teamFilter = elements.directoryTeamFilter.value;
  const sort = elements.rankSort.value;
  const vm = buildMasterRosterViewModel();
  const members = vm.members.filter((member) => {
    if (query && !member.searchText.includes(query)) return false;
    if (teamFilter && member.team !== teamFilter) return false;
    if (filter === "registered" && !member.registered) return false;
    if (filter === "unregistered" && member.registered) return false;
    if (filter === "officers" && !member.isOfficer) return false;
    if (filter === "active" && !member.active) return false;
    if (filter === "inactive" && member.active) return false;
    if (filter === "available" && member.availability !== "Ready") return false;
    if (filter === "unavailable" && member.availability !== "Unavailable") return false;
    if (filter === "confirmed" && member.confirmation !== "Confirmed") return false;
    if (filter === "not-confirmed" && member.confirmation === "Confirmed") return false;
    if (filter === "missing-thp" && member.thp > 0) return false;
    if (filter === "incomplete" && member.profileComplete) return false;
    return true;
  });
  members.sort((left, right) => sort === "thp" ? right.thp - left.thp || left.name.localeCompare(right.name) : sort === "updated" ? String(right.updatedAt).localeCompare(String(left.updatedAt)) : sort === "rank" ? masterRosterComparator(left, right) : left.name.localeCompare(right.name, undefined, { sensitivity: "base", numeric: true }));
  elements.directorySummary.innerHTML = vm.metrics.map((metric) => `<article><span>${escapeHtml(metric.label)}</span><strong>${escapeHtml(metric.value)}</strong><small>${escapeHtml(metric.detail)}</small></article>`).join("");
  if (elements.rosterReviewAlerts) elements.rosterReviewAlerts.innerHTML = state.permissions.isOfficer && vm.reviewAlerts.length ? `<section class="panel"><div><p class="eyebrow">Officer review</p><h3>${vm.reviewAlerts.length} personnel record${vm.reviewAlerts.length === 1 ? "" : "s"} need attention</h3></div><ul>${vm.reviewAlerts.slice(0, 8).map((item) => `<li><button type="button" class="secondary-button" data-mini-profile="${escapeHtml(item.id)}">${escapeHtml(item.name)}</button><span>${escapeHtml(item.reason)}</span></li>`).join("")}</ul></section>` : "";
  document.querySelector("#rosterResultCount").textContent = `${members.length} of ${vm.members.length} members`;
  elements.directoryRows.innerHTML = members.map(directoryRow).join("") || `<tr><td colspan="10">No members match the current filters.</td></tr>`;
}

function buildMasterRosterViewModel(force = false) {
  if (!force && rosterStore.loaded && rosterStore.updatedAt === state.updatedAt && rosterStore.viewModel) return rosterStore.viewModel;
  const participants = new Map((state.members || []).map((member) => [member.id, member]));
  const accounts = new Map((state.rosterAccounts || []).map((account) => [account.playerId, account]));
  const members = (state.players || []).map((player) => {
    const participant = participants.get(player.id) || {};
    const account = accounts.get(player.id) || { registered: false, registrationStatus: "Not Registered" };
    const previousNames = (player.previousPlayerNames || []).map((item) => item.name).filter(Boolean);
    const availability = participant.availability === "Confirmed" ? "Ready" : participant.availability === "Tentative" ? "Maybe" : participant.availability === "Unavailable" ? "Unavailable" : "Unknown";
    const confirmation = state.activeEvent?.scheduleChange && participant.availability !== "Confirmed" ? "Reconfirmation Required" : participant.availability === "Confirmed" ? "Confirmed" : participant.availability === "Unavailable" ? "Declined" : "Pending";
    const team = participant.team || player.defaultTeam || "Reserve";
    const unit = participant.tacticalGroup || player.defaultTacticalGroup || "Reserve";
    const profileComplete = Boolean(account.profileComplete && player.profileImage && player.thp > 0);
    const isOfficer = ["officer", "administrator"].includes(account.accountRole) || ["R4", "R5"].includes(String(player.rank).toUpperCase());
    return { ...player, ...participant, account, id: player.id, name: player.gameName, previousNames, team, unit, thp: Number(player.thp || 0), registered: account.registered, registrationStatus: account.registrationStatus, profileComplete, active: player.active !== false, availability, confirmation, isOfficer, updatedAt: player.updatedAt || participant.updatedAt, searchText: normalizeRosterSearch([player.gameName, ...previousNames, ...(player.aliases || []), player.rank, team, unit, account.email, player.id].join(" ")) };
  });
  const activeThp = members.filter((member) => member.active && member.thp > 0);
  const normalizedCounts = members.reduce((counts, member) => counts.set(normalizeRosterIdentity(member.name), (counts.get(normalizeRosterIdentity(member.name)) || 0) + 1), new Map());
  const reviewAlerts = [];
  for (const member of members) {
    if ((normalizedCounts.get(normalizeRosterIdentity(member.name)) || 0) > 1) reviewAlerts.push({ id: member.id, name: member.name, reason: "Duplicate normalized player name" });
    else if (!member.registered) reviewAlerts.push({ id: member.id, name: member.name, reason: "Not registered" });
    else if (!member.profileComplete) reviewAlerts.push({ id: member.id, name: member.name, reason: "Incomplete profile or missing THP" });
  }
  const metrics = [
    { label: "Members", value: String(members.length), detail: `${members.filter((member) => member.active).length} active` },
    { label: "Registered", value: String(members.filter((member) => member.registered).length), detail: "Linked accounts" },
    { label: "Unregistered", value: String(members.filter((member) => !member.registered).length), detail: "Awaiting account link" },
    { label: "Team A", value: String(members.filter((member) => member.team === "A").length), detail: "Current placement" },
    { label: "Team B", value: String(members.filter((member) => member.team === "B").length), detail: "Current placement" },
    { label: "Reserve", value: String(members.filter((member) => member.team === "Reserve").length), detail: "Reserve roster" },
    { label: "Officers", value: String(members.filter((member) => member.isOfficer).length), detail: "Leadership profiles" },
    { label: "Average THP", value: formatThp(activeThp.length ? activeThp.reduce((sum, member) => sum + member.thp, 0) / activeThp.length : 0), detail: `${activeThp.length} reported` }
  ];
  const viewModel = { members, metrics, reviewAlerts };
  rosterStore.membersById = new Map(members.map((member) => [member.id, member]));
  rosterStore.orderedMemberIds = members.map((member) => member.id);
  rosterStore.viewModel = viewModel;
  rosterStore.loaded = true;
  rosterStore.updatedAt = state.updatedAt;
  return viewModel;
}

function getRosterMemberById(memberId) { return rosterStore.membersById.get(memberId) || null; }
function getRosterMembersByIds(memberIds) { return memberIds.map(getRosterMemberById).filter(Boolean); }
function getActiveRosterMembers() { return rosterStore.orderedMemberIds.map(getRosterMemberById).filter((member) => member?.active); }
function getMembersByTeam(eventId, team) { return eventId === state.activeEvent?.id ? getActiveRosterMembers().filter((member) => member.selected && member.team === team) : []; }
function getUnassignedMembersForEvent(eventId) { return eventId === state.activeEvent?.id ? getActiveRosterMembers().filter((member) => !member.selected) : getActiveRosterMembers(); }

function normalizeRosterSearch(value) {
  return String(value || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function normalizeRosterIdentity(value) {
  return normalizeRosterSearch(value).replace(/[\p{P}\p{S}\s]+/gu, "");
}

function handleRosterSelectorOpen(event) {
  const trigger = event.target.closest("[data-open-roster-selector]");
  if (!trigger || !state.permissions.isOfficer) return;
  if (!state.activeEvent) return setStatus("Create an event before selecting its roster", true);
  if (!state.activeEvent.setupPublishedAt) return setStatus("Publish Team A/B times and strategies before selecting the roster", true);
  rosterSelectorState.config = { eventId: state.activeEvent.id, eventType: "desert_storm", maximumSelections: 30 };
  rosterSelectorState.selectedMemberIds = new Set();
  elements.rosterSelectorForm.reset();
  elements.rosterSelectorForm.elements.tacticalGroup.innerHTML = optionHtml(tacticalGroups, "Reserve");
  document.querySelector("#rosterSelectorContext").textContent = `Desert Storm · ${state.activeEvent.date} · ${state.activeEvent.opponent || "Opponent pending"}`;
  renderRosterSelector();
  elements.rosterSelectorDialog.showModal();
}

function handleRosterSelectorClick(event) {
  if (event.target.closest("[data-close-roster-selector]")) {
    elements.rosterSelectorDialog.close();
    return;
  }
  const checkbox = event.target.closest("[data-roster-candidate]");
  if (!checkbox) return;
  if (checkbox.checked) rosterSelectorState.selectedMemberIds.add(checkbox.value);
  else rosterSelectorState.selectedMemberIds.delete(checkbox.value);
  renderRosterSelectionSummary();
}

function filterRosterCandidates(members, { search = "", eligibility = "active" } = {}) {
  const query = normalizeRosterSearch(search);
  return members.filter((member) => {
    if (query && !member.searchText.includes(query)) return false;
    if (eligibility === "active" && !member.active) return false;
    if (eligibility === "available" && member.availability !== "Ready") return false;
    if (eligibility === "confirmed" && member.confirmation !== "Confirmed") return false;
    if (eligibility === "unassigned" && member.selected) return false;
    if (eligibility === "missing-thp" && member.thp > 0) return false;
    return true;
  });
}

function sortRosterCandidates(members, sort = "name") {
  return [...members].sort((left, right) => {
    if (sort === "thp-desc") return right.thp - left.thp || left.name.localeCompare(right.name);
    if (sort === "thp-asc") return left.thp - right.thp || left.name.localeCompare(right.name);
    if (sort === "availability") return left.availability.localeCompare(right.availability) || left.name.localeCompare(right.name);
    if (sort === "registration") return left.registrationStatus.localeCompare(right.registrationStatus) || left.name.localeCompare(right.name);
    if (sort === "updated") return String(right.updatedAt).localeCompare(String(left.updatedAt));
    return left.name.localeCompare(right.name, undefined, { sensitivity: "base", numeric: true });
  });
}

function renderRosterSelector() {
  if (!rosterSelectorState.config) return;
  const form = elements.rosterSelectorForm;
  const candidates = sortRosterCandidates(filterRosterCandidates(getActiveRosterMembers(), { search: form.elements.search.value, eligibility: form.elements.eligibility.value }), form.elements.sort.value);
  elements.rosterSelectorCandidates.innerHTML = candidates.map((member) => `<label class="roster-selector-candidate ${rosterSelectorState.selectedMemberIds.has(member.id) ? "selected" : ""}"><input type="checkbox" data-roster-candidate value="${escapeHtml(member.id)}" ${rosterSelectorState.selectedMemberIds.has(member.id) ? "checked" : ""}><span class="roster-selector-identity">${memberMiniProfile(member, `${member.rank || "Member"} · ${formatThp(member.thp)}`)}</span><span>${escapeHtml(member.team)} · ${escapeHtml(member.unit)}</span><span>${personnelStatusBadge(member.availability)} ${personnelStatusBadge(member.confirmation)}</span></label>`).join("") || `<p class="muted">No eligible roster members match these filters.</p>`;
  renderRosterSelectionSummary();
}

function validateEventAssignments(selectedMembers, team, rosterStatus) {
  const config = eventRosterConfig[rosterSelectorState.config?.eventType] || { capacityByTeam: {} };
  const capacity = config.capacityByTeam[team];
  const selectedIds = new Set(selectedMembers.map((member) => member.id));
  if (["Remove", "RequestConfirmation"].includes(rosterStatus)) return { warnings: [], teamCount: getMembersByTeam(state.activeEvent.id, team).length, capacity: capacity?.maximumSignUps || null, starters: 0, substitutes: 0 };
  const retained = getMembersByTeam(state.activeEvent.id, team).filter((member) => !selectedIds.has(member.id));
  const after = [...retained, ...selectedMembers];
  const warnings = [];
  if (capacity && after.length > capacity.maximumSignUps) warnings.push(`Team ${team} would have ${after.length}/${capacity.maximumSignUps} sign-ups`);
  const starters = after.filter((member) => selectedIds.has(member.id) ? rosterStatus === "Starter" : member.rosterStatus === "Starter").length;
  const substitutes = after.filter((member) => selectedIds.has(member.id) ? rosterStatus === "Sub" : member.rosterStatus === "Sub").length;
  if (capacity && starters > capacity.starters) warnings.push(`Starter capacity would be ${starters}/${capacity.starters}`);
  if (capacity && substitutes > capacity.substitutes) warnings.push(`Substitute capacity would be ${substitutes}/${capacity.substitutes}`);
  for (const member of selectedMembers) {
    if (member.availability === "Unavailable") warnings.push(`${member.name} is unavailable`);
    if (member.confirmation === "Reconfirmation Required") warnings.push(`${member.name} requires reconfirmation`);
    if (!member.profileComplete) warnings.push(`${member.name} has an incomplete profile`);
  }
  return { warnings, teamCount: after.length, capacity: capacity?.maximumSignUps || null, starters, substitutes };
}

function renderRosterSelectionSummary() {
  const form = elements.rosterSelectorForm;
  const selectedMembers = getRosterMembersByIds([...rosterSelectorState.selectedMemberIds]);
  const validation = validateEventAssignments(selectedMembers, form.elements.team.value, form.elements.rosterStatus.value);
  elements.rosterSelectionSummary.innerHTML = `<p class="eyebrow">Assignment preview</p><h3>${selectedMembers.length} member${selectedMembers.length === 1 ? "" : "s"} selected</h3><p>Desert Storm · Team ${escapeHtml(form.elements.team.value)} · ${escapeHtml(form.elements.tacticalGroup.value)} · ${escapeHtml(form.elements.rosterStatus.value)}</p><strong>Team capacity after assignment: ${validation.teamCount}${validation.capacity ? ` / ${validation.capacity}` : ""}</strong>${validation.warnings.length ? `<ul class="roster-selector-warnings">${validation.warnings.slice(0, 8).map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>` : `<p class="muted">No assignment conflicts detected.</p>`}`;
}

async function assignSelectedRosterMembers(event) {
  event.preventDefault();
  const selectedMembers = getRosterMembersByIds([...rosterSelectorState.selectedMemberIds]);
  if (!selectedMembers.length) return setStatus("Select at least one roster member", true);
  const form = elements.rosterSelectorForm;
  const team = form.elements.team.value;
  const rosterStatus = form.elements.rosterStatus.value;
  const tacticalGroup = form.elements.tacticalGroup.value;
  const removing = rosterStatus === "Remove";
  const requestingConfirmation = rosterStatus === "RequestConfirmation";
  const validation = validateEventAssignments(selectedMembers, team, rosterStatus);
  if (validation.warnings.length && !confirm(`Apply this assignment with ${validation.warnings.length} warning${validation.warnings.length === 1 ? "" : "s"}?`)) return;
  const previous = selectedMembers.map((member) => ({ id: member.id, selected: member.selected, team: member.team, rosterStatus: member.rosterStatus, tacticalGroup: member.tacticalGroup }));
  const submit = form.querySelector("[type='submit']");
  try {
    submit.disabled = true;
    for (const member of selectedMembers) Object.assign(state.members.find((item) => item.id === member.id) || {}, requestingConfirmation ? { availability: "Pending" } : removing ? { selected: false, team: "Reserve", type: "Sub", rosterStatus: "Sub", tacticalGroup: "Reserve" } : { selected: true, team, type: rosterStatus, rosterStatus, tacticalGroup });
    buildMasterRosterViewModel(true);
    renderDirectory();
    renderTeams();
    const result = await api.updateEventAssignmentsBatch(state.activeEvent.id, selectedMembers.map((member) => ({ memberId: member.id, patch: requestingConfirmation ? { availability: "Pending" } : removing ? { selected: false, team: "Reserve", rosterStatus: "Sub", tacticalGroup: "Reserve" } : { selected: true, team, rosterStatus, tacticalGroup } })));
    await refreshState();
    elements.rosterSelectorDialog.close();
    setStatus(result.warnings?.length ? `Assignments saved with ${result.warnings.length} capacity warning${result.warnings.length === 1 ? "" : "s"}` : "Event assignments saved");
  } catch (error) {
    for (const snapshot of previous) Object.assign(state.members.find((item) => item.id === snapshot.id) || {}, snapshot);
    buildMasterRosterViewModel(true);
    renderDirectory();
    renderTeams();
    setStatus(error.message, true);
  } finally {
    submit.disabled = false;
  }
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
  const submitter = event.submitter;
  try {
    submitter.disabled = true;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const managed = await api.createManagedEvent({ type: "allianceEvent", title: values.name, startDate: values.date, serverTime: values.time, summary: values.overview, details: { category: values.name, serverTime: values.time }, action: submitter.value });
    if (submitter.value === "publish") await api.createAllianceEvent(values);
    event.currentTarget.reset();
    await refreshState();
    setStatus(managed.status === "draft" ? "Alliance event draft saved" : "Alliance event published to every member briefing");
  } catch (error) { setStatus(error.message, true); }
  finally { submitter.disabled = false; }
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
  const submitter = event.submitter;
  try {
    submitter.disabled = true;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const managed = await api.createManagedEvent({ type: "themeWeek", title: values.title, startDate: values.weekOf, description: values.description, details: { rules: values.rules }, action: submitter.value });
    if (submitter.value === "publish") await api.createThemeWeek(values);
    event.currentTarget.reset();
    await refreshState();
    setStatus(managed.status === "draft" ? "Theme week draft saved" : "Theme week published");
  } catch (error) { setStatus(error.message, true); }
  finally { submitter.disabled = false; }
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

function renderBattlePlanningOverview() {
  const plans = state.seasonBattles || [];
  const activeSeason = plans.find((plan) => plan.id === state.activeSeasonBattleId) || plans.find((plan) => plan.status === "active");
  elements.battlePlanningOverview.innerHTML = `<div class="battle-planning-cards">
    <article class="panel battle-planning-card"><p class="eyebrow">Desert Storm</p><h3>${escapeHtml(state.activeEvent ? `vs. ${state.activeEvent.opponent || "Opponent pending"}` : "No active event")}</h3><p>The established Team A/B map, Strategy Library, assignments, and 30-minute timeline.</p><button class="primary-button" type="button" data-view-shortcut="strategyTimeline">Open Desert Storm Map</button></article>
    <article class="panel battle-planning-card"><p class="eyebrow">Season Battles</p><h3>${escapeHtml(activeSeason?.title || "No active Season Battle")}</h3><p>${activeSeason ? `${escapeHtml(activeSeason.battleDate || "Date pending")} · ${escapeHtml(activeSeason.mapAreaName || "Area pending")}` : `${plans.length} saved plan${plans.length === 1 ? "" : "s"}`}</p><button class="primary-button" type="button" data-view-shortcut="seasonBattles">Open Season Battles</button></article>
  </div><section class="panel"><h3>Planning boundaries</h3><p>Desert Storm records and Season Battle records use separate maps, validation rules, snapshots, and active-plan indexes.</p></section>`;
}

async function createSeasonBattlePlan(event) {
  event.preventDefault();
  try {
    const payload = Object.fromEntries(new FormData(event.currentTarget));
    const plan = await api.createSeasonBattle(payload);
    selectedSeasonBattleId = plan.id; seasonBattleDraft = structuredClone(plan);
    await refreshState(); setStatus("Season Battle draft created");
  } catch (error) { setStatus(error.message, true); }
}

function renderSeasonBattles() {
  const plans = state.seasonBattles || [];
  const canManage = Boolean(state.permissions.manageSeasonBattlePlans);
  document.querySelector("#seasonBattleCreator").hidden = !canManage;
  if (!selectedSeasonBattleId || !plans.some((plan) => plan.id === selectedSeasonBattleId)) selectedSeasonBattleId = plans[0]?.id || "";
  const stored = plans.find((plan) => plan.id === selectedSeasonBattleId);
  if (!stored) { elements.seasonBattleWorkspace.innerHTML = emptyState(canManage ? "Create the first Season Battle map." : "No Season Battle plan has been published."); return; }
  if (!seasonBattleDraft || seasonBattleDraft.id !== stored.id || seasonBattleDraft.version !== stored.version) seasonBattleDraft = structuredClone(stored);
  const plan = seasonBattleDraft;
  const readOnly = !canManage || ["completed", "archived"].includes(plan.status);
  const selected = plan.objects.find((item) => item.id === selectedSeasonObjectId);
  elements.seasonBattleWorkspace.innerHTML = `<div class="season-battle-layout">
    <aside class="panel season-battle-list"><h3>Plans</h3>${plans.map((item) => `<button type="button" data-season-select="${escapeHtml(item.id)}" class="${item.id === plan.id ? "active" : ""}"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.status)} · ${escapeHtml(item.battleDate || "Date pending")}</small></button>`).join("")}</aside>
    <section class="season-battle-main">
      <form class="panel season-battle-details" data-season-details><input name="expectedVersion" type="hidden" value="${plan.version}"><div><p class="eyebrow">${escapeHtml(plan.seasonName || "Season Battle")}</p><h3>${escapeHtml(plan.title)}</h3><p>${escapeHtml(plan.mapAreaName || "Map area pending")} · ${escapeHtml(plan.opponent || "Target pending")}</p></div><span class="status-pill">${escapeHtml(plan.status)}</span>
        ${canManage && !readOnly ? `<label>Title<input name="title" value="${escapeHtml(plan.title)}" required></label><label>Season<input name="seasonName" value="${escapeHtml(plan.seasonName)}"></label><label>Date<input name="battleDate" type="date" value="${escapeHtml(plan.battleDate || "")}"></label><label>Server time<input name="serverTime" type="time" value="${escapeHtml(plan.serverTime || "")}"></label><label>Opponent<input name="opponent" value="${escapeHtml(plan.opponent)}"></label><label>Area<input name="mapAreaName" value="${escapeHtml(plan.mapAreaName)}"></label><label class="wide-field">Description<textarea name="description">${escapeHtml(plan.description)}</textarea></label><button class="secondary-button" type="submit">Save details</button>` : ""}
      </form>
      ${canManage && !readOnly ? `<section class="panel season-upload"><label class="primary-button">${plan.screenshot ? "Replace screenshot" : "Upload screenshot"}<input data-season-screenshot type="file" accept="image/jpeg,image/png,image/webp"></label><small>JPEG, PNG, or WebP · 15 MB maximum. Replacing an image may require grid recalibration.</small></section>` : ""}
      ${plan.screenshot ? renderSeasonBattleEditor(plan, readOnly, selected) : `<section class="panel"><h3>Screenshot required</h3><p>The original screenshot remains a protected base layer. Grid and object data are stored separately.</p></section>`}
      ${canManage ? `<div class="panel record-actions"><button class="secondary-button" type="button" data-season-action="duplicate">Duplicate Draft</button>${!readOnly ? `<button class="primary-button" type="button" data-season-action="publish">Publish Snapshot</button>` : ""}${plan.publishedVersion && plan.status !== "archived" ? `<button class="secondary-button" type="button" data-season-action="archive">Archive</button>` : ""}</div>` : ""}
    </section></div>`;
  hydrateSeasonBattleImage(plan);
}

function renderSeasonBattleEditor(plan, readOnly, selected) {
  const grid = plan.grid;
  const inaccessible = new Set(plan.inaccessibleCells || []);
  return `<section class="panel season-map-panel">
    <div class="season-map-toolbar" role="toolbar" aria-label="Season Battle map tools">
      ${!readOnly ? ["select", "base", "allianceCenter", "inaccessible", "erase"].map((tool) => `<button type="button" data-season-tool="${tool}" class="secondary-button ${seasonBattleTool === tool ? "active" : ""}">${{select:"Select / Move",base:"Add Base",allianceCenter:"Add Alliance Center",inaccessible:"Mark Inaccessible",erase:"Erase Zone"}[tool]}</button>`).join("") : ""}
      ${!readOnly ? `<button type="button" class="secondary-button" data-season-action="undo" ${seasonBattleUndo.length ? "" : "disabled"}>Undo</button><button type="button" class="secondary-button" data-season-action="redo" ${seasonBattleRedo.length ? "" : "disabled"}>Redo</button>` : ""}
      <button type="button" class="secondary-button" data-season-action="zoom-out">Zoom −</button><button type="button" class="secondary-button" data-season-action="zoom-in">Zoom +</button><button type="button" class="secondary-button" data-season-action="reset-view">Reset View</button><label>Grid <input data-season-toggle-grid type="checkbox" ${grid.showGrid ? "checked" : ""}></label><label>Zones <input data-season-toggle-zones type="checkbox" checked></label>
    </div>
    ${!readOnly ? `<div class="season-grid-settings"><label>Columns<input data-season-grid="columns" type="number" min="10" max="120" value="${grid.columns}"></label><label>Rows<input data-season-grid="rows" type="number" min="10" max="120" value="${grid.rows}"></label><label>Grid opacity<input data-season-grid="gridOpacity" type="range" min="0.05" max="1" step="0.05" value="${grid.gridOpacity}"></label><button class="primary-button" type="button" data-season-action="save-map">Save Draft Map</button></div>` : ""}
    <div class="season-map-scroll"><div class="season-map-stage ${grid.showGrid ? "show-grid" : ""}" tabindex="0" data-season-stage style="--columns:${grid.columns};--rows:${grid.rows};--grid-opacity:${grid.gridOpacity};--zoom:${seasonBattleZoom};aspect-ratio:${plan.screenshot.width}/${plan.screenshot.height}">
      <img data-season-map-image alt="${escapeHtml(plan.title)} map screenshot">
      <div class="season-zone-layer">${[...inaccessible].map((key) => { const [row,column] = key.split(":").map(Number); return `<i style="--row:${row};--column:${column}"></i>`; }).join("")}</div>
      <div class="season-object-layer">${plan.objects.map((object) => `<button type="button" data-season-object="${escapeHtml(object.id)}" class="season-map-object ${object.type === "allianceCenter" ? "alliance-center" : "base"} ${object.id === selectedSeasonObjectId ? "selected" : ""}" style="--row:${object.anchor.row};--column:${object.anchor.column};--width:${object.widthCells};--height:${object.heightCells}" aria-label="${escapeHtml(object.label)}"><b>${object.type === "allianceCenter" ? "AC" : "B"}</b><span>${escapeHtml(object.label)}</span></button>`).join("")}</div>
    </div></div><p class="season-map-message" data-season-message>${readOnly ? "Published read-only map. Zoom with your browser and select objects for details." : "Choose a tool, then click a grid cell. Objects snap to grid coordinates."}</p>
    ${selected ? `<aside class="season-object-details"><h4>${escapeHtml(selected.label)}</h4><p>${selected.type === "base" ? "Base · 3 × 3 cells" : "Alliance Center · 9 × 9 cells"}</p>${!readOnly ? `<label>Label<input data-season-object-field="label" value="${escapeHtml(selected.label)}"></label><label>Assigned member<select data-season-object-field="assignedMemberId"><option value="">Unassigned</option>${state.players.map((player) => `<option value="${escapeHtml(player.id)}" ${player.id === selected.assignedMemberId ? "selected" : ""}>${escapeHtml(player.gameName)}</option>`).join("")}</select></label><label>Notes<textarea data-season-object-field="notes">${escapeHtml(selected.notes)}</textarea></label><button class="danger-button" type="button" data-season-action="delete-object">Delete</button>` : `<p>${escapeHtml(selected.notes || "No published notes.")}</p>`}</aside>` : ""}
  </section>`;
}

async function hydrateSeasonBattleImage(plan) { const image = elements.seasonBattleWorkspace.querySelector("[data-season-map-image]"); if (!image) return; try { image.src = await api.getSeasonBattleImage(plan.screenshot.originalUrl); } catch (error) { elements.seasonBattleWorkspace.querySelector("[data-season-message]").textContent = error.message; } }

async function handleSeasonBattleSubmit(event) {
  const form = event.target.closest("[data-season-details]"); if (!form) return; event.preventDefault();
  try { await api.updateSeasonBattle(seasonBattleDraft.id, { ...Object.fromEntries(new FormData(form)), expectedVersion: seasonBattleDraft.version }); await refreshState(); setStatus("Season Battle details saved"); } catch (error) { setStatus(error.message, true); }
}

async function handleSeasonBattleChange(event) {
  if (event.target.matches("[data-season-screenshot]")) {
    const file = event.target.files[0]; if (!file) return;
    if (!window.confirm("Replace the screenshot? Existing grid alignment and placements will be retained for review.")) { event.target.value = ""; return; }
    try { await api.uploadSeasonBattleScreenshot(seasonBattleDraft.id, file); await refreshState(); setStatus("Protected map screenshot uploaded"); } catch (error) { setStatus(error.message, true); }
    return;
  }
  if (event.target.matches("[data-season-grid]")) { pushSeasonUndo(); seasonBattleDraft.grid[event.target.dataset.seasonGrid] = Number(event.target.value); renderSeasonBattles(); return; }
  if (event.target.matches("[data-season-toggle-grid]")) { seasonBattleDraft.grid.showGrid = event.target.checked; renderSeasonBattles(); return; }
  if (event.target.matches("[data-season-toggle-zones]")) { elements.seasonBattleWorkspace.querySelector(".season-zone-layer").hidden = !event.target.checked; return; }
  if (event.target.matches("[data-season-object-field]")) { pushSeasonUndo(); const object = seasonBattleDraft.objects.find((item) => item.id === selectedSeasonObjectId); object[event.target.dataset.seasonObjectField] = event.target.value || null; renderSeasonBattles(); }
}

async function handleSeasonBattleClick(event) {
  if (seasonBattleSuppressClick) { seasonBattleSuppressClick = false; return; }
  const planButton = event.target.closest("[data-season-select]"); if (planButton) { selectedSeasonBattleId = planButton.dataset.seasonSelect; seasonBattleDraft = null; selectedSeasonObjectId = ""; renderSeasonBattles(); return; }
  const tool = event.target.closest("[data-season-tool]"); if (tool) { seasonBattleTool = tool.dataset.seasonTool; renderSeasonBattles(); return; }
  const objectButton = event.target.closest("[data-season-object]"); if (objectButton && seasonBattleTool === "select") { selectedSeasonObjectId = objectButton.dataset.seasonObject; renderSeasonBattles(); return; }
  const action = event.target.closest("[data-season-action]"); if (action) { await runSeasonBattleAction(action.dataset.seasonAction); return; }
  const stage = event.target.closest("[data-season-stage]"); if (!stage || !state.permissions.manageSeasonBattlePlans) return;
  const rect = stage.getBoundingClientRect(); const column = Math.min(seasonBattleDraft.grid.columns - 1, Math.max(0, Math.floor((event.clientX - rect.left) / rect.width * seasonBattleDraft.grid.columns))); const row = Math.min(seasonBattleDraft.grid.rows - 1, Math.max(0, Math.floor((event.clientY - rect.top) / rect.height * seasonBattleDraft.grid.rows)));
  applySeasonBattleGridAction(row, column);
}

function applySeasonBattleGridAction(row, column) {
  const key = `${row}:${column}`; pushSeasonUndo();
  if (["inaccessible", "erase"].includes(seasonBattleTool)) { const cells = new Set(seasonBattleDraft.inaccessibleCells); if (seasonBattleTool === "erase") cells.delete(key); else if (!seasonBattleDraft.objects.some((object) => cellInsideObject(row, column, object))) cells.add(key); seasonBattleDraft.inaccessibleCells = [...cells]; renderSeasonBattles(); return; }
  if (["base", "allianceCenter"].includes(seasonBattleTool)) { const size = seasonBattleTool === "base" ? 3 : 9; const validation = clientValidateSeasonPlacement(seasonBattleTool, row, column, size, size); if (!validation.valid) { seasonBattleUndo.pop(); showSeasonMessage(validation.message, true); return; } const id = crypto.randomUUID(); seasonBattleDraft.objects.push({ id, type: seasonBattleTool, anchor: { row, column }, widthCells: size, heightCells: size, label: seasonBattleTool === "base" ? `Base ${seasonBattleDraft.objects.filter((item) => item.type === "base").length + 1}` : "Alliance Center", assignedMemberId: null, allianceName: "", notes: "" }); selectedSeasonObjectId = id; seasonBattleTool = "select"; renderSeasonBattles(); }
}

function clientValidateSeasonPlacement(type, row, column, width, height, ignoreId = "") { if (row < 0 || column < 0 || row + height > seasonBattleDraft.grid.rows || column + width > seasonBattleDraft.grid.columns) return { valid:false, message:`${type === "base" ? "A Base" : "The Alliance Center"} extends outside the configured grid.` }; const cells=[]; for(let r=row;r<row+height;r++) for(let c=column;c<column+width;c++) cells.push(`${r}:${c}`); if(cells.some((key)=>seasonBattleDraft.inaccessibleCells.includes(key))) return {valid:false,message:"Placement overlaps an inaccessible zone."}; for(const object of seasonBattleDraft.objects.filter((item)=>item.id!==ignoreId)) if(cells.some((key)=>{const [r,c]=key.split(":").map(Number);return cellInsideObject(r,c,object)})) return {valid:false,message:`Placement overlaps ${object.label}.`}; return {valid:true,message:"Valid placement"}; }
function cellInsideObject(row,column,object){return row>=object.anchor.row&&row<object.anchor.row+object.heightCells&&column>=object.anchor.column&&column<object.anchor.column+object.widthCells;}
function pushSeasonUndo(){seasonBattleUndo.push(structuredClone(seasonBattleDraft));if(seasonBattleUndo.length>50)seasonBattleUndo.shift();seasonBattleRedo.length=0;}
function showSeasonMessage(message,error=false){const target=elements.seasonBattleWorkspace.querySelector("[data-season-message]");if(target){target.textContent=message;target.classList.toggle("error",error);}}

async function runSeasonBattleAction(action) {
  try {
    if (action === "undo" && seasonBattleUndo.length) { seasonBattleRedo.push(structuredClone(seasonBattleDraft)); seasonBattleDraft = seasonBattleUndo.pop(); renderSeasonBattles(); return; }
    if (action === "redo" && seasonBattleRedo.length) { seasonBattleUndo.push(structuredClone(seasonBattleDraft)); seasonBattleDraft = seasonBattleRedo.pop(); renderSeasonBattles(); return; }
    if (action === "delete-object") { pushSeasonUndo(); seasonBattleDraft.objects = seasonBattleDraft.objects.filter((item) => item.id !== selectedSeasonObjectId); selectedSeasonObjectId = ""; renderSeasonBattles(); return; }
    if (["zoom-in", "zoom-out", "reset-view"].includes(action)) { seasonBattleZoom = action === "zoom-in" ? Math.min(3, seasonBattleZoom + .25) : action === "zoom-out" ? Math.max(1, seasonBattleZoom - .25) : 1; renderSeasonBattles(); return; }
    if (action === "save-map") { await api.updateSeasonBattle(seasonBattleDraft.id, { expectedVersion: seasonBattleDraft.version, grid: seasonBattleDraft.grid, objects: seasonBattleDraft.objects, inaccessibleCells: seasonBattleDraft.inaccessibleCells, annotations: seasonBattleDraft.annotations }); await refreshState(); setStatus("Season Battle draft saved"); return; }
    if (action === "publish" && !window.confirm("Publish an immutable member-visible snapshot of this map?")) return;
    if (action === "archive" && !window.confirm("Archive this published Season Battle plan as read-only history?")) return;
    const result = await api.seasonBattleAction(seasonBattleDraft.id, action, { expectedVersion: seasonBattleDraft.version, activate: action === "publish" }); selectedSeasonBattleId = result.id; seasonBattleDraft = null; await refreshState(); setStatus(`Season Battle ${action} complete`);
  } catch (error) { setStatus(error.details?.errors?.join(" ") || error.message, true); showSeasonMessage(error.details?.errors?.join(" ") || error.message, true); }
}

function handleSeasonBattleKeydown(event) {
  const stage = event.target.closest("[data-season-stage]"); if (!stage || !selectedSeasonObjectId || !state.permissions.manageSeasonBattlePlans || !["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(event.key)) return;
  event.preventDefault(); const object = seasonBattleDraft.objects.find((item) => item.id === selectedSeasonObjectId); const row = object.anchor.row + (event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0); const column = object.anchor.column + (event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0); const validation = clientValidateSeasonPlacement(object.type,row,column,object.widthCells,object.heightCells,object.id); if(!validation.valid){showSeasonMessage(validation.message,true);return;} pushSeasonUndo(); object.anchor={row,column}; renderSeasonBattles(); elements.seasonBattleWorkspace.querySelector("[data-season-stage]")?.focus();
}

function handleSeasonBattlePointerDown(event) {
  const object = event.target.closest("[data-season-object]");
  if (!object || seasonBattleTool !== "select" || !state.permissions.manageSeasonBattlePlans) return;
  seasonBattleDrag = { id: object.dataset.seasonObject, x: event.clientX, y: event.clientY };
}

function handleSeasonBattlePointerUp(event) {
  if (!seasonBattleDrag) return;
  const drag = seasonBattleDrag; seasonBattleDrag = null;
  if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) return;
  const stage = event.target.closest("[data-season-stage]") || elements.seasonBattleWorkspace.querySelector("[data-season-stage]");
  const object = seasonBattleDraft.objects.find((item) => item.id === drag.id); if (!stage || !object) return;
  const rect = stage.getBoundingClientRect(); const column = Math.floor((event.clientX - rect.left) / rect.width * seasonBattleDraft.grid.columns); const row = Math.floor((event.clientY - rect.top) / rect.height * seasonBattleDraft.grid.rows);
  const validation = clientValidateSeasonPlacement(object.type, row, column, object.widthCells, object.heightCells, object.id);
  seasonBattleSuppressClick = true;
  if (!validation.valid) { showSeasonMessage(`${validation.message} Previous position retained.`, true); return; }
  pushSeasonUndo(); object.anchor = { row, column }; selectedSeasonObjectId = object.id; renderSeasonBattles();
}

function renderStrategyTimeline() {
  const event = state.activeEvent;
  if (!event) {
    elements.strategyTimelineContent.innerHTML = emptyState("No published Desert Storm event is currently active.");
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
      <div class="timeline-simulation-label"><strong>Planned Battle Timeline</strong><span>Strategy simulation only — not live game tracking</span></div>
      <div class="timeline-playback-bar">
        <button class="secondary-button" type="button" data-timeline-previous ${timelinePhaseIndex === 0 ? "disabled" : ""}>Previous phase</button>
        <button class="secondary-button" type="button" data-timeline-next ${timelinePhaseIndex === phases.length - 1 ? "disabled" : ""}>Next phase</button>
        <button class="secondary-button" type="button" data-timeline-reset>Reset</button>
        <button class="tactical-play-button" type="button" data-timeline-play><span>${timelinePlaybackTimer ? "â…¡" : "â–¶"}</span>${timelinePlaybackTimer ? "Pause playback" : "Play battle plan"}</button>
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
          ${state.me.playerId ? `<button class="primary-button show-my-map-assignment" type="button" data-show-my-assignment>Show My Assignment</button>` : ""}
          <div class="strategy-tactical-map" aria-label="Interactive Desert Storm objective map">
            <img src="/assets/desert-storm-map-clean.png" alt="Desert Storm battle map">
            <div class="strategy-route-layer">${timelineRoutes(displayedOrders)}</div>
            <div class="strategy-group-layer">${timelineGroupMarkers(displayedOrders)}</div>
            <div class="strategy-objective-layer">${Object.entries(objectivePositions).map(([objective, [x, y]]) => `
              <button type="button" class="strategy-objective ${activeObjectives.has(objective) ? "active" : "inactive"} ${timelineSelectedObjective === objective ? "selected" : ""}" style="left:${x}%;top:${y}%" data-map-objective="${escapeHtml(objective)}" aria-label="Open ${escapeHtml(objective)} strategy details"><span>${escapeHtml(objective)}</span></button>
            `).join("")}</div>
          </div>
        </div>
        <aside class="strategy-unit-rail">
          <div class="strategy-legend-heading"><span>Unit legend</span><small>Choose a unit to inspect its orders</small></div>
          <div class="strategy-map-legend">${orders.map((order) => `<button type="button" data-map-group="${escapeHtml(order.group)}" class="${timelineSelectedGroup === order.group ? "active" : ""}"><i style="background:${tacticalGroupColor(order.group)}"></i><span><strong>${escapeHtml(order.group)}</strong><small>${order.members.length} players</small></span></button>`).join("")}</div>
          ${timelineSelectedObjective ? timelineSelectedObjectivePanel(timelineSelectedObjective, orders, phase) : selectedOrder ? timelineSelectedUnitPanel(selectedOrder, phases) : `<article class="map-selection-hint panel"><strong>No units available</strong><span>Assign players to tactical units to display battle commands.</span></article>`}
        </aside>
      </div>
    ` : `<article class="panel"><p class="muted">Apply a reusable strategy template to add timed battle phases and map commands.</p></article>`}
    </div>
  `;
}

function timelineSelectedObjectivePanel(objective, orders, phase) {
  const assigned = orders.filter((order) => order.primaryObjective === objective || order.secondaryObjective === objective);
  const primary = assigned.filter((order) => order.primaryObjective === objective);
  const support = assigned.filter((order) => order.secondaryObjective === objective);
  const participants = assigned.flatMap((order) => order.members.map((member) => ({ ...member, mapGroup: order.group })));
  const x = objectivePositions[objective]?.[0] || 50;
  const region = x < 35 ? "West" : x > 65 ? "East" : "Center";
  const critical = ["Info Center", "Nuclear Silo"].includes(objective);
  return `<article class="map-objective-brief panel">
    <div class="selected-unit-heading"><div><p class="eyebrow">${region} region · ${critical ? "Critical strategic objective" : "Operational structure"}</p><h3>${escapeHtml(objective)}</h3></div><button class="secondary-button" type="button" data-close-objective>Close</button></div>
    <dl class="strategy-order-details"><div><dt>Active phase</dt><dd>${phase.startMinute}–${phase.endMinute} minutes</dd></div><div><dt>Primary units</dt><dd>${escapeHtml(primary.map((item) => item.group).join(", ") || "Unassigned")}</dd></div><div><dt>Support units</dt><dd>${escapeHtml(support.map((item) => item.group).join(", ") || "None")}</dd></div><div><dt>Priority</dt><dd>${critical ? "Critical" : assigned.length ? "Assigned" : "Inactive"}</dd></div></dl>
    <div class="objective-command-list">${assigned.map((order) => `<div><strong>${escapeHtml(order.group)} · ${escapeHtml(order.primaryObjective === objective ? order.primaryAction : order.secondaryAction)}</strong><span>${escapeHtml(order.goal || "Follow the phase strategy.")}</span></div>`).join("") || `<p class="muted">No unit is assigned during the selected phase.</p>`}</div>
    <details class="selected-unit-members"><summary>Assigned and support players (${participants.length})</summary><div class="mini-profile-list">${participants.map((member) => memberMiniProfile(member.playerId, `${member.mapGroup} · Team ${timelineTeam}`)).join("") || "<small>No players assigned</small>"}</div></details>
    <small>Last update: ${escapeHtml(state.eventMap?.updatedAt || state.updatedAt || "Not available")}</small>
  </article>`;
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
  const previousButton = event.target.closest("[data-timeline-previous]");
  const nextButton = event.target.closest("[data-timeline-next]");
  const resetButton = event.target.closest("[data-timeline-reset]");
  const myAssignmentButton = event.target.closest("[data-show-my-assignment]");
  const closeObjectiveButton = event.target.closest("[data-close-objective]");
  if (teamButton) {
    stopTimelinePlayback();
    timelineTeam = teamButton.dataset.timelineTeam;
    timelinePhaseIndex = 0;
    timelineSelectedGroup = "";
    timelineSelectedObjective = "";
    timelineMovementView = "all";
    renderStrategyTimeline();
  } else if (phaseButton) {
    stopTimelinePlayback();
    timelinePhaseIndex = Number(phaseButton.dataset.timelinePhase);
    timelineSelectedGroup = "";
    timelineSelectedObjective = "";
    renderStrategyTimeline();
  } else if (playButton) {
    toggleTimelinePlayback();
  } else if (previousButton || nextButton || resetButton) {
    stopTimelinePlayback();
    timelinePhaseIndex = resetButton ? 0 : Math.max(0, Math.min(battlePhases.length - 1, timelinePhaseIndex + (nextButton ? 1 : -1)));
    renderStrategyTimeline();
  } else if (myAssignmentButton) {
    const participant = state.participants.find((item) => item.playerId === state.me.playerId);
    if (!participant || !["A", "B"].includes(participant.team)) return setStatus("You do not currently have a team assignment", true);
    timelineTeam = participant.team;
    timelineSelectedGroup = participantTacticalGroup(participant);
    timelineSelectedObjective = participant.openingObjective || participant.primaryUnit || participant.unit || "";
    timelinePhaseIndex = 0;
    renderStrategyTimeline();
  } else if (closeObjectiveButton) {
    timelineSelectedObjective = "";
    renderStrategyTimeline();
  } else if (groupButton) {
    timelineSelectedGroup = groupButton.dataset.mapGroup;
    timelineSelectedObjective = "";
    renderStrategyTimeline();
  } else if (movementViewButton) {
    timelineMovementView = movementViewButton.dataset.movementView;
    renderStrategyTimeline();
  } else if (objectiveButton) {
    timelineSelectedObjective = objectiveButton.dataset.mapObjective;
    renderStrategyTimeline();
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
    const field = event.target.dataset.playerField;
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    if (["gameName", "active"].includes(field) && !confirm(`Confirm this ${field === "gameName" ? "player-name change" : "membership-status change"}? The stable member ID and linked history will be preserved.`)) {
      await refreshState();
      return;
    }
    try {
      await api.updatePlayer(event.target.dataset.memberId, { [field]: value });
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

function formatVsScore(value, hasScore = true) {
  if (!hasScore || value === null || value === undefined || value === "") return "No score entered";
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "No score entered";
  return Math.max(0, Math.round(numericValue)).toLocaleString("en-US");
}

function vsMemberIdentity(playerId, fallbackName = "Alliance member") {
  const player = state.players.find((item) => item.id === playerId);
  const name = player?.gameName || fallbackName;
  const avatar = player?.profileImage ? `<img src="${escapeHtml(player.profileImage)}" alt="" loading="lazy">` : `<span>${escapeHtml(name.slice(0, 1).toUpperCase())}</span>`;
  return `<span class="vs-rank-avatar">${avatar}</span><strong>${escapeHtml(name)}</strong>`;
}

function renderVsRanking(title, records, scoreKey, status) {
  return `<section class="panel vs-ranking-panel"><div class="assignment-heading"><h3>${escapeHtml(title)}</h3><span>${escapeHtml(status)}</span></div><ol class="vs-top-ten">${records.slice(0, 10).map((record, index) => `<li class="${index < 3 ? `vs-rank-${index + 1}` : ""}"><span class="vs-rank-number">${index + 1}</span><span class="vs-rank-member">${vsMemberIdentity(record.playerId, record.playerName || record.name)}</span><span class="vs-rank-score">${formatVsScore(record[scoreKey], record.hasScore !== false)}</span></li>`).join("") || `<li class="vs-ranking-empty">No published scores for this period.</li>`}</ol></section>`;
}

function splitDuelLeagueTeam(value = "") {
  const text = String(value).trim();
  const tagged = text.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (tagged) return { abbreviation: tagged[1].toUpperCase(), fullName: tagged[2] || tagged[1] };
  const parts = text.split(/\s+[—–-]\s+/);
  if (parts.length > 1 && parts[0].length <= 8) return { abbreviation: parts[0].toUpperCase(), fullName: parts.slice(1).join(" - ") };
  const words = text.split(/\s+/).filter(Boolean);
  return { abbreviation: words.length === 1 ? text.toUpperCase() : words.map((word) => word[0]).join("").slice(0, 6).toUpperCase(), fullName: text };
}

function renderDuelLeagueTeam(value) {
  const team = splitDuelLeagueTeam(value);
  return `<span class="duel-team"><strong>${escapeHtml(team.abbreviation || "—")}</strong><small>${escapeHtml(team.fullName || "Unknown team")}</small></span>`;
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
  const publishedScores = scores.filter((entry) => Boolean(week?.publishedDays?.[entry.date]));
  const byPlayer = new Map();
  for (const entry of publishedScores) {
    const record = byPlayer.get(entry.playerId) || { name: entry.playerName, total: 0, entries: [] };
    record.total += Number(entry.score || 0);
    record.entries.push(entry);
    byPlayer.set(entry.playerId, record);
  }
  const ranking = [...byPlayer.entries()].map(([playerId, record]) => ({ playerId, ...record }))
    .sort((left, right) => right.total - left.total || left.name.localeCompare(right.name));
  const result = week?.dailyResults?.[selectedVsDate] || { ourScore: 0, opponentScore: 0 };
  const published = Boolean(week?.publishedDays?.[selectedVsDate]);
  const outcome = Number(result.ourScore) === Number(result.opponentScore) ? "Pending" : Number(result.ourScore) > Number(result.opponentScore) ? "Win" : "Loss";
  const resultClass = outcome === "Win" ? "vs-win" : outcome === "Loss" ? "vs-loss" : "vs-pending";
  elements.vsMatchupHeader.innerHTML = week ? `<article class="panel vs-matchup-header ${resultClass}">
    <div class="vs-scoreboard-context">
      <p class="eyebrow">${escapeHtml(duelGroup?.code || "Duel League")} · Week ${week.duelLeagueWeek}/4 · ${escapeHtml(days.find((day) => day.date === selectedVsDate)?.label || "")} · ${escapeHtml(selectedVsDate)}</p>
      <span>Server ${escapeHtml(week.server)} · ${week.opponentMembers} opponent members${published ? " · Published" : ""}</span>
    </div>
    <div class="vs-scoreboard-team vs-scoreboard-ewar ${outcome === "Win" ? "vs-team-leading" : outcome === "Loss" ? "vs-team-trailing" : ""}">
      <h3>EWAR</h3>
      <label>Daily team points<input name="ourScore" type="number" min="0" value="${Number(result.ourScore || 0)}" required aria-label="EWAR daily team points"></label>
      <small>Daily score · ${formatVsScore(result.ourScore)}</small>
    </div>
    <div class="vs-scoreboard-outcome"><span>${outcome}</span><small>Highest daily score wins</small>${state.permissions.isOfficer ? `<button class="primary-button" type="submit">${published ? "Scores locked" : "Save scores"}</button>` : ""}</div>
    <div class="vs-scoreboard-team vs-scoreboard-opponent ${outcome === "Loss" ? "vs-team-leading" : outcome === "Win" ? "vs-team-trailing" : ""}">
      <h3>${escapeHtml(week.opponent || "Opponent")}</h3>
      <label>Daily team points<input name="opponentScore" type="number" min="0" value="${Number(result.opponentScore || 0)}" required aria-label="${escapeHtml(week.opponent || "Opponent")} daily team points"></label>
      <small>Daily score · ${formatVsScore(result.opponentScore)}</small>
    </div>
  </article>` : emptyState("Create a VS week in the Create tab to begin scoring.");
  const ourScoreInput = elements.vsDailyResultForm.querySelector("[name='ourScore']");
  const opponentScoreInput = elements.vsDailyResultForm.querySelector("[name='opponentScore']");
  if (ourScoreInput) ourScoreInput.value = Number(result.ourScore || 0);
  if (opponentScoreInput) opponentScoreInput.value = Number(result.opponentScore || 0);
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
  const dayLabel = days.find((day) => day.date === selectedVsDate)?.label || "Selected day";
  const overviewDaily = published ? [...dailyScores].sort((left, right) => Number(right.score) - Number(left.score)) : [];
  elements.vsSummary.innerHTML = week ? `<section class="panel vs-overview-header"><div><p class="eyebrow">VS Overview</p><h3>EWAR <small>Ewar: Lords of War</small></h3></div><span class="vs-versus">vs.</span><div><p class="eyebrow">Opponent</p><h3>${escapeHtml(week.opponent)} <small>Server ${escapeHtml(week.server)}</small></h3></div><dl><div><dt>Current day</dt><dd>${escapeHtml(dayLabel)}</dd></div><div><dt>Status</dt><dd>${published ? "Published" : "Auditing"}</dd></div></dl></section>` : emptyState("No active VS week.");
  elements.vsTopThree.innerHTML = `<div class="vs-ranking-grid">${renderVsRanking("Weekly Top 10", ranking, "total", "Published active-week scores")}${renderVsRanking("Today's Top 10", overviewDaily, "score", `${dayLabel} · ${published ? "Published" : "Auditing"}`)}</div>`;
  const daily = [...dailyScores].sort((left, right) => Number(right.score) - Number(left.score));
  const filteredDaily = selectedVsScoreFilter === "top10" ? daily.slice(0, 10)
    : selectedVsScoreFilter === "below-target" ? daily.filter((entry) => Number(entry.score) < 7_200_000)
    : daily;
  elements.vsScoreFilter.value = selectedVsScoreFilter;
  elements.vsDailyTables.innerHTML = week ? `<section class="vs-daily-panel"><div class="assignment-heading"><h3>${escapeHtml(days.find((day) => day.date === selectedVsDate)?.label || "")} Member Scores</h3><span>${published ? "Published" : "Auditing"}</span></div>
      <div class="table-frame"><table><thead><tr><th>Daily rank</th><th>Player</th><th>Score</th><th>Source</th>${state.permissions.isOfficer ? "<th>Action</th>" : ""}</tr></thead>
      <tbody>${filteredDaily.map((entry) => `<tr><td>#${daily.indexOf(entry) + 1}</td><td>${escapeHtml(state.players.find((player) => player.id === entry.playerId)?.gameName || entry.playerName)}</td><td>${formatVsScore(entry.score, entry.hasScore !== false)}</td><td>${escapeHtml(entry.source)} · ${escapeHtml(entry.auditStatus || "reviewed")}</td>${state.permissions.isOfficer ? `<td>${published ? "Locked" : `<button class="danger-button" type="button" data-delete-vs-score="${escapeHtml(entry.id)}">Delete</button>`}</td>` : ""}</tr>`).join("") || `<tr><td colspan="${state.permissions.isOfficer ? 5 : 4}">No scores match this filter. Zero and blank are tracked separately.</td></tr>`}</tbody></table></div></section>`
  : "";
}

function duelRankingTable(rankings = [], editable = false) {
  const rowCount = editable ? 16 : Math.min(16, rankings.length);
  const rows = rankings.length || editable
    ? Array.from({ length: rowCount }, (_, index) => rankings[index] || ({ rank: index + 1, alliance: "", weeks: [] }))
    : [];
  if (!rows.length) return `<div class="table-frame duel-ranking-table"><table><thead><tr><th>Ranking</th><th>Alliance</th><th>Week 1</th><th>Week 2</th><th>Week 3</th><th>Week 4</th></tr></thead><tbody>${Array.from({ length: 16 }, (_, index) => `<tr><td>#${index + 1}</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>`).join("")}</tbody></table></div>`;
  return `<div class="table-frame duel-ranking-table"><table><thead><tr><th>Ranking</th><th>Alliance</th><th>Week 1</th><th>Week 2</th><th>Week 3</th><th>Week 4</th></tr></thead>
    <tbody>${rows.map((row, rowIndex) => `<tr data-vs-standing-row><td>${editable ? `<input data-standing-rank type="number" value="${rowIndex + 1}" readonly>` : `#${rowIndex + 1}`}</td><td>${editable ? `<input data-standing-alliance value="${escapeHtml(row.alliance || "")}" placeholder="[TAG] Alliance name">` : renderDuelLeagueTeam(row.alliance)}</td>${Array.from({ length: 4 }, (_, index) => {
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
    `<div class="import-match"><strong>${escapeHtml(match.name)}</strong><span>${formatVsScore(match.score)}</span><small>${escapeHtml(match.nameStatus || "Exact Match")} · OCR suggestion</small></div>`
  ).join("") + unmatched.map((item) => `<div class="unmatched-card">
    <div><strong>${formatVsScore(item.score, item.hasScore !== false)}</strong><p class="muted">Detected: ${escapeHtml(item.ocrName)} · ${escapeHtml(item.nameStatus || "No Match")}</p><small>Source row: ${escapeHtml(item.sourceLine || "Not available")}</small></div>
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
  const submitter = event.submitter;
  try {
    submitter.disabled = true;
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData);
    const managed = await api.createManagedEvent({ type: "vsWeek", title: `VS Week vs ${payload.opponent}`, startDate: payload.beginDate, details: { duelLeagueCode: payload.duelLeagueCode, duelLeagueWeek: Number(payload.duelLeagueWeek), opponent: payload.opponent, opponentServer: payload.server, opponentMembers: Number(payload.opponentMembers) }, action: submitter.value });
    if (submitter.value === "publish") {
      state = await api.createVsWeek(payload);
      selectedVsWeekId = state.vsWeeks[0]?.id || "";
    }
    selectedVsDate = "";
    event.currentTarget.reset();
    setDefaultVsMonday();
    render();
    setStatus(managed.status === "draft" ? "VS week draft saved" : "VS week published with a blank Duel League standings table");
  } catch (error) {
    setStatus(error.message, true);
  } finally { submitter.disabled = false; }
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
      setStatus(latestVsAudit.publishable ? (latestVsAudit.hasWarnings ? "VS day is publishable with warnings" : "VS daily audit passed") : "VS daily audit found critical issues", !latestVsAudit.publishable);
    } else {
      if (latestVsAudit?.hasWarnings) {
        const warningText = `Publish with warnings?\n\n${latestVsAudit.missingPlayers.length} players have no score\n${latestVsAudit.zeroScores?.length || 0} players have a score of 0\n\nOnly reviewed rows will be published. Return to Audit by selecting Cancel.`;
        if (!confirm(warningText)) return;
      }
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
  return `
    <tr class="roster-member-row alliance-personnel-row ${member.active ? "" : "inactive"}">
      <td data-label="Member"><div class="personnel-member-cell">${memberMiniProfile(member, `${member.rank || "Member"}${member.previousNames.length ? " · Name updated" : ""}`)}${member.isOfficer ? `<span class="personnel-officer-badge">Officer</span>` : ""}</div></td>
      <td data-label="Role"><span class="roster-rank-badge rank-${escapeHtml(member.rank)}">${escapeHtml(member.rank || "Member")}</span></td>
      <td data-label="THP"><strong>${escapeHtml(formatThp(member.thp))}</strong>${member.thpVerifiedAt ? `<small class="personnel-verified">Verified</small>` : ""}</td>
      <td data-label="Team">${escapeHtml(member.team)}</td>
      <td data-label="Unit">${escapeHtml(member.unit)}</td>
      <td data-label="Availability">${personnelStatusBadge(member.availability)}</td>
      <td data-label="Confirmation">${personnelStatusBadge(member.confirmation)}</td>
      <td data-label="Registration">${personnelStatusBadge(member.registrationStatus)}</td>
      <td data-label="Last Updated"><time datetime="${escapeHtml(member.updatedAt || "")}">${escapeHtml(member.updatedAt ? formatDateTime(member.updatedAt) : "Not recorded")}</time></td>
      <td data-label="Actions"><button class="secondary-button" type="button" data-mini-profile="${escapeHtml(member.id)}">View Profile</button></td>
    </tr>
  `;
}

function formatThp(value) {
  const amount = Number(value || 0);
  if (!amount) return "Not updated";
  if (amount >= 1_000_000_000_000) return `${(amount / 1_000_000_000_000).toFixed(2).replace(/\.00$/, "")}T THP`;
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2).replace(/\.00$/, "")}B THP`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2).replace(/\.00$/, "")}M THP`;
  return `${amount.toLocaleString()} THP`;
}

function personnelStatusBadge(value) {
  const normalized = String(value || "Unknown").toLowerCase().replaceAll(" ", "-");
  const tone = ["ready", "confirmed", "registered", "active"].includes(normalized) ? "positive" : ["unavailable", "declined", "inactive", "duplicate-match", "needs-review"].includes(normalized) ? "negative" : "pending";
  return `<span class="personnel-status personnel-status-${tone}">${escapeHtml(value || "Unknown")}</span>`;
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
  return sanitizeDisplayText(value).replace(/[&<>"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;"
  })[character]);
}

function sanitizeDisplayText(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/\u0001/g, "")
    .replace(/\^A/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
