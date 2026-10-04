# D1 start, lobby, and build HUD wireframes

Status: accepted Design contract, revision 1. These text wireframes describe visible behavior for the [game design](../GAME_DESIGN.md) and [Vision](../VISION.md); they are not a built client or a verified browser layout. D3 owns complete private-room, reconnect, region fallback, and spectator journeys. The accepted D1 economy contract defines the Manhattan build radius and purchase rejection rules used here.

## Start page

```text
┌──────────────────────────────────────────────────────────────┐
│                        PACKET SCRAPP                         │
│     Harvest scrap. Protect your core. Last ship wins.        │
│                                                              │
│  Nickname [________________]  (1–16 characters)              │
│  [ Quick Play ]   [ Create private room ]                    │
│                                                              │
│  Move: WASD / arrows    Shoot/harvest: Space                 │
│  Build: 1 wall, 2 turret    Upgrade: Q blaster, E hull       │
│  A living core rebuilds your ship after a death.            │
│                                                              │
│  Live matches in selected region: [list or none]             │
│  [Automatic ▾] New York available       status / error text  │
└──────────────────────────────────────────────────────────────┘
```

The primary keyboard path is nickname → Quick Play. A valid nickname permits the action; an invalid one leaves focus at the field with a specific error. The region picker is visible but secondary and has a text status, not a color-only dot. If every region is unavailable, Quick Play is unavailable with “Game servers are offline. Retry” and a keyboard-operable Retry action. Live-match entries, private links, and exact region notices are completed in D3.

**Decision:** show the objective and core rule as two short lines on the start page. **Why:** D0 measures first-match understanding without moderator coaching, so the essential rule must be discoverable before play.

## Connected lobby

```text
┌──────────────────────────────────────────────────────────────┐
│ Quick Play — New York             Build starts in 0:15      │
│                                                              │
│ Players (1/5)                                                │
│ • YourNickname (you)                                         │
│                                                              │
│ Waiting for more ships. One labelled BOT joins if you       │
│ are still alone when the countdown ends.                    │
│                                                              │
│ [ Leave lobby ]                    connection/status text     │
└──────────────────────────────────────────────────────────────┘
```

The lobby is a waiting room, not the match start. Its countdown comes from the server; the client does not promise a full fresh 15 seconds to a later arrival. A five-seat lobby starts immediately. A private lobby replaces the countdown with “Host starts when at least two participants are here,” shows the room link and host identity, and exposes Start only to the host. A host-added bot must always carry the BOT label; D3 will define its exact control and host-departure behavior. Do not display a fake countdown on a private room.

**Decision:** identify the bot before build begins. **Why:** a solo visitor should know who they are playing against, not discover it only in results.

## Build HUD

```text
┌──────────────────────────────────────────────────────────────┐
│ HULL 100/100   CORE 300/300       WALLS DROP 1:47           │
│                                                              │
│ Own sector only                 Other ships                  │
│ · · · highlighted legal tiles   Alex — Core active           │
│ [core]  >ship   deposit         BOT — Core active            │
│ ASTEROID BELT — lethal boundary                              │
│ Enemy sectors hidden                                         │
│                                                              │
│                                                              │
│ Scrap 50* |  1 Wall 10  |  2 Turret 40  |  Q Blaster 50      │
│           E Hull 40  |  Space Shoot/Harvest                  │
│  Move WASD/arrows     feedback: “Need 10 scrap for Wall.”    │
└──────────────────────────────────────────────────────────────┘
```

The HUD uses DOM text for time, health, scrap, roster, shop, warning, and feedback; Canvas draws the board and tile highlight. The `Scrap 50*` wireframe is an example after harvesting; every player starts at 0 scrap. The highlight predicts legal structure tiles from the latest authoritative state received by the client under the accepted D1 economy/radius rule. A state change or network delay can make that prediction stale: the server remains the final authority, and a rejected request updates the highlight and gives a visible reason. The front tile gets an extra outline so pressing 1 or 2 has an obvious target. A dim or crossed-out shop item still shows its key and price; an unaffordable action reports why it failed. Next-level upgrade prices follow the [shop table](../GAME_DESIGN.md#the-shop); capped upgrades show “MAX” and never suggest another purchase.

The build view can show map dimensions, own sector, and the lethal Belt edge. The roster shows nickname, BOT label, and a core-active/destroyed marker as text. It does not reveal an enemy sector's ship position, structures, deposits, pickups, core health, or build choices; hiding pixels is insufficient if the server sent those entities. An unowned sector is hidden until battle too. QA checks received state under A04.

**Decision:** keep timer, health, price, and error text outside Canvas. **Why:** the changing values must remain legible and available to keyboard and assistive technology users without interpreting pixels.

## State and focus rules

| State | Visible notice and keyboard result |
|---|---|
| Nickname missing/invalid | Field remains focused; a nearby text error states the valid 1–16-character rule. No join is sent. |
| Joining | Quick Play indicates progress and cannot submit a duplicate join; an explicit Cancel or failure path returns focus to the action. |
| Connected lobby | Focus lands on the lobby heading; Leave is reachable by Tab. Countdown updates as text. |
| Build starts | Game surface receives focus once, with a visible “Move / Shoot / Build” hint. The HUD remains readable while movement keys control the ship. |
| Shop purchase succeeds | Scrap and level/structure state update from the server; feedback names the item and cost. |
| Shop purchase fails | A text message remains for at least three seconds or until the next action, whichever is later, and is announced through a polite live region. It states the reason (funds, maximum level, blocked/occupied tile, or outside build area); scrap does not change. Exact rejection vocabulary comes from D1 economy. |
| Belt warning | In the final ten seconds, “WALLS DROP 0:10” and “Belt drops soon” appear in text. Hazard tiles carry a label/pattern in addition to color. |
| Connection lost | Gameplay input stops; a status explains reconnect or return-to-start. D3 supplies exact recovery timing/copy. |

Tab moves through controls only when focus leaves the game surface; typing into nickname or another form control must not move/fire/build. The game surface has a visible focus indicator and a keyboard path back to the start or lobby action. Suppress arrow-key page scrolling only while the game surface owns movement focus. Do not use color, animation, or sound as the sole signal for a hazard, health change, unaffordable item, or failure.

## Review examples

1. **A01/A02:** Given a keyboard user on the start page, when they enter a valid nickname and activate Quick Play, then they can identify the objective and reach a connected lobby with visible participant count and server countdown. A single human sees the bot policy before start.
2. **A04:** Given a build-phase player, when they inspect the display and received state, then only their sector entities are available; the roster contains public labels/status but no hidden enemy layout or health.
3. **A05:** Given insufficient scrap for Wall, when the user presses 1, then a text reason appears, the price remains visible, and scrap is unchanged. Given an occupied or out-of-radius front tile, 1 or 2 reports the applicable reason and performs no purchase.
4. **A05:** Given a legal structure tile at Manhattan distance 8 from the core and an up-to-date authoritative state, when the player aims at it, then the eligibility highlight and resulting purchase agree with the server. At distance 9 the tile is not highlighted as eligible. If a later server change invalidates a highlighted tile, the purchase is rejected without a scrap deduction, the highlight refreshes, and the player sees the reason.

These wireframes assume a desktop keyboard and a readable typical laptop viewport. Engineering must verify actual layout, focus, contrast, and text reflow in built browsers with QA; this document is not visual or accessibility test evidence.
