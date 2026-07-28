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
  subscribe,
  updateEvent,
  updateEventParticipant,
  updateAppliedStrategyOrder,
  updateMember,
  updatePlayer,
  updateSettings,
  updateStrategyTemplate,
  updateUser
} from "./src/dataStore.js";
import { readResultScreenshot } from "./src/resultScreenshotReader.js";
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
  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, { ok: true, service: "ds-command-center" });
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

  if (request.method === "GET" && url.pathname === "/api/state") {
    sendJson(response, 200, await getClientState(user));
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
    requireRole(user, ROLES.ADMIN);
    sendJson(response, 200, await listUsers());
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/available-player-profiles") {
    sendJson(response, 200, await listAvailablePlayerProfiles());
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/link-player") {
    const body = await readJsonBody(request);
    sendJson(response, 200, await linkOwnPlayer(user.uid, body.playerId));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/data-quality") {
    requireRole(user, ROLES.OFFICER);
    sendJson(response, 200, await getDataQuality());
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
    requireRole(user, ROLES.OFFICER);
    sendJson(response, 200, await getAudit(decodeURIComponent(auditRoute[1])));
    return;
  }

  const userRoute = url.pathname.match(/^\/api\/users\/([^/]+)$/);
  if (userRoute && request.method === "PATCH") {
    requireRole(user, ROLES.ADMIN);
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
    requireRole(user, ROLES.ADMIN);
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

  sendJson(response, 404, { error: "API route not found" });
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
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload, null, 2));
}

async function readJsonBody(request) {
  let raw = "";

  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 10_000_000) {
      throw new Error("Request body is too large");
    }
  }

  return raw ? JSON.parse(raw) : {};
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
