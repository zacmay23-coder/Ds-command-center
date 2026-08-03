import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleApi } from "./src/http/apiRouter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const port = Number(process.env.PORT || 8082);

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
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

async function serveStatic(url, response) {
  const redirects = {
    "/desert-storm": "/?view=strategyTimeline",
    "/battle-planning": "/?view=battlePlanning",
    "/battle-planning/desert-storm": "/?view=strategyTimeline",
    "/battle-planning/season-battles": "/?view=seasonBattles"
  };
  if (redirects[url.pathname]) {
    response.writeHead(302, { Location: redirects[url.pathname], "Cache-Control": "no-store" });
    response.end();
    return;
  }
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
