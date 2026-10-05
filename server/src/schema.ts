import { schema, t, type SchemaType } from "@colyseus/schema";

/**
 * Synchronized room state. Visibility follows docs/ARCHITECTURE.md:
 *
 * - Roster fields on `Player` are public to every seated client.
 * - `slot`, every `ships` entry and every `entities` entry are `.view()`
 *   tagged: a client receives one only after the server adds it to that
 *   client's `StateView`. During build a seat's view holds its own sector;
 *   the battle reveal adds everything.
 */
export const PlayerSchema = schema(
  {
    seat: t.uint8(),
    name: t.string(),
    /** Always false in E1; the bot arrives with E5. */
    bot: t.boolean(),
    coreAlive: t.boolean(),
    /** Sector slot index. Hidden from other seats until the reveal. */
    slot: t.uint8().view(),
  },
  "Player",
);
export type Player = SchemaType<typeof PlayerSchema>;

export const ShipSchema = schema(
  {
    seat: t.uint8(),
    x: t.uint8(),
    y: t.uint8(),
    facing: t.string(),
    alive: t.boolean(),
  },
  "Ship",
);
export type Ship = SchemaType<typeof ShipSchema>;

export const EntitySchema = schema(
  {
    id: t.string(),
    kind: t.string(),
    x: t.uint8(),
    y: t.uint8(),
    slot: t.uint8(),
  },
  "Entity",
);
export type Entity = SchemaType<typeof EntitySchema>;

export const RoomStateSchema = schema(
  {
    /** `waiting`, or the prototype's `build` / `battle` fixture view. */
    phase: t.string(),
    /** True for the labelled local movement prototype; always false in the ordinary waiting room. */
    prototype: t.boolean(),
    /** Seats in the fixture; 0 while waiting. Fixes the public map shape. */
    playerCount: t.uint8(),
    tick: t.uint32(),
    players: t.map(PlayerSchema),
    ships: t.map(ShipSchema).view(),
    entities: t.map(EntitySchema).view(),
  },
  "RoomState",
);
export type RoomState = SchemaType<typeof RoomStateSchema>;
