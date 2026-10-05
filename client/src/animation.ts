import { TICK_INTERVAL_MS } from "@packetscrapp/shared";

/** A ship covers one tile every two ticks, so slide over exactly that long. */
export const MOVE_ANIMATION_MS = 2 * TICK_INTERVAL_MS;

export interface Point {
  x: number;
  y: number;
}

/**
 * Draws a ship sliding between the tiles the server reported. This only
 * smooths the picture: the tile the server last reported is always where the
 * ship is, and a jump of more than one tile (a reveal, a first sighting)
 * snaps instead of sliding.
 */
export class TileAnimator {
  private from: Point;
  private to: Point;
  private startedAt: number;

  constructor(tile: Point, now: number) {
    this.from = { ...tile };
    this.to = { ...tile };
    this.startedAt = now;
  }

  /** Report the latest authoritative tile. */
  update(tile: Point, now: number, smooth: boolean): void {
    if (tile.x === this.to.x && tile.y === this.to.y) return;
    const current = this.position(now);
    const jump = Math.abs(tile.x - this.to.x) + Math.abs(tile.y - this.to.y);
    this.from = smooth && jump <= 1 ? current : { ...tile };
    this.to = { ...tile };
    this.startedAt = now;
  }

  /** The drawn position, between `from` and `to`. */
  position(now: number): Point {
    const progress = (now - this.startedAt) / MOVE_ANIMATION_MS;
    // Reaching the end returns the reported tile exactly, free of rounding drift.
    if (progress >= 1 - 1e-9) return { ...this.to };
    if (progress <= 0) return { ...this.from };
    return {
      x: this.from.x + (this.to.x - this.from.x) * progress,
      y: this.from.y + (this.to.y - this.from.y) * progress,
    };
  }

  get tile(): Point {
    return { ...this.to };
  }
}
