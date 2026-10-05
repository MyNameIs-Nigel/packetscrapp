import { describe, expect, it } from "vitest";
import {
  IntentSender,
  KeyIntentTracker,
  directionForKey,
} from "../../client/src/input.ts";
import type { MoveIntent } from "../../shared/src/index.ts";

describe("key mapping", () => {
  it.each([
    ["KeyW", "up"],
    ["KeyA", "left"],
    ["KeyS", "down"],
    ["KeyD", "right"],
    ["ArrowUp", "up"],
    ["ArrowLeft", "left"],
    ["ArrowDown", "down"],
    ["ArrowRight", "right"],
  ])("maps %s to %s", (code, direction) => {
    expect(directionForKey(code)).toBe(direction);
  });

  it.each([
    "Space",
    "KeyQ",
    "KeyE",
    "Digit1",
    "Tab",
    "Enter",
    "constructor",
    "__proto__",
    "",
  ])("ignores %j", (code) => {
    expect(directionForKey(code)).toBeUndefined();
  });
});

describe("held-key intent (K01)", () => {
  it("holding W then D moves right; releasing D resumes up; releasing W stops", () => {
    const tracker = new KeyIntentTracker();
    expect(tracker.keyDown("KeyW")).toBe("up");
    expect(tracker.keyDown("KeyD")).toBe("right");
    expect(tracker.keyUp("KeyD")).toBe("up");
    expect(tracker.keyUp("KeyW")).toBe("none");
  });

  it("releasing an older key keeps the newer one", () => {
    const tracker = new KeyIntentTracker();
    tracker.keyDown("KeyW");
    tracker.keyDown("KeyD");
    expect(tracker.keyUp("KeyW")).toBe("right");
    expect(tracker.keyUp("KeyD")).toBe("none");
  });

  it("treats WASD and arrows alike and does not drop a direction until both keys are up", () => {
    const tracker = new KeyIntentTracker();
    tracker.keyDown("KeyW");
    tracker.keyDown("ArrowUp");
    expect(tracker.keyUp("KeyW")).toBe("up");
    expect(tracker.keyUp("ArrowUp")).toBe("none");
  });

  it("does not reorder on key auto-repeat", () => {
    const tracker = new KeyIntentTracker();
    tracker.keyDown("KeyW");
    tracker.keyDown("KeyD");
    expect(tracker.keyDown("KeyW")).toBe("right");
    expect(tracker.keyDown("KeyW")).toBe("right");
    expect(tracker.keyUp("KeyD")).toBe("up");
  });

  it("ignores keys that are not movement keys and unmatched releases", () => {
    const tracker = new KeyIntentTracker();
    expect(tracker.keyDown("Space")).toBeUndefined();
    expect(tracker.keyUp("Space")).toBeUndefined();
    expect(tracker.keyUp("KeyW")).toBe("none");
    expect(tracker.intent).toBe("none");
  });

  it("clears every held key on blur, hide or disconnect", () => {
    const tracker = new KeyIntentTracker();
    tracker.keyDown("KeyW");
    tracker.keyDown("KeyD");
    expect(tracker.reset()).toBe("none");
    expect(tracker.intent).toBe("none");
    // A release that arrives after the reset (the key came up elsewhere) changes nothing.
    expect(tracker.keyUp("KeyD")).toBe("none");
  });

  it("is reset by the next press, not stuck on the old direction", () => {
    const tracker = new KeyIntentTracker();
    tracker.keyDown("KeyW");
    tracker.reset();
    expect(tracker.keyDown("KeyA")).toBe("left");
  });
});

describe("intent sender", () => {
  it("sends only changes and stop on release", () => {
    const sent: MoveIntent[] = [];
    const sender = new IntentSender((intent) => sent.push(intent));
    const tracker = new KeyIntentTracker();
    sender.set("none");
    sender.set(tracker.keyDown("KeyW") ?? "none");
    sender.set(tracker.keyDown("KeyW") ?? "none");
    sender.set(tracker.keyDown("KeyD") ?? "none");
    sender.set(tracker.keyUp("KeyD") ?? "none");
    sender.set(tracker.keyUp("KeyW") ?? "none");
    sender.set(tracker.reset());
    expect(sent).toEqual(["up", "right", "up", "none"]);
  });

  it("starts fresh after a reconnect", () => {
    const sent: MoveIntent[] = [];
    const sender = new IntentSender((intent) => sent.push(intent));
    sender.set("up");
    sender.restart();
    sender.set("up");
    expect(sent).toEqual(["up", "up"]);
  });
});
