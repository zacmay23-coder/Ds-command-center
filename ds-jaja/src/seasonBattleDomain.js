import { randomUUID } from "node:crypto";

export const SEASON_BATTLE_STATUSES = ["draft", "scheduled", "active", "completed", "archived", "cancelled"];
export const SEASON_BATTLE_PERMISSIONS = ["viewSeasonBattlePlans", "manageSeasonBattlePlans", "publishSeasonBattlePlans", "archiveSeasonBattlePlans", "deleteSeasonBattleDrafts"];
export const OBJECT_SIZES = Object.freeze({ base: [3, 3], allianceCenter: [9, 9] });

export function normalizeSeasonBattle(plan = {}) {
  const timestamp = new Date().toISOString();
  return {
    id: String(plan.id || `season-battle-${randomUUID()}`),
    type: "seasonBattle",
    title: String(plan.title || "Untitled Season Battle").trim().slice(0, 160),
    seasonName: String(plan.seasonName || "").slice(0, 80),
    battleDate: plan.battleDate || null,
    serverTime: String(plan.serverTime || "").slice(0, 20),
    opponent: String(plan.opponent || "").slice(0, 120),
    mapAreaName: String(plan.mapAreaName || "").slice(0, 120),
    description: String(plan.description || "").slice(0, 1000),
    officerNotes: String(plan.officerNotes || "").slice(0, 3000),
    visibility: ["members", "officers", "guestDemo"].includes(plan.visibility) ? plan.visibility : "members",
    status: SEASON_BATTLE_STATUSES.includes(plan.status) ? plan.status : "draft",
    screenshot: plan.screenshot ? { assetId: String(plan.screenshot.assetId || ""), originalUrl: String(plan.screenshot.originalUrl || ""), width: Number(plan.screenshot.width || 0), height: Number(plan.screenshot.height || 0), mimeType: String(plan.screenshot.mimeType || "") } : null,
    grid: normalizeGrid(plan.grid),
    objects: Array.isArray(plan.objects) ? plan.objects.map(normalizeMapObject) : [],
    inaccessibleCells: [...new Set((plan.inaccessibleCells || []).map(cellKey).filter(Boolean))],
    annotations: Array.isArray(plan.annotations) ? plan.annotations : [],
    calibrationLocked: Boolean(plan.calibrationLocked),
    publishedVersion: Number(plan.publishedVersion || 0),
    createdAt: plan.createdAt || timestamp,
    createdBy: String(plan.createdBy || ""),
    updatedAt: plan.updatedAt || timestamp,
    updatedBy: String(plan.updatedBy || ""),
    publishedAt: plan.publishedAt || null,
    publishedBy: plan.publishedBy || null,
    archivedAt: plan.archivedAt || null,
    version: Math.max(1, Number(plan.version || 1))
  };
}

export function normalizeGrid(grid = {}) {
  return {
    columns: clampInteger(grid.columns, 10, 120, 60),
    rows: clampInteger(grid.rows, 10, 120, 40),
    viewport: {
      x: clampNumber(grid.viewport?.x, 0, 99, 0), y: clampNumber(grid.viewport?.y, 0, 99, 0),
      width: clampNumber(grid.viewport?.width, 1, 100, 100), height: clampNumber(grid.viewport?.height, 1, 100, 100)
    },
    showGrid: grid.showGrid !== false,
    gridOpacity: clampNumber(grid.gridOpacity, 0.05, 1, 0.35),
    showCoordinates: Boolean(grid.showCoordinates)
  };
}

export function normalizeMapObject(object = {}) {
  const type = object.type === "allianceCenter" ? "allianceCenter" : "base";
  const [widthCells, heightCells] = OBJECT_SIZES[type];
  return {
    id: String(object.id || `${type}-${randomUUID()}`), type,
    anchor: { row: Number(object.anchor?.row), column: Number(object.anchor?.column) },
    widthCells, heightCells,
    label: String(object.label || (type === "base" ? "Base" : "Alliance Center")).slice(0, 100),
    assignedMemberId: object.assignedMemberId ? String(object.assignedMemberId) : null,
    allianceName: String(object.allianceName || "").slice(0, 100),
    notes: String(object.notes || "").slice(0, 1000),
    createdAt: object.createdAt || new Date().toISOString(),
    createdBy: String(object.createdBy || "")
  };
}

