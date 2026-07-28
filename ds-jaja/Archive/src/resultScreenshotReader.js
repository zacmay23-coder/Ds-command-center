import { createWorker } from "tesseract.js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const englishData = require("@tesseract.js-data/eng");

export async function readResultScreenshot(imageBuffer, members) {
  const worker = await createWorker("eng", undefined, {
    gzip: englishData.gzip,
    langPath: englishData.langPath
  });

  try {
    const result = await worker.recognize(imageBuffer);
    const text = result.data.text || "";
    return {
      text,
      ...matchPlayersFromText(text, members)
    };
  } finally {
    await worker.terminate();
  }
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
    const score = readScore(line);
    const hasPlayerMarker = /\[?\s*ewar\s*\]?/i.test(line);

    if (!score) {
      if (hasPlayerMarker) pendingNameLine = line;
      continue;
    }

    const searchLine = hasPlayerMarker ? line : `${pendingNameLine} ${line}`;
    const member = findBestMember(searchLine, members, usedMemberIds);
    if (!member) {
      if (/\[?\s*ewar\s*\]?/i.test(searchLine)) {
        unmatched.push({
          score,
          sourceLine: line,
          ocrName: pendingNameLine || line,
          searchLine
        });
      }
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
  const numbers = line.match(/\b\d{5,9}\b/g);
  if (!numbers?.length) return null;
  return Number(numbers[numbers.length - 1]);
}

function findBestMember(line, members, usedMemberIds) {
  const normalizedLine = normalize(line);
  let best = null;

  for (const member of members) {
    if (usedMemberIds.has(member.id)) continue;

    const candidates = [member.name, ...(member.aliases || [])].map(normalize).filter(Boolean);
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
    .toLowerCase()
    .replace(/\[?ewar\]?/g, "")
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
