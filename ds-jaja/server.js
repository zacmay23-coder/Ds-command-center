import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyResultMatchFix,
  applyResultScreenshotMatches,
  archiveBattle,
  getState,
  replaceState,
  resetWeek,
  saveState,
  updateMember,
  updateSettings
} from "./src/dataStore.js";
import { readResultScreenshot } from "./src/resultScreenshotReader.js";

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
    sendJson(response, 500, { error: error.message || "Server error" });
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

  const user = await requireFirebaseUser(request, response);
  if (!user) return;

  if (request.method === "GET" && url.pathname === "/api/state") {
    sendJson(response, 200, await getState());
    return;
  }

  if (request.method === "PUT" && url.pathname === "/api/state") {
    const body = await readJsonBody(request);
    sendJson(response, 200, await replaceState(body));
    return;
  }

  if (request.method === "PATCH" && url.pathname.startsWith("/api/members/")) {
    const memberId = decodeURIComponent(url.pathname.split("/").pop());
    const patch = await readJsonBody(request);
    sendJson(response, 200, await updateMember(memberId, patch));
    return;
  }

  if (request.method === "PATCH" && url.pathname === "/api/settings") {
    const patch = await readJsonBody(request);
    sendJson(response, 200, await updateSettings(patch));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/archive-battle") {
    const payload = await readJsonBody(request);
    sendJson(response, 201, await archiveBattle(payload));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/import-results-screenshot") {
    const image = await readMultipartImage(request);
    const team = url.searchParams.get("team") || "A";
    const currentState = await getState();
    const importResult = await readResultScreenshot(image.buffer, currentState.members);
    const updatedState = await applyResultScreenshotMatches(importResult.matches, team);
    sendJson(response, 200, {
      state: updatedState,
      matches: importResult.matches,
      unmatched: importResult.unmatched,
      text: importResult.text
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/result-match-fix") {
    const payload = await readJsonBody(request);
    sendJson(response, 200, await applyResultMatchFix(payload));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/reset-week") {
    sendJson(response, 200, await resetWeek());
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/save") {
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
      sendJson(response, 401, { error: "Your sign-in session expired. Please sign in again." });
      return null;
    }

    return payload.users[0];
  } catch {
    sendJson(response, 503, { error: "Could not verify Firebase sign-in right now" });
    return null;
  }
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
