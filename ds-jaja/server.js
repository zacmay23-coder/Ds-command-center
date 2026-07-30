import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  addEvent,
  addPlayer,
  addStrategyTemplate,
  applyResultMatchFix,
  applyResultScreenshotMatches,
  applyTemplate,
  archiveBattle,
  changeEventStatus,
  clearBattleHistory,
  deleteBattle,
  deleteDraftEvent,
  deletePlayerProfile,
  duplicateEvent,
  getAudit,
  getClientState,
  getDataQuality,
  getEventBundle,
  getOrCreateUser,
  getParticipation,
  getPlayerHistory,
  getState,
  listEvents,
  listAvailablePlayerProfiles,
  listPlayers,
  listStrategyTemplates,
  listUsers,
  linkOwnPlayer,
  replaceState,
  resetWeek,
  saveState,
  sanitizeLegacyText,
  migratePrivateMemberData,
  subscribe,
  updateEvent,
  updateEventParticipant,
  updateAppliedStrategyOrder,
  updateMember,
  updatePlayer,
  updateSettings,
  updateStrategyTemplate,
  updateUser,
  updateOwnProfile,
  createAllianceWeeklyEvent,
  updateAllianceWeeklyEvent,
  deleteAllianceWeeklyEvent,
  createThemeWeek,
  updateThemeWeek,
  submitThemeEntry,
  submitThemeEntryForPlayer,
  voteThemeWeek,
  commentThemeWeek,
  acknowledgeThemeWeek,
  deleteThemeWeek,
  addMemberNotice,
  addOfficerQuestion,
  addAnnouncement,
  acknowledgeAnnouncement,
  replyToAnnouncement,
  toggleAnnouncementHelpful,
  deleteAnnouncement,
  sendPrivateMessage,
  markPrivateMessageRead,
  postDailyChatMessage,
  saveJournalItem,
  deleteJournalItem,
  saveGoal,
  deleteGoal,
  updateAchievement,
  updateAchievementDefinitions,
  scheduleLeadershipMeeting,
  addLeadershipPost,
  requestLeadershipMeeting,
  deleteLeadershipPost,
  saveVsScore,
  applyVsScreenshotMatches,
  deleteVsScore
  ,createVsWeek
  ,updateVsDayResult
  ,deleteVsWeek
  ,archiveDuelLeagueGroup
  ,auditVsDay
  ,publishVsDay
  ,updateVsWeekStandings
  ,clearVsWeekStandings
} from "./src/dataStore.js";
import { sanitizeTextFields } from "./src/textSanitization.js";
import { parseDuelLeagueStandings, readResultScreenshot, readScreenshotText } from "./src/resultScreenshotReader.js";
import { canEditOwnAvailability, requireRole, ROLES } from "./src/permissions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const port = Number(process.env.PORT || 8082);
const firebaseApiKey = "AIzaSyCnccjJ6h-RlTU1Qbp3Zgd2WQag0YVwsWs";

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"]
]);

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }

    await serveStatic(url, response);
  } catch (error) {
    sendJson(response, error.statusCode || 500, {
      error: error.message || "Server error",
      details: error.details,
      latest: error.latest
    });
  }
});

server.listen(port, () => {
  console.log(`Desert Storm Command Center running at http://localhost:${port}`);
});

