import type { Direction, MoveIntent } from "@packetscrapp/shared";

/**
 * Physical keys, so WASD keeps its shape on non-QWERTY layouts. WASD and the
 * arrow keys are interchangeable.
 */
const KEY_DIRECTIONS: Readonly<Record<string, Direction>> = {
  KeyW: "up",
  KeyA: "left",
  KeyS: "down",
  KeyD: "right",
  ArrowUp: "up",
  ArrowLeft: "left",
  ArrowDown: "down",
  ArrowRight: "right",
};

export function directionForKey(code: string): Direction | undefined {
  return Object.hasOwn(KEY_DIRECTIONS, code) ? KEY_DIRECTIONS[code] : undefined;
}

/**
 * Tracks which movement keys are held and reports the intent they imply: the
 * most recently pressed key that is still held wins, releasing it resumes the
 * previous held key, and releasing the last key stops. Keys are tracked
 * individually so W and ArrowUp held together do not cancel each other.
 */
export class KeyIntentTracker {
  private readonly held: { code: string; direction: Direction }[] = [];

  get intent(): MoveIntent {
    return this.held.at(-1)?.direction ?? "none";
  }

  /** Returns the current intent, or `undefined` when the key is not a movement key. */
  keyDown(code: string): MoveIntent | undefined {
    const direction = directionForKey(code);
    if (direction === undefined) return undefined;
    // Auto-repeat of a held key must not reorder the stack.
    if (!this.held.some((entry) => entry.code === code)) {
      this.held.push({ code, direction });
    }
    return this.intent;
  }

  keyUp(code: string): MoveIntent | undefined {
    if (directionForKey(code) === undefined) return undefined;
    const index = this.held.findIndex((entry) => entry.code === code);
    if (index >= 0) this.held.splice(index, 1);
    return this.intent;
  }

  /** Blur, hidden document or disconnect: nothing is held any more. */
  reset(): MoveIntent {
    this.held.length = 0;
    return "none";
  }
}

/** Sends an intent only when it differs from the last one sent. */
export class IntentSender {
  private last: MoveIntent = "none";
  private readonly transmit: (intent: MoveIntent) => void;

  constructor(transmit: (intent: MoveIntent) => void) {
    this.transmit = transmit;
  }

  set(intent: MoveIntent): void {
    if (intent === this.last) return;
    this.last = intent;
    this.transmit(intent);
  }

  /** Forget what was sent, for a fresh connection whose server intent starts at `none`. */
  restart(): void {
    this.last = "none";
  }
}
