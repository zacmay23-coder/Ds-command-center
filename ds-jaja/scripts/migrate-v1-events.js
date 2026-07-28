import { getState } from "../src/dataStore.js";

const state = await getState();
const migration = state.migrations?.["legacy-weekly-to-events-v1"];

if (!migration) {
  throw new Error("The event migration did not complete");
}

console.log(`Schema: ${state.schema}`);
console.log(`Players: ${Object.keys(state.players).length}`);
console.log(`Events: ${Object.keys(state.events).length}`);
console.log(`Migration completed: ${migration.completedAt}`);
console.log("Backup: data/state.pre-events-v1.json");
console.log("Report: MIGRATION_REPORT.md");