async function handleApi(request, response, url) {
  url.pathname = normalizeApiPath(url.pathname);

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Origin": request.headers.origin || "*",
      "Cache-Control": "no-store"
    });
    response.end();
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, { ok: true, service: "ds-command-center" });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/sign-in") {
    sendJson(response, 200, await proxyFirebaseAuth("accounts:signInWithPassword", await readJsonBody(request)));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/register") {
    sendJson(response, 200, await proxyFirebaseAuth("accounts:signUp", await readJsonBody(request)));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/live") {
    const firebaseUser = await verifyFirebaseToken(url.searchParams.get("token") || "");
    if (!firebaseUser) {
      sendJson(response, 401, { error: "Your sign-in session expired. Please sign in again." });
      return;
    }
    await openEventStream(response);
    return;
  }

  const firebaseUser = await requireFirebaseUser(request, response);
  if (!firebaseUser) return;
  const user = await getOrCreateUser(firebaseUser);

  if (request.method === "GET" && url.pathname === "/api/me") {
    sendJson(response, 200, user);
    return;
  }
  if (request.method === "PATCH" && url.pathname === "/api/me/profile") {
    sendJson(response, 200, await updateOwnProfile(user.uid, await readJsonBody(request)));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/state") {
    sendJson(response, 200, await getClientState(user));
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/member-notices") {
    sendJson(response, 201, await addMemberNotice(await readJsonBody(request), user));
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/officer-questions") {
    sendJson(response, 201, await addOfficerQuestion(await readJsonBody(request), user));
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/announcements") {
    requireRole(user, ROLES.OFFICER);
    sendJson(response, 201, await addAnnouncement(await readJsonBody(request), user));
    return;
  }
  const announcementRoute = url.pathname.match(/^\/api\/announcements\/([^/]+)$/);
  if (announcementRoute && request.method === "DELETE") {
    requireRole(user, ROLES.OFFICER);
    sendJson(response, 200, await deleteAnnouncement(decodeURIComponent(announcementRoute[1])));
    return;
  }
  const announcementAckRoute = url.pathname.match(/^\/api\/announcements\/([^/]+)\/acknowledge$/);
  if (announcementAckRoute && request.method === "POST") {
    sendJson(response, 200, await acknowledgeAnnouncement(decodeURIComponent(announcementAckRoute[1]), user));
    return;
  }
  const announcementReplyRoute = url.pathname.match(/^\/api\/announcements\/([^/]+)\/replies$/);
  if (announcementReplyRoute && request.method === "POST") {
    sendJson(response, 201, await replyToAnnouncement(
      decodeURIComponent(announcementReplyRoute[1]),
      await readJsonBody(request),
      user
    ));
    return;
  }
  const announcementHelpfulRoute = url.pathname.match(/^\/api\/announcements\/([^/]+)\/helpful$/);
  if (announcementHelpfulRoute && request.method === "POST") {
    sendJson(response, 200, await toggleAnnouncementHelpful(
      decodeURIComponent(announcementHelpfulRoute[1]),
      user
    ));
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/private-messages") {
    sendJson(response, 201, await sendPrivateMessage(await readJsonBody(request), user));
    return;
  }
  const privateMessageRoute = url.pathname.match(/^\/api\/private-messages\/([^/]+)\/read$/);
  if (privateMessageRoute && request.method === "PATCH") {
    sendJson(response, 200, await markPrivateMessageRead(decodeURIComponent(privateMessageRoute[1]), user));
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/daily-chat") {
    sendJson(response, 201, await postDailyChatMessage(await readJsonBody(request), user));
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/journal") {
    sendJson(response, 201, await saveJournalItem(await readJsonBody(request), user));
    return;
  }
  const journalRoute = url.pathname.match(/^\/api\/journal\/([^/]+)$/);
  if (journalRoute && request.method === "DELETE") {
    sendJson(response, 200, await deleteJournalItem(decodeURIComponent(journalRoute[1]), user));
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/goals") {
    sendJson(response, 201, await saveGoal(await readJsonBody(request), user));
    return;
  }
  const goalRoute = url.pathname.match(/^\/api\/goals\/([^/]+)$/);
  if (goalRoute && request.method === "DELETE") {
    sendJson(response, 200, await deleteGoal(decodeURIComponent(goalRoute[1]), user));
    return;
  }
  const achievementRoute = url.pathname.match(/^\/api\/achievements\/([^/]+)$/);
  if (achievementRoute && request.method === "PATCH") {
    sendJson(response, 200, await updateAchievement(decodeURIComponent(achievementRoute[1]), await readJsonBody(request), user));
    return;
  }
  if (request.method === "PATCH" && url.pathname === "/api/admin/achievement-definitions") {
    requireRole(user, ROLES.ADMIN);
    sendJson(response, 200, await updateAchievementDefinitions(await readJsonBody(request), user));
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/leadership/meetings") {
    requireRole(user, ROLES.OFFICER);
    sendJson(response, 201, await scheduleLeadershipMeeting(await readJsonBody(request), user));
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/leadership/posts") {
    requireRole(user, ROLES.OFFICER);
    sendJson(response, 201, await addLeadershipPost(await readJsonBody(request), user));
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/leadership/requests") {
    requireRole(user, ROLES.OFFICER);
    sendJson(response, 201, await requestLeadershipMeeting(await readJsonBody(request), user));
    return;
  }
  const leadershipPostRoute = url.pathname.match(/^\/api\/leadership\/posts\/([^/]+)$/);
  if (leadershipPostRoute && request.method === "DELETE") {
    requireRole(user, ROLES.OFFICER);
    sendJson(response, 200, await deleteLeadershipPost(decodeURIComponent(leadershipPostRoute[1]), user));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/alliance-weekly-events") {
    requireRole(user, ROLES.OFFICER);
    sendJson(response, 201, await createAllianceWeeklyEvent(await readJsonBody(request), user));
    return;
  }
  const allianceWeeklyEventRoute = url.pathname.match(/^\/api\/alliance-weekly-events\/([^/]+)$/);
  if (allianceWeeklyEventRoute && request.method === "PATCH") {
    requireRole(user, ROLES.OFFICER);
    sendJson(response, 200, await updateAllianceWeeklyEvent(
      decodeURIComponent(allianceWeeklyEventRoute[1]),
      await readJsonBody(request),
      user
    ));
    return;
  }
  if (allianceWeeklyEventRoute && request.method === "DELETE") {
    requireRole(user, ROLES.OFFICER);
    sendJson(response, 200, await deleteAllianceWeeklyEvent(decodeURIComponent(allianceWeeklyEventRoute[1])));
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/theme-weeks") {
    requireRole(user, ROLES.OFFICER);
    sendJson(response, 201, await createThemeWeek(await readJsonBody(request), user));
    return;
  }
  const themeRoute = url.pathname.match(/^\/api\/theme-weeks\/([^/]+)$/);
  if (themeRoute && request.method === "PATCH") {
    requireRole(user, ROLES.OFFICER);
    sendJson(response, 200, await updateThemeWeek(decodeURIComponent(themeRoute[1]), await readJsonBody(request), user));
    return;
  }
  if (themeRoute && request.method === "DELETE") {
    requireRole(user, ROLES.OFFICER);
    sendJson(response, 200, await deleteThemeWeek(decodeURIComponent(themeRoute[1])));
    return;
  }
  const themeActionRoute = url.pathname.match(/^\/api\/theme-weeks\/([^/]+)\/(submit|vote|comment|acknowledge)$/);
  if (themeActionRoute && request.method === "POST") {
    const themeId = decodeURIComponent(themeActionRoute[1]);
    const action = themeActionRoute[2];
    const body = await readJsonBody(request);
    const result = action === "submit" ? await submitThemeEntry(themeId, body, user)
      : action === "vote" ? await voteThemeWeek(themeId, body.finalistId, user)
      : action === "comment" ? await commentThemeWeek(themeId, body.text, user)
      : await acknowledgeThemeWeek(themeId, user);
    sendJson(response, 200, result);
    return;
  }
  const themeOfficerSubmissionRoute = url.pathname.match(/^\/api\/theme-weeks\/([^/]+)\/officer-submission$/);
  if (themeOfficerSubmissionRoute && request.method === "POST") {
    requireRole(user, ROLES.OFFICER);
    sendJson(response, 200, await submitThemeEntryForPlayer(
      decodeURIComponent(themeOfficerSubmissionRoute[1]),
      await readJsonBody(request),
      user
    ));
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/theme-weeks/ocr") {
    const image = await readMultipartImage(request);
    const currentState = await getState();
    const roster = Object.values(currentState.players).map((player) => ({ ...player, name: player.gameName }));
    const result = await readResultScreenshot(image.buffer, roster);
    sendJson(response, 200, { text: result.text || "" });
    return;
  }

  if (request.method === "PUT" && url.pathname === "/api/state") {
    requireRole(user, ROLES.ADMIN);
    const body = await readJsonBody(request);
    sendJson(response, 200, await replaceState(body));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/events") {
    sendJson(response, 200, await listEvents(user));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/events") {
    requireRole(user, ROLES.OFFICER);
    sendJson(response, 201, await addEvent(await readJsonBody(request), user));
    return;
  }

  const eventRoute = url.pathname.match(/^\/api\/events\/([^/]+)$/);
  if (eventRoute && request.method === "GET") {
    sendJson(response, 200, await getEventBundle(decodeURIComponent(eventRoute[1]), user));
    return;
  }
  if (eventRoute && request.method === "PATCH") {
    requireRole(user, ROLES.OFFICER);
    sendJson(response, 200, await updateEvent(decodeURIComponent(eventRoute[1]), await readJsonBody(request), user));
    return;
  }
  if (eventRoute && request.method === "DELETE") {
    requireRole(user, ROLES.OFFICER);
    sendJson(response, 200, await deleteDraftEvent(decodeURIComponent(eventRoute[1]), user));
    return;
  }

  const lifecycleRoute = url.pathname.match(/^\/api\/events\/([^/]+)\/(publish|start|complete|archive|duplicate)$/);
  if (lifecycleRoute && request.method === "POST") {
    requireRole(user, ROLES.OFFICER);
    const [, rawEventId, action] = lifecycleRoute;
    const body = await readJsonBody(request);
    const eventId = decodeURIComponent(rawEventId);
    const result = action === "duplicate"
      ? await duplicateEvent(eventId, body, user)
      : await changeEventStatus(eventId, action, user, body.reason || "");
    sendJson(response, 200, result);
    return;
  }

  const participantsRoute = url.pathname.match(/^\/api\/events\/([^/]+)\/participants$/);
  if (participantsRoute && request.method === "GET") {
    sendJson(response, 200, (await getEventBundle(decodeURIComponent(participantsRoute[1]), user)).participants);
    return;
  }

  const participantRoute = url.pathname.match(/^\/api\/events\/([^/]+)\/participants\/([^/]+)$/);
  if (participantRoute && request.method === "PATCH") {
    requireRole(user, ROLES.OFFICER);
    sendJson(response, 200, await updateEventParticipant(
      decodeURIComponent(participantRoute[1]),
      decodeURIComponent(participantRoute[2]),
      await readJsonBody(request),
      user
    ));
    return;
  }

  const availabilityRoute = url.pathname.match(/^\/api\/events\/([^/]+)\/availability$/);
  if (availabilityRoute && request.method === "POST") {
    const body = await readJsonBody(request);
    if (!canEditOwnAvailability(user, body.playerId)) {
      sendJson(response, 403, { error: "You can only update your own availability" });
      return;
    }
    sendJson(response, 200, await updateEventParticipant(
      decodeURIComponent(availabilityRoute[1]), body.playerId, body, user, true
    ));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/players") {
    sendJson(response, 200, await listPlayers(user));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/users") {
    requireRole(user, ROLES.OFFICER);
    sendJson(response, 200, await listUsers());
    return;
  }
  if (request.method === "GET" && ["/api/available-player-profiles", "/api/profile-options", "/api/profiles"].includes(url.pathname)) {
    sendJson(response, 200, await listAvailablePlayerProfiles(user.uid));
    return;
  }
  if (request.method === "POST" && ["/api/link-player", "/api/profile-link"].includes(url.pathname)) {
    const body = await readJsonBody(request);
    sendJson(response, 200, await linkOwnPlayer(user.uid, body.playerId));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/data-quality") {
    requireRole(user, ROLES.OFFICER);
    sendJson(response, 200, await getDataQuality());
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/audit") {
    requireRole(user, ROLES.ADMIN);
    sendJson(response, 200, await getAudit());
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/players") {
    requireRole(user, ROLES.OFFICER);
    sendJson(response, 201, await addPlayer(await readJsonBody(request), user));
    return;
  }
  const playerRoute = url.pathname.match(/^\/api\/players\/([^/]+)$/);
  if (playerRoute && request.method === "PATCH") {
    requireRole(user, ROLES.OFFICER);
    sendJson(response, 200, await updatePlayer(decodeURIComponent(playerRoute[1]), await readJsonBody(request), user));
    return;
  }
  if (playerRoute && request.method === "DELETE") {
    requireRole(user, ROLES.ADMIN);
    sendJson(response, 200, await deletePlayerProfile(decodeURIComponent(playerRoute[1]), user));
    return;
  }
  const historyRoute = url.pathname.match(/^\/api\/players\/([^/]+)\/history$/);
  if (historyRoute && request.method === "GET") {
    const playerId = decodeURIComponent(historyRoute[1]);
    if (user.role === "member" && user.playerId !== playerId) {
      sendJson(response, 403, { error: "Members can only view their own history" });
      return;
    }
    sendJson(response, 200, await getPlayerHistory(playerId, user));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/participation") {
    requireRole(user, ROLES.OFFICER);
    sendJson(response, 200, await getParticipation(Object.fromEntries(url.searchParams.entries())));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/strategy-templates") {
    requireRole(user, ROLES.OFFICER);
    sendJson(response, 200, await listStrategyTemplates());
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/strategy-templates") {
    requireRole(user, ROLES.OFFICER);
    sendJson(response, 201, await addStrategyTemplate(await readJsonBody(request), user));
    return;
  }
  const templateRoute = url.pathname.match(/^\/api\/strategy-templates\/([^/]+)$/);
  if (templateRoute && request.method === "PATCH") {
    requireRole(user, ROLES.OFFICER);
    sendJson(response, 200, await updateStrategyTemplate(decodeURIComponent(templateRoute[1]), await readJsonBody(request), user));
    return;
  }
  const applyStrategyRoute = url.pathname.match(/^\/api\/events\/([^/]+)\/apply-strategy$/);
  if (applyStrategyRoute && request.method === "POST") {
    requireRole(user, ROLES.OFFICER);
    const body = await readJsonBody(request);
    sendJson(response, 200, await applyTemplate(decodeURIComponent(applyStrategyRoute[1]), body.templateId, body.team, user));
    return;
  }
  const strategyOrderRoute = url.pathname.match(/^\/api\/events\/([^/]+)\/strategy\/(A|B)$/);
  if (strategyOrderRoute && request.method === "PATCH") {
    requireRole(user, ROLES.OFFICER);
    await updateAppliedStrategyOrder(
      decodeURIComponent(strategyOrderRoute[1]),
      strategyOrderRoute[2],
      await readJsonBody(request),
      user
    );
    sendJson(response, 200, await getClientState(user));
    return;
  }
  const auditRoute = url.pathname.match(/^\/api\/events\/([^/]+)\/audit$/);
  if (auditRoute && request.method === "GET") {
    requireRole(user, ROLES.ADMIN);
    sendJson(response, 200, await getAudit(decodeURIComponent(auditRoute[1])));
    return;
  }

  const userRoute = url.pathname.match(/^\/api\/users\/([^/]+)$/);
  if (userRoute && request.method === "PATCH") {
    requireRole(user, ROLES.OFFICER);
    sendJson(response, 200, await updateUser(decodeURIComponent(userRoute[1]), await readJsonBody(request), user));
    return;
  }

  if (request.method === "PATCH" && url.pathname.startsWith("/api/members/")) {
    requireRole(user, ROLES.OFFICER);
    const memberId = decodeURIComponent(url.pathname.split("/").pop());
    const patch = await readJsonBody(request);
    await updateMember(memberId, patch);
    sendJson(response, 200, await getClientState(user));
    return;
  }

  if (request.method === "PATCH" && url.pathname === "/api/settings") {
    requireRole(user, ROLES.OFFICER);
    const patch = await readJsonBody(request);
    await updateSettings(patch);
    sendJson(response, 200, await getClientState(user));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/archive-battle") {
    requireRole(user, ROLES.OFFICER);
    const payload = await readJsonBody(request);
    await archiveBattle(payload);
    sendJson(response, 201, await getClientState(user));
    return;
  }

  if (request.method === "DELETE" && url.pathname === "/api/battles") {
    requireRole(user, ROLES.ADMIN);
    await clearBattleHistory();
    sendJson(response, 200, await getClientState(user));
    return;
  }

  if (request.method === "DELETE" && url.pathname.startsWith("/api/battles/")) {
    requireRole(user, ROLES.OFFICER);
    const battleId = decodeURIComponent(url.pathname.split("/").pop());
    await deleteBattle(battleId);
    sendJson(response, 200, await getClientState(user));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/import-results-screenshot") {
    requireRole(user, ROLES.OFFICER);
    const image = await readMultipartImage(request);
    const team = url.searchParams.get("team") || "A";
    const currentState = await getState();
    const roster = Object.values(currentState.players).map((player) => ({ ...player, name: player.gameName }));
    const importResult = await readResultScreenshot(image.buffer, roster);
    await applyResultScreenshotMatches(importResult.matches, team);
    sendJson(response, 200, {
      state: await getClientState(user),
      matches: importResult.matches,
      unmatched: importResult.unmatched,
      text: importResult.text
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/vs-scores") {
    requireRole(user, ROLES.OFFICER);
    await saveVsScore(await readJsonBody(request), user);
    sendJson(response, 201, await getClientState(user));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/vs-weeks") {
    requireRole(user, ROLES.OFFICER);
    await createVsWeek(await readJsonBody(request), user);
    sendJson(response, 201, await getClientState(user));
    return;
  }

  const vsStandingsRoute = url.pathname.match(/^\/api\/vs-weeks\/([^/]+)\/standings$/);
  if (vsStandingsRoute && request.method === "POST") {
    requireRole(user, ROLES.OFFICER);
    const image = await readMultipartImage(request);
    const parsed = parseDuelLeagueStandings(await readScreenshotText(image.buffer));
    await updateVsWeekStandings(decodeURIComponent(vsStandingsRoute[1]), parsed.standings, user);
    sendJson(response, 200, { state: await getClientState(user), ...parsed });
    return;
  }
  if (vsStandingsRoute && request.method === "DELETE") {
    requireRole(user, ROLES.OFFICER);
    await clearVsWeekStandings(decodeURIComponent(vsStandingsRoute[1]), user);
    sendJson(response, 200, await getClientState(user));
    return;
  }
  if (vsStandingsRoute && request.method === "PATCH") {
    requireRole(user, ROLES.OFFICER);
    const payload = await readJsonBody(request);
    await updateVsWeekStandings(decodeURIComponent(vsStandingsRoute[1]), payload.standings, user);
    sendJson(response, 200, await getClientState(user));
    return;
  }

  const duelArchiveRoute = url.pathname.match(/^\/api\/duel-league-groups\/([^/]+)\/archive$/);
  if (duelArchiveRoute && request.method === "POST") {
    requireRole(user, ROLES.OFFICER);
    await archiveDuelLeagueGroup(decodeURIComponent(duelArchiveRoute[1]), user);
    sendJson(response, 200, await getClientState(user));
    return;
  }

  const vsWeekResultRoute = url.pathname.match(/^\/api\/vs-weeks\/([^/]+)\/result$/);
  if (vsWeekResultRoute && request.method === "PATCH") {
    requireRole(user, ROLES.OFFICER);
    await updateVsDayResult(decodeURIComponent(vsWeekResultRoute[1]), await readJsonBody(request), user);
    sendJson(response, 200, await getClientState(user));
    return;
  }

  const vsDayAuditRoute = url.pathname.match(/^\/api\/vs-weeks\/([^/]+)\/days\/([^/]+)\/audit$/);
  if (vsDayAuditRoute && request.method === "GET") {
    requireRole(user, ROLES.ADMIN);
    sendJson(response, 200, await auditVsDay(decodeURIComponent(vsDayAuditRoute[1]), decodeURIComponent(vsDayAuditRoute[2])));
    return;
  }

  const vsDayPublishRoute = url.pathname.match(/^\/api\/vs-weeks\/([^/]+)\/days\/([^/]+)\/publish$/);
  if (vsDayPublishRoute && request.method === "POST") {
    requireRole(user, ROLES.ADMIN);
    await publishVsDay(decodeURIComponent(vsDayPublishRoute[1]), decodeURIComponent(vsDayPublishRoute[2]), user);
    sendJson(response, 200, await getClientState(user));
    return;
  }

  const vsWeekRoute = url.pathname.match(/^\/api\/vs-weeks\/([^/]+)$/);
  if (vsWeekRoute && request.method === "DELETE") {
    requireRole(user, ROLES.OFFICER);
    await deleteVsWeek(decodeURIComponent(vsWeekRoute[1]), user);
    sendJson(response, 200, await getClientState(user));
    return;
  }

  const vsScoreRoute = url.pathname.match(/^\/api\/vs-scores\/([^/]+)$/);
  if (vsScoreRoute && request.method === "DELETE") {
    requireRole(user, ROLES.OFFICER);
    await deleteVsScore(decodeURIComponent(vsScoreRoute[1]), user);
    sendJson(response, 200, await getClientState(user));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/import-vs-screenshot") {
    requireRole(user, ROLES.OFFICER);
    const image = await readMultipartImage(request);
    const date = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
    const vsWeekId = url.searchParams.get("weekId") || "";
    const currentState = await getState();
    const roster = Object.values(currentState.players).map((player) => ({ ...player, name: player.gameName }));
    const importResult = await readResultScreenshot(image.buffer, roster);
    await applyVsScreenshotMatches(importResult.matches, date, user, vsWeekId);
    sendJson(response, 200, { state: await getClientState(user), matches: importResult.matches, unmatched: importResult.unmatched });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/result-match-fix") {
    requireRole(user, ROLES.OFFICER);
    const payload = await readJsonBody(request);
    await applyResultMatchFix(payload);
    sendJson(response, 200, await getClientState(user));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/reset-week") {
    requireRole(user, ROLES.OFFICER);
    sendJson(response, 410, { error: "Weekly reset was replaced by Create Next Battle" });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/save") {
    requireRole(user, ROLES.ADMIN);
    sendJson(response, 200, await saveState());
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/admin/sanitize-text") {
    requireRole(user, ROLES.ADMIN);
    sendJson(response, 200, await sanitizeLegacyText(await readJsonBody(request), user));
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/admin/migrate-private-data") {
    requireRole(user, ROLES.ADMIN);
    sendJson(response, 200, await migratePrivateMemberData(await readJsonBody(request), user));
    return;
  }

  sendJson(response, 404, {
    error: `API route not found: ${request.method} ${url.pathname}`,
    hint: "Confirm that the web client and Node server are running from the same application version."
  });
}

function normalizeApiPath(pathname) {
  const normalized = String(pathname || "").replace(/\/{2,}/g, "/").replace(/\/+$/, "");
  return normalized || "/";
}

async function requireFirebaseUser(request, response) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";

  if (!token) {
    sendJson(response, 401, { error: "Sign in before opening the Command Center" });
    return null;
  }

  const user = await verifyFirebaseToken(token);
  if (!user) {
    sendJson(response, 401, { error: "Your sign-in session expired. Please sign in again." });
  }
  return user;
}

