import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { migrateLegacyState } from "../src/domain.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const legacyHtmlPath = path.join(projectRoot, "..", "index.html");
const statePath = path.join(projectRoot, "data", "state.json");

const legacyHtml = await readFile(legacyHtmlPath, "utf8");
const seedMatch = legacyHtml.match(/var seed=(\[.*?\]);\s*var strategyData=/s);

if (!seedMatch) {
  throw new Error("Could not find the legacy roster seed in ../index.html");
}

const seed = vm.runInNewContext(seedMatch[1]);
const legacyState = {
  schema: "dscc-readable-v1",
  updatedAt: new Date().toISOString(),
  settings: {
    strategyA: "Standard Control & Rotation",
    strategyB: "Standard Control & Rotation"
  },
  members: seed.map((member) => ({
    ...member,
    weekScore: 0,
    weekAttendance: "",
    weekNotes: ""
  })),
  pendingResults: [],
  battles: []
};
const { state } = migrateLegacyState(legacyState, { uid: "seed-script" });

await mkdir(path.dirname(statePath), { recursive: true });
await writeFile(statePath, JSON.stringify(state, null, 2), "utf8");

console.log(`Seeded ${Object.keys(state.players).length} players into ${statePath}`);