export function validatePlacement({ objectType, anchorRow, anchorColumn, widthCells, heightCells, grid, inaccessibleCells = [], existingObjects = [], ignoreObjectId = null, readOnly = false, canEdit = true }) {
  const required = OBJECT_SIZES[objectType];
  if (readOnly || !canEdit) return { valid: false, code: "READ_ONLY", message: "This map is read-only." };
  if (!required) return { valid: false, code: "TYPE", message: "Choose a valid map object." };
  if (!Number.isInteger(anchorRow) || !Number.isInteger(anchorColumn)) return { valid: false, code: "ANCHOR", message: "Choose a valid grid coordinate." };
  if (widthCells !== required[0] || heightCells !== required[1]) return { valid: false, code: "SIZE", message: `${objectType === "base" ? "A Base" : "The Alliance Center"} must occupy exactly ${required[0]} × ${required[1]} cells.` };
  if (anchorRow < 0 || anchorColumn < 0 || anchorRow + heightCells > grid.rows || anchorColumn + widthCells > grid.columns) return { valid: false, code: "OUTSIDE_GRID", message: `${objectType === "base" ? "A Base" : "The Alliance Center"} extends outside the configured grid.` };
  const cells = footprint(anchorRow, anchorColumn, widthCells, heightCells);
  const inaccessible = new Set(inaccessibleCells.map(cellKey));
  if (cells.some((cell) => inaccessible.has(cell))) return { valid: false, code: "INACCESSIBLE", message: `${objectType === "base" ? "A Base" : "The Alliance Center"} overlaps an inaccessible zone.` };
  for (const existing of existingObjects.filter((item) => item.id !== ignoreObjectId)) {
    const occupied = new Set(footprint(existing.anchor.row, existing.anchor.column, existing.widthCells, existing.heightCells));
    if (cells.some((cell) => occupied.has(cell))) return { valid: false, code: "OVERLAP", message: `${objectType === "base" ? "A Base" : "The Alliance Center"} overlaps ${existing.label || "another object"}.` };
  }
  return { valid: true, code: "VALID", message: "Valid placement" };
}

export function validateSeasonBattle(plan, options = {}) {
  const errors = [];
  if (!plan.screenshot?.assetId || !plan.screenshot.width || !plan.screenshot.height) errors.push("The screenshot is missing.");
  if (!plan.grid?.columns || !plan.grid?.rows) errors.push("The grid has not been calibrated.");
  for (const object of plan.objects || []) {
    const result = validatePlacement({ objectType: object.type, anchorRow: object.anchor.row, anchorColumn: object.anchor.column, widthCells: object.widthCells, heightCells: object.heightCells, grid: plan.grid, inaccessibleCells: plan.inaccessibleCells, existingObjects: plan.objects, ignoreObjectId: object.id, canEdit: true });
    if (!result.valid) errors.push(`${object.label}: ${result.message}`);
  }
  if (options.requireDetails && (!plan.title || !plan.battleDate)) errors.push("Plan title and battle date are required before publishing.");
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

function footprint(row, column, width, height) {
  const cells = [];
  for (let r = row; r < row + height; r += 1) for (let c = column; c < column + width; c += 1) cells.push(`${r}:${c}`);
  return cells;
}
function cellKey(cell) { const row = Number(cell?.row ?? String(cell).split(":")[0]); const column = Number(cell?.column ?? String(cell).split(":")[1]); return Number.isInteger(row) && Number.isInteger(column) && row >= 0 && column >= 0 ? `${row}:${column}` : ""; }
function clampInteger(value, min, max, fallback) { const number = Number(value); return Number.isInteger(number) ? Math.min(max, Math.max(min, number)) : fallback; }
function clampNumber(value, min, max, fallback) { const number = Number(value); return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback; }
