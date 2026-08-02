import { createWorker } from "tesseract.js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const englishData = require("@tesseract.js-data/eng");

export async function readResultScreenshot(imageBuffer, members) {
  const text = await readScreenshotText(imageBuffer);
  return {
    text,
    ...matchPlayersFromText(text, members)
  };
}

export async function readScreenshotText(imageBuffer) {
  const worker = await createWorker("eng", undefined, {
    gzip: englishData.gzip,
    langPath: englishData.langPath
  });

  try {
    const result = await worker.recognize(imageBuffer);
    return result.data.text || "";
  } finally {
    await worker.terminate();
  }
}

export function parseDuelLeagueRankings(text) {
  const rankings = [];
  const unmatched = [];
  for (const sourceLine of String(text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean)) {
    const rankMatch = sourceLine.match(/^\s*#?\s*(\d{1,3})\b/);
    const serverMatch = sourceLine.match(/\b(?:server\s*)?(S?\s*#?\s*\d{2,6})\b/i);
    if (!rankMatch || !serverMatch) {
      unmatched.push(sourceLine);
      continue;
    }
    const rank = Number(rankMatch[1]);
    const server = serverMatch[1].replace(/\s|#/g, "").toUpperCase();
    const alliance = sourceLine
      .slice(rankMatch[0].length)
      .replace(serverMatch[0], "")
      .replace(/^[\s.)\-:]+|[\s.)\-:]+$/g, "")
      .trim();
    if (!alliance) {
      unmatched.push(sourceLine);
      continue;
    }
    rankings.push({ rank, alliance, server, sourceLine });
  }
  rankings.sort((left, right) => left.rank - right.rank);
  return { rankings, unmatched };
}

export function parseDuelLeagueStandings(text) {
  const standings = [];
  const unmatched = [];
  for (const sourceLine of String(text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean)) {
    const rankMatch = sourceLine.match(/^\s*#?\s*(\d{1,3})\b/);
    const remainder = sourceLine
      .replace(/^\s*#?\s*\d{1,3}\s*[.)\-:]?\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!remainder || isStandingsHeader(remainder)) {
      unmatched.push(sourceLine);
      continue;
    }
    const tokens = remainder.split(/\s+/);
    const outcomes = [];
    while (tokens.length && outcomes.length < 4) {
      const token = tokens[tokens.length - 1].replace(/[^a-z]/gi, "").toUpperCase();
      if (!["W", "L", "WIN", "LOSS"].includes(token)) break;
      outcomes.unshift(token.startsWith("W") ? "W" : "L");
      tokens.pop();
    }
    const alliance = cleanAllianceName(tokens.join(" "));
    const hasAllianceTag = /\[[^\]]{2,12}\]\s*\S+/i.test(alliance);
    if (!alliance || !/[a-z]/i.test(alliance) || (!rankMatch && !hasAllianceTag && !outcomes.length)) {
      unmatched.push(sourceLine);
      continue;
    }
    standings.push({
      rank: standings.length + 1,
      alliance,
      weeks: Array.from({ length: 4 }, (_, index) => outcomes[index] || ""),
      sourceLine
    });
    if (standings.length === 16) break;
  }
  return { standings, unmatched };
}

function isStandingsHeader(line) {
  return /^(duel\s+league|standings?|ranking|rank|alliance|server|week\s*[1-4]|wins?|losses?)\b/i.test(line)
    || /alliance.*week\s*1/i.test(line);
}

function cleanAllianceName(value) {
  return String(value)
    .replace(/^.*?(?=\[[^\]]{2,12}\])/, "")
    .replace(/^[\s.)\-:]+|[\s.)\-:]+$/g, "")
    .replace(/\[\s*([a-z0-9]{2,12})\s*\]/i, "[$1]")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchPlayersFromText(text, members) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const matches = [];
  const unmatched = [];
  const usedMemberIds = new Set();
  let pendingNameLine = "";

  for (const line of lines) {
    if (isAllianceBoilerplate(line)) continue;

    const score = readScore(line);
    const cleanedLine = stripAllianceBoilerplate(line);

    if (score === null) {
      if (looksLikePlayerName(cleanedLine)) pendingNameLine = cleanedLine;
      continue;
    }

    const searchLine = `${pendingNameLine} ${cleanedLine}`.trim();
    const member = findBestMember(searchLine, members, usedMemberIds);
    if (!member) {
      unmatched.push({
        score,
        hasScore: true,
        sourceLine: line,
        ocrName: pendingNameLine || line,
        searchLine,
        nameStatus: "No Match",
        confidence: 0
      });
      pendingNameLine = "";
      continue;
    }

    usedMemberIds.add(member.id);
    pendingNameLine = "";
    matches.push({
      memberId: member.id,
      name: member.name,
      score,
      sourceLine: line
    });
  }

  return { matches, unmatched };
}

function readScore(line) {
  const numbers = String(line)
    .replace(/(?<=\d)[,.](?=\d{3}\b)/g, "")
    .match(/\b\d{1,12}\b/g);
  if (!numbers?.length) return null;
  return Number(numbers[numbers.length - 1]);
}

function isAllianceBoilerplate(line) {
  return normalize(stripAllianceBoilerplate(line)) === "";
}

function stripAllianceBoilerplate(line) {
  return String(line)
    .replace(/\[?\s*ewar\s*\]?/gi, " ")
    .replace(/\(?\s*eternal\s+lords\s+(?:of|or)\s+war\s*\)?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikePlayerName(line) {
  if (!line || isAllianceBoilerplate(line)) return false;
  if (!/[a-z]/i.test(line)) return false;
  if (/^(score|power|rank|points?|total|victory|defeat)\b/i.test(line)) return false;
  return normalize(line).length >= 2;
}

function findBestMember(line, members, usedMemberIds) {
  const normalizedLine = normalize(line);
  let best = null;

  for (const member of members) {
    if (usedMemberIds.has(member.id)) continue;

    const candidates = [member.name, ...(member.aliases || []), ...(member.previousPlayerNames || [])].map(normalize).filter(Boolean);
    if (!candidates.length) continue;

    const score = Math.max(...candidates.map((candidate) => scoreNameMatch(normalizedLine, candidate)));
    if (!best || score > best.score) {
      best = { member, score };
    }
  }

  return best?.score >= 0.72 ? best.member : null;
}

function scoreNameMatch(line, name) {
  if (line.includes(name)) return 1;

  if (name.length >= 5 && line.includes(name.slice(0, Math.max(5, Math.floor(name.length * 0.72))))) {
    return 0.86;
  }

  if (name.length >= 4 && line.includes(name.slice(0, 4))) {
    return 0.78;
  }

  const distance = levenshteinDistance(line, name);
  const ratio = 1 - distance / Math.max(line.length, name.length, 1);
  return Math.max(0, ratio);
}

function normalize(value) {
  return String(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\[?ewar\]?/g, "")
    .replace(/0/g, "o")
    .replace(/[1il]/g, "l")
    .replace(/[^a-z0-9]/g, "");
}

function levenshteinDistance(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i++) {
    current[0] = i;

    for (let j = 1; j <= b.length; j++) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + substitutionCost
      );
    }

    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length];
}
