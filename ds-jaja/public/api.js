import { authFetch } from "./auth.js";

export const api = {
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
  async markPrivateMessageRead(id) {
    return request(`/api/private-messages/${encodeURIComponent(id)}/read`, { method: "PATCH", body: "{}" });
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
  },
  async sanitizeLegacyText(dryRun = true) {
    return request("/api/admin/sanitize-text", { method: "POST", body: JSON.stringify({ dryRun }) });
  },
  async saveGoal(payload) {
    return request("/api/goals", { method: "POST", body: JSON.stringify(payload) });
  },
  async deleteGoal(id) {
    return request(`/api/goals/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
  async updateAchievement(id, patch) {
    return request(`/api/achievements/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
  },
  async updateAchievementDefinitions(patch) {
    return request("/api/admin/achievement-definitions", { method: "PATCH", body: JSON.stringify(patch) });
  }
};

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
