import {
  SECTOR_SIZE,
  beltCells,
  isPlayerCount,
  layoutFor,
  stepFor,
  type Cell,
  type Direction,
  type Layout,
} from "@packetscrapp/shared";
import type { Point, TileAnimator } from "./animation.ts";
import type { RoomView } from "./view.ts";

/** Pixels per world cell at the largest map; the canvas scales down with CSS. */
const TARGET_WIDTH = 960;

const SEAT_COLORS = ["#e4572e", "#29b6f6", "#9ccc65", "#ffca28", "#ba68c8"];

const FACING: Record<string, Direction> = {
  up: "up",
  down: "down",
  left: "left",
  right: "right",
};

export interface Scene {
  view: RoomView;
  /** This client's seat, from the server's private `welcome`. */
  ownSeat: number | undefined;
  animators: ReadonlyMap<number, TileAnimator>;
  now: number;
}

/**
 * Draws only what the client has received. The map shape (sector grid and the
 * build-phase Belt) comes from the public player count; sector contents,
 * ships and cores come from the received state. Hazard and hidden-sector
 * meaning is carried by hatching and text, never by color alone.
 */
export class BoardRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private layout: Layout | undefined;
  private belt: Cell[] = [];
  private cell = 1;

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D is not available");
    this.canvas = canvas;
    this.context = context;
  }

  /** Size the canvas for a map. Safe to call every frame. */
  configure(playerCount: number): void {
    if (!isPlayerCount(playerCount)) return;
    if (this.layout?.playerCount === playerCount) return;
    this.layout = layoutFor(playerCount);
    this.belt = beltCells(this.layout);
    this.cell = Math.max(4, Math.floor(TARGET_WIDTH / this.layout.width));
    this.canvas.width = this.layout.width * this.cell;
    this.canvas.height = this.layout.height * this.cell;
  }

  draw(scene: Scene): void {
    const layout = this.layout;
    const context = this.context;
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!layout) return;
    const { view, ownSeat } = scene;
    const build = view.phase === "build";
    const own = view.players.find((player) => player.seat === ownSeat);
    const size = this.cell;

    context.fillStyle = "#0b1020";
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Sectors: the grid is public, contents are not.
    for (const slot of layout.slots) {
      const x = slot.originX * size;
      const y = slot.originY * size;
      const span = SECTOR_SIZE * size;
      const owner = view.players.find((player) => player.slot === slot.index);
      const visible = !build || own?.slot === slot.index;
      context.fillStyle = visible
        ? owner
          ? tint(seatColor(owner.seat), 0.18)
          : "#141c33"
        : "#06080f";
      context.fillRect(x, y, span, span);
      if (!visible) {
        hatch(context, x, y, span, span, "#1f2740", size);
        context.fillStyle = "#6b7794";
        context.font = `${Math.max(10, size)}px sans-serif`;
        context.textAlign = "center";
        context.fillText("Hidden sector", x + span / 2, y + span / 2);
      }
      context.strokeStyle =
        own?.slot === slot.index && build ? "#8fd3ff" : "#2b3550";
      context.lineWidth = own?.slot === slot.index && build ? 3 : 1;
      context.strokeRect(x + 0.5, y + 0.5, span - 1, span - 1);
    }

    // Build-phase Belt: hatched, with a lethal marker the DOM legend also names.
    if (build) {
      for (const cell of this.belt) {
        const x = cell.x * size;
        const y = cell.y * size;
        context.fillStyle = "#5b3510";
        context.fillRect(x, y, size, size);
        hatch(context, x, y, size, size, "#d98324", Math.max(3, size / 2));
      }
    }

    for (const entity of view.entities) {
      const x = entity.x * size;
      const y = entity.y * size;
      if (entity.kind === "core") {
        context.fillStyle = "#e8eefc";
        context.fillRect(
          x + size * 0.15,
          y + size * 0.15,
          size * 0.7,
          size * 0.7,
        );
        context.strokeStyle = "#0b1020";
        context.lineWidth = 2;
        context.strokeRect(
          x + size * 0.15,
          y + size * 0.15,
          size * 0.7,
          size * 0.7,
        );
      } else {
        context.fillStyle = "#b8a37a";
        context.beginPath();
        context.moveTo(x + size / 2, y + size * 0.1);
        context.lineTo(x + size * 0.9, y + size / 2);
        context.lineTo(x + size / 2, y + size * 0.9);
        context.lineTo(x + size * 0.1, y + size / 2);
        context.closePath();
        context.fill();
      }
    }

    for (const ship of view.ships) {
      const animator = scene.animators.get(ship.seat);
      const position: Point = animator?.position(scene.now) ?? ship;
      drawShip(context, position, size, {
        seat: ship.seat,
        facing: FACING[ship.facing] ?? "right",
        alive: ship.alive,
        own: ship.seat === ownSeat,
      });
    }
  }
}

function seatColor(seat: number): string {
  return SEAT_COLORS[seat % SEAT_COLORS.length] ?? "#ffffff";
}

function tint(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const red = (value >> 16) & 0xff;
  const green = (value >> 8) & 0xff;
  const blue = value & 0xff;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function hatch(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  gap: number,
): void {
  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();
  context.strokeStyle = color;
  context.lineWidth = 1;
  const step = Math.max(3, gap);
  for (let offset = -height; offset < width; offset += step) {
    context.beginPath();
    context.moveTo(x + offset, y + height);
    context.lineTo(x + offset + height, y);
    context.stroke();
  }
  context.restore();
}

function drawShip(
  context: CanvasRenderingContext2D,
  position: Point,
  size: number,
  ship: { seat: number; facing: Direction; alive: boolean; own: boolean },
): void {
  const centerX = (position.x + 0.5) * size;
  const centerY = (position.y + 0.5) * size;
  const direction = stepFor(ship.facing);
  const radius = size * 0.42;
  // Nose along the facing direction, base on the opposite side.
  const nose = {
    x: centerX + direction.x * radius,
    y: centerY + direction.y * radius,
  };
  const side = { x: -direction.y, y: direction.x };
  const left = {
    x: centerX - direction.x * radius * 0.7 + side.x * radius * 0.8,
    y: centerY - direction.y * radius * 0.7 + side.y * radius * 0.8,
  };
  const right = {
    x: centerX - direction.x * radius * 0.7 - side.x * radius * 0.8,
    y: centerY - direction.y * radius * 0.7 - side.y * radius * 0.8,
  };
  context.beginPath();
  context.moveTo(nose.x, nose.y);
  context.lineTo(left.x, left.y);
  context.lineTo(right.x, right.y);
  context.closePath();
  context.fillStyle = ship.alive ? seatColor(ship.seat) : "#59616f";
  context.fill();
  context.lineWidth = ship.own ? 3 : 1;
  context.strokeStyle = ship.own ? "#ffffff" : "#0b1020";
  context.stroke();
  context.fillStyle = "#0b1020";
  context.font = `bold ${Math.max(8, Math.floor(size * 0.55))}px sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(ship.alive ? String(ship.seat) : "x", centerX, centerY);
  context.textBaseline = "alphabetic";
}
