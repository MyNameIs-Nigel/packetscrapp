import type { Direction } from "./protocol.ts";
import type { PlayerCount } from "./sectorAssignment.ts";

/** D1 movement and map contract, revision 1. Coordinates are zero-based `(x, y)`, y down. */
export const SECTOR_SIZE = 24;

export interface Cell {
  x: number;
  y: number;
}

export interface SlotGeometry {
  /** Zero-based row-major slot index. */
  index: number;
  column: number;
  row: number;
  /** World coordinate of the sector's top-left cell. */
  originX: number;
  originY: number;
  core: Cell;
  spawn: Cell;
  /** Direction from the core toward the spawn tile; the ship's initial facing. */
  spawnFacing: Direction;
}

export interface Layout {
  playerCount: PlayerCount;
  columns: number;
  rows: number;
  /** World size in cells. */
  width: number;
  height: number;
  /** Every sector slot, in row-major index order. */
  slots: readonly SlotGeometry[];
}

const GRID: Record<PlayerCount, { columns: number; rows: number }> = {
  2: { columns: 2, rows: 1 },
  3: { columns: 2, rows: 2 },
  4: { columns: 2, rows: 2 },
  5: { columns: 3, rows: 2 },
};

/**
 * Core offset inside its sector. Left column 12, right and center columns 11;
 * top row 12, bottom row and the single-row map 11. Mirroring keeps the paired
 * outer sectors the same distance from the nearest internal Belt.
 */
function localCore(column: number, row: number, rows: number): Cell {
  return { x: column === 0 ? 12 : 11, y: rows > 1 && row === 0 ? 12 : 11 };
}

/** Spawn is the core's neighbor toward the map center. */
function spawnDirection(
  column: number,
  columns: number,
  row: number,
): Direction {
  if (columns === 3 && column === 1) return row === 0 ? "down" : "up";
  return column === 0 ? "right" : "left";
}

const STEP: Record<Direction, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function stepFor(direction: Direction): Cell {
  return STEP[direction];
}

const layoutCache = new Map<PlayerCount, Layout>();

export function layoutFor(playerCount: PlayerCount): Layout {
  const cached = layoutCache.get(playerCount);
  if (cached) return cached;
  const { columns, rows } = GRID[playerCount];
  const slots: SlotGeometry[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const originX = column * SECTOR_SIZE;
      const originY = row * SECTOR_SIZE;
      const local = localCore(column, row, rows);
      const core = { x: originX + local.x, y: originY + local.y };
      const spawnFacing = spawnDirection(column, columns, row);
      const step = STEP[spawnFacing];
      slots.push({
        index: row * columns + column,
        column,
        row,
        originX,
        originY,
        core,
        spawn: { x: core.x + step.x, y: core.y + step.y },
        spawnFacing,
      });
    }
  }
  const layout: Layout = {
    playerCount,
    columns,
    rows,
    width: columns * SECTOR_SIZE,
    height: rows * SECTOR_SIZE,
    slots,
  };
  layoutCache.set(playerCount, layout);
  return layout;
}

export function isPlayerCount(value: number): value is PlayerCount {
  return value === 2 || value === 3 || value === 4 || value === 5;
}

export function inWorld(layout: Layout, cell: Cell): boolean {
  return (
    Number.isInteger(cell.x) &&
    Number.isInteger(cell.y) &&
    cell.x >= 0 &&
    cell.y >= 0 &&
    cell.x < layout.width &&
    cell.y < layout.height
  );
}

/** Sector slot index owning a world cell. The cell must be inside the world. */
export function slotAt(layout: Layout, cell: Cell): number {
  const column = Math.floor(cell.x / SECTOR_SIZE);
  const row = Math.floor(cell.y / SECTOR_SIZE);
  return row * layout.columns + column;
}

/**
 * True when a cell is part of an internal build-phase Belt band: both cells on
 * either side of every sector boundary (`24k - 1` and `24k`), including the
 * intersection of a horizontal and a vertical band. The outer world edge has
 * no Belt.
 */
export function isBeltCell(layout: Layout, cell: Cell): boolean {
  if (!inWorld(layout, cell)) return false;
  return (
    isBoundaryCoordinate(cell.x, layout.width) ||
    isBoundaryCoordinate(cell.y, layout.height)
  );
}

function isBoundaryCoordinate(coordinate: number, extent: number): boolean {
  if (coordinate <= 0 || coordinate >= extent - 1) return false;
  const remainder = coordinate % SECTOR_SIZE;
  return remainder === SECTOR_SIZE - 1 || remainder === 0;
}

/** Every Belt cell of a layout, in row-major order. Used by tests and the client to draw the hazard. */
export function beltCells(layout: Layout): Cell[] {
  const cells: Cell[] = [];
  for (let y = 0; y < layout.height; y += 1) {
    for (let x = 0; x < layout.width; x += 1) {
      if (isBeltCell(layout, { x, y })) cells.push({ x, y });
    }
  }
  return cells;
}
