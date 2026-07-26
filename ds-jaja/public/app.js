import { authFetch, clearSession, requireSession } from "./auth.js";

const api = {
  async getState() {
    return request("/api/state");
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

const units = [
  "Unassigned",
  "A",
  "B",
  "C",
  "D",
  "Strike Team",
  "Disrupters",
  "Scout + Support",
  "Reserve / Relief"
];

let state = null;

const elements = {
  saveStatus: document.querySelector("#saveStatus"),
  summaryCards: document.querySelector("#summaryCards"),
  readinessPanels: document.querySelector("#readinessPanels"),
  directoryRows: document.querySelector("#directoryRows"),
  resultRows: document.querySelector("#resultRows"),
  teamPanels: document.querySelector("#teamPanels"),
  assignmentBoard: document.querySelector("#assignmentBoard"),
  historyList: document.querySelector("#historyList"),
  searchInput: document.querySelector("#searchInput"),
  filterInput: document.querySelector("#filterInput"),
  strategyA: document.querySelector("#strategyA"),
  strategyB: document.querySelector("#strategyB"),
  battleForm: document.querySelector("#battleForm"),
  screenshotInput: document.querySelector("#screenshotInput"),
  importScreenshotButton: document.querySelector("#importScreenshotButton"),
  screenshotTeam: document.querySelector("#screenshotTeam"),
  importStatus: document.querySelector("#importStatus"),
  importMatches: document.querySelector("#importMatches")
};
const expandedPlayers = new Set();

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  requireSession();
  bindNavigation();
  bindControls();
  fillStrategySelects();
  await refreshState();
}

async function request(url, options = {}) {
  const response = await authFetch(url, options);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
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
  document.querySelector("#resetButton").addEventListener("click", resetWeek);
  elements.searchInput.addEventListener("input", renderDirectory);
  elements.filterInput.addEventListener("change", renderDirectory);
  elements.directoryRows.addEventListener("change", handleMemberChange);
  elements.directoryRows.addEventListener("click", handleDirectoryClick);
  elements.resultRows.addEventListener("change", handleMemberChange);
  elements.strategyA.addEventListener("change", () => saveSettings({ strategyA: elements.strategyA.value }));
  elements.strategyB.addEventListener("change", () => saveSettings({ strategyB: elements.strategyB.value }));
  elements.battleForm.addEventListener("submit", archiveBattle);
  elements.importScreenshotButton.addEventListener("click", importResultsScreenshot);
  elements.importMatches.addEventListener("click", handleMatchFixClick);
}

function logout() {
  clearSession();
  window.location.href = "/login.html";
}

function fillStrategySelects() {
  elements.strategyA.innerHTML = optionHtml(strategies);
  elements.strategyB.innerHTML = optionHtml(strategies);
}

function render() {
  renderDashboard();
  renderDirectory();
  renderTeams();
  renderAssignments();
  renderResults();
  renderHistory();
  elements.strategyA.value = state.settings.strategyA;
  elements.strategyB.value = state.settings.strategyB;
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
        <p class="muted">${starters.length}/20 starters · ${subs.length}/10 substitutes</p>
        ${teamList("Starters", starters)}
        ${teamList("Substitutes", subs)}
      </article>
    `;
  }).join("");
}

function renderAssignments() {
  const groups = selected().reduce((byUnit, member) => {
    const unit = member.unit || "Unassigned";
    if (!byUnit.has(unit)) byUnit.set(unit, []);
    byUnit.get(unit).push(member);
    return byUnit;
  }, new Map());

  elements.assignmentBoard.innerHTML = units
    .filter((unit) => groups.has(unit))
    .map((unit) => `
      <article class="panel">
        <h3>${escapeHtml(unit)}</h3>
        ${(groups.get(unit) || []).map((member) => `
          <div class="assignment-item">
            <strong>${escapeHtml(member.name)}</strong>
            <span>${escapeHtml(member.team)} · ${escapeHtml(member.type)} · ${escapeHtml(member.availability)}</span>
          </div>
        `).join("")}
      </article>
    `).join("") || `<article class="panel"><p>No players are selected yet.</p></article>`;
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
      <h3>${escapeHtml(battle.date)} · ${escapeHtml(battle.outcome)} vs ${escapeHtml(battle.opponent)}</h3>
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

async function handleMemberChange(event) {
  const field = event.target.dataset.field;
  const memberId = event.target.dataset.memberId;

  if (!field || !memberId) return;

  const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;

  try {
    setStatus("Saving...");
    state = await api.updateMember(memberId, { [field]: normalizeFieldValue(field, value) });
    render();
    setStatus(`Saved ${formatTime(state.updatedAt)}`);
  } catch (error) {
    setStatus(error.message, true);
    await refreshState();
  }
}

async function saveSettings(patch) {
  try {
    setStatus("Saving settings...");
    state = await api.updateSettings(patch);
    render();
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
      <td><input data-member-id="${member.id}" data-field="selected" type="checkbox" ${member.selected ? "checked" : ""}></td>
      <td>
        <button class="row-expander" type="button" data-expand-player="${member.id}" aria-expanded="${expanded}">${expanded ? "Hide" : "Show"}</button>
        <strong>${escapeHtml(member.name)}</strong>
        <span class="history-count">${history.length} DS</span>
      </td>
      <td>${escapeHtml(member.rank)}</td>
      <td><select data-member-id="${member.id}" data-field="team">${optionHtml(["Reserve", "A", "B"], member.team)}</select></td>
      <td><select data-member-id="${member.id}" data-field="type">${optionHtml(["Starter", "Sub"], member.type)}</select></td>
      <td><select data-member-id="${member.id}" data-field="unit">${optionHtml(units, member.unit)}</select></td>
      <td><select data-member-id="${member.id}" data-field="availability">${optionHtml(["Pending", "Confirmed", "Not available"], member.availability)}</select></td>
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
  const assigned = members.filter((member) => member.unit && member.unit !== "Unassigned").length;
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
      ${members.map((member) => `<p>${escapeHtml(member.name)} <span>${escapeHtml(member.unit)} · ${escapeHtml(member.availability)}</span></p>`).join("") || `<p class="muted">None assigned</p>`}
    </div>
  `;
}

function summaryCard(label, value) {
  return `<article class="summary-card"><span>${label}</span><strong>${value}</strong></article>`;
}

function optionHtml(items, current = "") {
  return items.map((item) => `<option ${item === current ? "selected" : ""}>${escapeHtml(item)}</option>`).join("");
}

function normalizeFieldValue(field, value) {
  if (field === "weekScore") return Number(value || 0);
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