async function verifyFirebaseToken(token) {
  if (!token) return null;
  try {
    const lookupResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseApiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token })
      }
    );
    const payload = await lookupResponse.json();

    if (!lookupResponse.ok || !payload.users?.length) {
      return null;
    }

    return payload.users[0];
  } catch {
    return null;
  }
}

async function proxyFirebaseAuth(action, input) {
  const email = String(input.email || "").trim();
  const password = String(input.password || "");
  if (!email || !password) throw statusError(422, "Email and password are required");

  const authResponse = await fetch(
    `https://identitytoolkit.googleapis.com/v1/${action}?key=${encodeURIComponent(firebaseApiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    }
  );
  const payload = await authResponse.json();
  if (!authResponse.ok) {
    const error = statusError(authResponse.status, formatFirebaseAuthError(payload?.error?.message));
    error.details = { code: payload?.error?.message || "AUTH_ERROR" };
    throw error;
  }
  return payload;
}

function formatFirebaseAuthError(code = "AUTH_ERROR") {
  const messages = {
    EMAIL_EXISTS: "That email is already registered.",
    EMAIL_NOT_FOUND: "No account exists for that email.",
    INVALID_LOGIN_CREDENTIALS: "Incorrect email or password.",
    INVALID_PASSWORD: "Incorrect email or password.",
    WEAK_PASSWORD: "Use a password with at least 6 characters.",
    OPERATION_NOT_ALLOWED: "Enable Email/Password sign-in in Firebase Authentication.",
    TOO_MANY_ATTEMPTS_TRY_LATER: "Too many sign-in attempts. Try again later."
  };
  return messages[code] || String(code).replaceAll("_", " ");
}

async function openEventStream(response) {
  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });
  response.write(`event: connected\ndata: ${JSON.stringify({ connected: true })}\n\n`);
  const unsubscribe = subscribe((message) => {
    response.write(`event: update\ndata: ${JSON.stringify(message)}\n\n`);
  });
  response.on("close", unsubscribe);
}

async function serveStatic(url, response) {
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const requestedPath = path.normalize(path.join(publicDir, pathname));

  if (!requestedPath.startsWith(publicDir)) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  const content = await readFile(requestedPath);
  response.writeHead(200, {
    "Content-Type": mimeTypes.get(path.extname(requestedPath)) || "application/octet-stream",
    "Cache-Control": "no-store"
  });
  response.end(content);
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  });
  response.end(JSON.stringify(payload, null, 2));
}

function statusError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function readJsonBody(request) {
  let raw = "";

  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 10_000_000) {
      throw new Error("Request body is too large");
    }
  }

  return raw ? sanitizeTextFields(JSON.parse(raw)) : {};
}

async function readMultipartImage(request) {
  const contentType = request.headers["content-type"] || "";
  const boundary = contentType.match(/boundary="?([^";]+)"?/)?.[1];

  if (!boundary) {
    throw new Error("Upload must use multipart form data");
  }

  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    chunks.push(chunk);
    totalBytes += chunk.length;
    if (totalBytes > 20_000_000) {
      throw new Error("Screenshot upload is too large");
    }
  }

  const body = Buffer.concat(chunks);
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const start = body.indexOf(Buffer.from("\r\n\r\n"));
  const end = body.lastIndexOf(boundaryBuffer) - 2;

  if (start < 0 || end <= start) {
    throw new Error("Screenshot upload could not be read");
  }

  return { buffer: body.subarray(start + 4, end) };
}
