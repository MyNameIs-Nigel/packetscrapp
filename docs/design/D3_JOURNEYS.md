# D3 player journeys — proposed revision 1

Status: **In review, proposed** under [#33](https://github.com/MyNameIs-Nigel/packetscrapp/issues/33). Engineering accepts transport/feasibility; QA accepts observable oracles. This is specification, not implementation, browser evidence or independent approval. Accepted D0 entry targets and D1 visibility remain binding. Lifecycle references consume the still-proposed [D2 revision 2](../GAME_DESIGN.md#d2-contender-and-win-draw-contract--revision-2); accepting this document alone cannot accept D2. [The handoff](D3_HANDOFF.md) records dependencies and evidence.

The player rules below extend [GAME_DESIGN.md](../GAME_DESIGN.md). Identity/message requirements extend [ARCHITECTURE.md](../ARCHITECTURE.md). Region selection extends [REGIONS_AND_HEALTH.md](../REGIONS_AND_HEALTH.md). This is their linked authoritative D3 detail, not a second implementation API. Starting values are hypotheses. Do not implement a proposed slice until its required teams accept it.

## Joining and lobby contract

A participant is a human player seat or the one bot seat. Watchers never fill player seats. Nicknames use E1's 1–16 Unicode-code-point sanitized form: remove control characters, normalize to NFC, trim, then require 1–16 code points. Reject raw input above E1's 1024 UTF-16-unit bound before normalization. Show the normalized value before submitting; whitespace/control-only input fails. Render text safely, never HTML. Duplicate names are allowed; stable server seat IDs distinguish them. The private link carries region and room ID, never identity credentials. Valid private room IDs do not authorize host controls.

| State / event | Authoritative outcome | Failure / recovery |
|---|---|---|
| Quick Play activated | Fresh health selection; join an eligible public waiting lobby or create one. Serialize seat admission against start. Private rooms are excluded. | Joining disables duplicate submission; Cancel stops retries and releases any late-admitted seat. Failure returns focus to Quick Play with the reason. |
| First human admitted to Quick Play | Start one absolute 15-second server countdown. Later arrivals inherit it. | If all humans leave, dispose; bot alone never keeps a lobby alive. A fresh room gets a fresh deadline. |
| Countdown deadline with one connected human | Atomically insert exactly one labelled bot and lock/start a two-participant match. | If insertion/start fails, show failure and return to start; never run a one-participant match or silently extend the target. |
| Countdown deadline with 2–4 connected humans | Lock/start with these humans, no bot. | An admission processed after lock is refused and Quick Play may retry a fresh lobby with visible progress. |
| Fifth human admitted | Lock/start immediately; no bot. | Sixth human is refused. A failed join cannot evict an admitted human. |
| Create Private room | Create a waiting room with creator as host and a region-bound share link. No automatic countdown. | A failed create has no usable link; Retry is explicit. |
| Private host starts | Require waiting phase and 2–5 participants. With one human alone, Start is disabled until Add BOT succeeds. | Non-host/start after lock/too few participants is refused without state mutation. |
| Host adds BOT | Require private waiting room, exactly one connected human (the host), no existing bot; insert one seat labelled `Salvager — BOT`. | At two humans, Add BOT is disabled/refused. Never pad a human lobby. |
| Second human arrives while private BOT exists | Atomically remove BOT and admit human; clear bot-dependent start readiness. | If host Start wins the serialization race, the room is locked and late human is refused. If admission wins, start uses the two humans. |
| Host removes BOT | Allowed only in private waiting room with the bot present. | No bot is a harmless no-op with current roster; other callers are refused. |
| Private host leaves/disconnects before start | Release the host seat immediately; transfer host to earliest-admitted remaining connected human, using stable join order. Keep room/link, discard bot if no humans remain. | No humans means immediate disposal. No 20-second waiting-lobby reservation or automatic match start. Old host reconnect is a new waiting-room admission, without restored host authority. |
| Non-host leaves/disconnects before start | Release seat immediately; keep private waiting room if any human remains. | If only one human remains, host may explicitly add BOT; no implicit private insertion. |
| A match starts | Fix participant count, seed, layout and seat order; lock player admission. Host privileges cease for this match. | Host leaving during play follows the same departure rule as every player; no host transfer or match cancellation. |
| Waiting private room remains idle | Dispose after 5 minutes with no accepted human lobby action/admission. Start, bot changes and admission reset inactivity; rejected spam, polling and keepalive do not. | At 30 seconds remaining show expiry. Expired link offers Create Private room or Return to start; never recreate under the old ID. |

**Decision:** transfer waiting host authority to the earliest remaining human and replace a private solo bot when a friend arrives. **Why:** friends keep their link without inheriting a timer, and accepted D0 forbids bot padding of two-human lobbies. The idle timeout is a proposed resource limit requiring Engineering/QA acceptance; it does not bound an actively used private lobby or grant deployment/drain approval.

Start/admission/bot/departure events use one server order. Engineering pins the exact ordering and tests both race orders; client timestamps never decide authority. Quick Play refusal retries stop on Cancel, incompatibility or unavailable regions; allow at most one automatic retry after a stale/full lobby refusal, then offer Retry. Each retry is included in D0 timing measurements. Never change a private link's region/room as a recovery shortcut.

## Roles and allowed actions

| Role | Lobby start / bot controls | Gameplay | View / results | Leave / recovery |
|---|---|---|---|---|
| Private waiting host | Start, add/remove BOT subject to preconditions | None | Public lobby roster and link | Leave transfers/disposes |
| Other waiting human / public human | None | None | Public lobby roster/countdown where applicable | Leave; a lost waiting seat is not reserved |
| Living player | None | Validated move/fire/build/upgrade per phase | Own-sector build view; full battle view | Leave eliminates; reconnect only same seat |
| Awaiting respawn | None | None | Same phase view as its player seat | Core loss/expiry cancels wait per D2 |
| Permanently eliminated former player | None | None, even with old player messages/token | Metadata only during build; full view after battle reveal; immutable results | May stay watching in its reserved former-player connection |
| External watcher, including build wait | None | None | Metadata only until reveal; full view thereafter; results | Leave releases watcher slot; re-entry needs admission |
| BOT | None | Same legal action path and seat view as a human | No external client or privileged visibility | Removed only in waiting; lifecycle follows D2 in play |

External watcher cap is **10**, including clients admitted during build and awaiting reveal. Up to five former player seats can stay after elimination without consuming those external slots. The server therefore permits at most 15 admitted human room connections: five player/former-player connections plus ten external watchers; bot seats do not add a connection. A replacement reconnect supersedes a connection rather than adding one. Existing IP/message/server-cap limits still apply and can refuse otherwise valid admission. Former players cannot claim multiple watcher exemptions. This clarifies the old ambiguous spectator cap and requires explicit Engineering/QA approval.

**Decision:** reserve eliminated players' existing viewing rights separately from the ten external slots. **Why:** eliminating a player must not eject them merely because ten strangers are watching. The maximum connection budget stays explicit for capacity testing; this is not approval of measured capacity.

External watch admission is allowed only for public build/battle/sudden-death rooms, plus private rooms reached by their link with explicit Watch. No external watching in waiting or new admission after ended. Private rooms are never in the public live list; possession of a link permits watching, not player/host impersonation. Private is unlisted, not authenticated secrecy. A locked private join offers Watch subject to capacity, without automatically changing role. An eliminated player in build loses its former sector entity view immediately and receives metadata only; reconnect cannot restore those entities. Its already-seen own layout cannot be erased from memory, but no fresh hidden layout is sent.

Build watcher metadata allowlist: room ID, phase, server tick/countdown, fixed participant count, public roster nicknames/BOT labels/core-active markers, connection and contender status. No seed, sector assignment, positions, entity lists, hull/core numeric health, scrap, upgrades or builds. At D2's tick-1800 send stage the authoritative view expands; a local countdown hitting zero never unlocks it. In battle/sudden death, watchers receive the same public full world as players, excluding tokens/private identity and internal diagnostics. Watcher messages never mutate gameplay, roster, bot, timers or results.

## Reconnect, departure and replay

The server issues a private reconnect credential bound to environment, region, room and seat. Store it only in that tab's `sessionStorage`; do not put it in links, localStorage, public schemas, analytics or logs. Storage unavailable means current play continues, with `Automatic reconnect unavailable in this tab.` A missing token cannot be replaced by nickname, room ID or a claimed seat index. Accounts remain out of scope. Engineering chooses the supported Colyseus identity method, pins issuance/rotation/transport behavior and compatibility version, and subjects it to QA before use.

During active play, server-recorded disconnect on tick `d` sets the D2 deadline `d+300`. Clear move/fire and held inputs at once; the ship remains vulnerable and death/respawn never extends the deadline. A valid recovery accepted on a server tick **strictly less than** `d+300` restores that seat's current state. At tick `d+300` recovery is already too late, including a handshake validated before that tick's timer stage; expiry wins. QA tests recovery at `d+299`, expiry at `d+300`, and denial at `d+301` using server-controlled scheduling. The client shows a rounded-up estimate and treats server admission/expiry as authoritative. A 20-second label is the intended duration at 15 Hz; a stalled simulation is not proof of a wall-clock guarantee.

| Event | Role and identity outcome | Player feedback / next action |
|---|---|---|
| Temporary connection loss in active match | Freeze local inputs, retain one absolute seat deadline; automatically retry the same room/region using the credential | `Connection lost — reconnecting. Your ship can still be attacked.` Display estimated remaining window. |
| Reconnect before expiry while ship lives | Replace old socket if any, restore same seat/ship/economy; invalidate old credential when replacement is acknowledged | `Reconnected.` Inputs resume only after authorized state and a fresh key press on focused surface. |
| Ship dies / respawns while absent | Same deadline; restore current alive or awaiting-respawn role, never old client snapshot | Show current authoritative death/respawn notice. |
| Core loss permanently eliminates absent seat before deadline | Recovery before the original deadline may reattach only as the former player watcher, with phase filtering | `You were eliminated while disconnected — watching.` No new life or host powers. |
| Deadline reached | Permanently eliminate active seat, cancel pending respawn; keep core as target per D2; invalidate seat credential | `Reconnect window expired. Your seat is gone.` Offer explicit Watch if allowed/capacity, or Return to start. |
| Second tab/replayed invalid or superseded credential | Reject without displacing current owner; no token disclosure | `This session cannot be restored.` Offer Return to start. |
| Explicit Leave during active play | Cancel retries; authenticated voluntary departure permanently eliminates immediately, clears identity after acknowledgement | Confirmation states `Your seat will be eliminated.` Do not imply a reserved 20-second return. |
| Leave request cannot reach server | Clear local retry/storage, close connection; server can only observe a disconnect and apply grace | `Left locally. The server may hold your vulnerable ship for up to 20 seconds.` No false immediate-server-elimination claim. |
| Server/room gone | Stop same-room retries on authoritative not-found/disposed response; never migrate the live match | `This match is no longer available.` Keep known results if already received. |
| External watcher connection lost | No player grace/credential; retry ordinary watch admission only with explicit Retry | Cap and phase rechecked; a free slot is not reserved. |
| Match ends during reconnect | Existing valid seat may recover before original grace and results disposal, but only into frozen results | Never extend the 225-tick results window. |
| Results expire | Clear room credential/socket/timers; retain known outcome locally | `This match has closed.` Keep Play Again and Return to start. |

Credential rotation must not strand a client after an interrupted acknowledgement: Engineering must record a supported bounded recovery mechanism and single-owner invariant; do not invent a token grace that extends gameplay eligibility. A valid held credential authenticates the seat until expiry; stale credentials after successful rotation/leave/disposal are invalid. Retry intervals are proposed 0, 1, 2, 4 seconds, then every 4 seconds, at most one attempt in flight, stopping at refusal/expiry/leave. Retries never select another region. A transport outage can hide disposal until contact returns; show loss, never fabricate a result.

**Decision:** seat continuity follows server identity and one fixed deadline. **Why:** nickname matching permits impersonation and repeated disconnects during an existing absence must not buy extra lives. A recovered connected seat that later genuinely disconnects receives a new window; replaying an old token cannot create that state.

Play Again always leaves the old room and discards its credential, pending inputs, timers and retained gameplay view. Public players/watchers use fresh Quick Play with nickname and preference retained. In private results, every former human participant may choose `Play Again — new private room`; activation creates a fresh room/link with that user as host. There is no hidden rematch invitation or shared group migration; copy says `Share the new link with your friends.` External private watchers return to start or may explicitly create their own private room. Each action submits at most once; creation failure offers Retry without restoring the ended seat. Return to start preserves nickname/preference, clears match identity and reruns health selection. D0 timers begin at this new activation, never at the previous match ending.

## Bot opponent contract

Exactly one BOT is a solo opponent; no difficulty levels, extra bots or stat advantages. It reads a filtered seat view, uses the same cooldowns, movement opportunities, purchase rules and action limits. It never reads an enemy/unowned build sector, room seed, hidden path, client credentials or future actions. Decisions are deterministic from visible state and a separately recorded bot tie-break seed; the bot seed cannot expose hidden layouts. The server must test the bot with an explicitly filtered input, not let it choose what to ignore from an unrestricted world.

| Priority / situation | Legal observable behavior |
|---|---|
| Dead, eliminated, ended or disconnected-equivalent state | No gameplay requests; wait for legal respawn or ending. |
| Current / next-step active Belt | Choose a safe legal cardinal step; hazard safety takes priority over attacking or purchasing. No predictive access to future hidden state. |
| Build phase | Target the visible reachable deposit with shortest safe cardinal route to a legal firing tile within current range; fire toward it. Never walk into build Belt to reach enemy/unowned resources. |
| Spending | Alternate desired wall and blaster upgrade after successful purchases, starting with wall. If desired action is unaffordable or no legal wall cell exists, retain goal and continue harvesting; if blaster is capped, spend on legal walls. Do not spin requests at rejected targets. Hull/turret strategy remains future tuning, not free upgrades. |
| Wall placement | Use legal empty cells toward the nearest visible approach to its core, excluding reserved spawn and route to remaining deposits. Every request is validated; do not assume a highlight guarantees success. |
| Battle with visible living enemy core | Navigate to a legal cardinal firing tile for the nearest reachable enemy core; fire at an enemy ship already on that legal line if it blocks the core. Do not shoot through blockers. |
| No reachable enemy core / sudden death | Seek nearest reachable enemy ship firing position, using visible obstacles; in sudden death move off active Belt and toward safe interior before attacking. |
| No resource / target reachable | Choose a reachable safe interior tile and reevaluate when visible state changes. Never use illegal moves, teleport, or hidden information to escape. |
| Path step repeatedly blocked | After three eligible movement opportunities without progress, recompute excluding the blocked step for that decision. If still no route, choose another reachable target; no endless firing/build rejection loop. |

Use cardinal shortest paths with the same phase passability as players, treating active Belt as lethal. Tie-break equally distant targets by `(y,x,entity ID)` and equal path choices by up/right/down/left; entity IDs must be stable in fixtures. Proposed BOT cadence: at most one decision per server tick, movement only at legal movement ticks, no bypass of human fire/purchase limits. Actions sharing a tick follow the D1 start-of-tick purchase position; navigation does not authorize a post-move build. Failed requests preserve scrap and route invariants. Enclosures can make a target inaccessible; attack a reachable enemy blocker rather than assuming wall passage, then recompute. Own walls are passable under D1/D2.

**Decision:** use a modest deterministic visible-state opponent. **Why:** a solo visitor needs a legal complete match and understandable enemy, not an optimal hidden-information adversary. “Playable” requires observed harvesting, a successful legal purchase, post-Belt navigation/attack, and termination in the accepted bound in controlled reachable fixtures. Stuck/no-resource fixtures must remain legal and bounded; winning against humans is not an acceptance requirement. D4's three uncoached solo sessions still measure comprehension and the 20-second start target; paper bot rules cannot satisfy those goals.

## Regions, links and live lists

| State / action | Selection / retained settings | Notice and recovery |
|---|---|---|
| Start page / Automatic | Parallel 2-second health probes; first available region in configured priority order, never fastest ping | Show region label and text `Available`, `Full or restarting`, `Offline`, `Incompatible`, or `Checking`. |
| Manual healthy choice | Store environment-scoped region ID, use it; Automatic clears it | Picker keeps chosen mode and current region visible. Storage failure uses memory and says preference will not persist. |
| Manual choice unavailable | Preserve preference; use automatic fallback for new Quick Play/create this visit | `Preferred region unavailable — using {region}. Your preference is saved.` Do not silently rewrite the picker to Automatic. |
| Preferred region becomes healthy | Use saved preference for the next new join after its fresh check, only while on start | `Preferred region available again.` Do not move a waiting lobby, watcher or active match. |
| Full/draining region | `accepting:false` excludes it from new player/create selection | One-region deployment: `Server full or restarting. Try again shortly.` Readiness alone cannot distinguish fullness/drain reason. |
| All regions fail health | No join sent; keep nickname/preference | `No servers available.` Retry repeats probes; manual picker remains usable. |
| Protocol mismatch | Exclude incompatible server; never ignore version check | If none compatible: `Game version mismatch. Reload to check for an update.` Reload or Return to start; no retry loop. |
| Region/environment identity mismatch or malformed health | Unavailable; no crossover | `Server unavailable.` Engineering/QA inspect diagnostics without leaking internals into UI. |
| Private /r/{region}/{room} link | Resolve region from this environment allowlist; bypass saved preference only for this join | Unknown region/invalid ID: `Invalid room link.` Offline/full cannot reroute the link to another room or region. |
| Locked room | No new player; show Watch only if allowed | `Match already started.` Watch is an explicit role choice; full watchers say `Watching is full.` |
| Stale/disposed room | No admission; never silently create same ID | `This room has closed.` Create Private room or Return to start. |
| Region healthy but join refused | Preserve selection and handle typed refusal; one public retry only | Availability is a probe, not a reservation; no promise that a full region can admit. |

Availability requires HTTP success, `status:ok`, `accepting:true`, matching protocol/environment **and reported region ID matching the requested allowlisted region**. Different build SHAs alone do not imply incompatibility when protocol agrees. Health refresh runs every 30 seconds only on start and again on new player actions. A region that is running/compatible but `accepting:false` may continue existing matches and admit watchers to existing rooms if room/server policy permits; readiness gates new match/player matchmaking, not reconnect eligibility. Reconnect always tries its bound server before its fixed deadline even during drain. Engineering must implement these distinctions rather than blocking seat restoration with new-room readiness.

Live list: request `GET /rooms` for the effective selected region, initially and every 30 seconds on start, with a 2-second timeout; Retry list is available. Return only public build/battle/sudden-death rooms with room ID, phase and fixed participant count (humans plus bot). Exclude waiting, private and ended rooms and all identity/seed/layout data. Watch is enabled on build entries, labelled `Wait for Belt drop`; it reserves an external slot but sends metadata only. Empty list says `No live matches`; request failure says `Couldn't load matches` with Retry, never an empty-success state. Switching effective region invalidates earlier health/list request generations and clears old rows; delayed old responses cannot overwrite current selection. A stale Watch row rechecks admission and handles ended/full/disposed responses. Room IDs are always interpreted together with their listed region.

**Decision:** preserve manual preference while visibly falling back, and never relocate a linked or active room. **Why:** a setting is not a room address, and independent regional memory cannot migrate a match. One production region means an outage has an offline state, not development failover.

## Keyboard, copy and flow inventory

All wireframes use plain DOM text around the Canvas board. [D1 UI](D1_UI.md) and [D2 UI](D2_UI.md) supply gameplay focus and HUD; this section completes journey focus. Status never depends only on color, animation, hover or sound. Buttons have visible focus; nickname errors associate with the field. Use a polite live status region for admissions/reconnect/role changes, not an announcement every timer tick. Countdown is readable text; announce initial timer, final warning and expiry once. Do not reveal bot/role state only through an icon.

```text
START
Harvest scrap. Protect your core. Last contender wins.
A living core rebuilds your ship; lose your core and your next death is final.
Nickname [ Alex           ]    [ Quick Play ]  [ Private room ]
Solo Quick Play starts with one labelled BOT.
Live matches — New York: [ Build · 3 players · Wait for Belt drop ]
Region [ Automatic — New York, Available v ]  [ Retry servers ]

PRIVATE LOBBY
Private room · New York · 1/5 participants
Alex — HOST                 Salvager — BOT (when added)
[ Copy link ] [ Add BOT / Remove BOT ] [ Start match ] [ Leave ]
One human alone needs BOT. A friend joining replaces BOT before start.

WATCHING BUILD
Watching · Belt drops in 0:42
Base layouts stay hidden until the Belt drops. [ Leave ]

CONNECTION LOST
Reconnecting — estimated seat window 0:18
Your ship can still be attacked. [ Leave match ]

RESULTS / CLOSED
Winner: Alex / Draw: Alex, Sam       This match has closed.
[ Play Again — new private room ] [ Return to start ]
Share the new link with your friends.
```

| Screen / transition | Keyboard sequence and focus recovery |
|---|---|
| Start | Nickname → Quick Play → Private room → available Watch rows → Region → applicable Retry. Link landing: Nickname → Join room → Watch if applicable → Return to start; region binding is readable. |
| Invalid nickname | Keep field focused with normalized value and `Enter a nickname of 1–16 characters.` No join; nickname normalization counted in code points, not UTF-16 units. |
| Joining / cancel | Progress status, Cancel remains keyboard reachable; failure/cancel restores initiating button. If Cancel wins locally after admission, leave the admitted seat and close its socket. |
| Lobby admission | Focus heading once, then public Leave; private Copy link → host Add/Remove BOT → host Start → Leave. Disabled controls have nearby reasons; non-host sees `Waiting for host {name}`. |
| Host transfer / roster changes | Announce new host; retain focus if control still exists, else move to lobby heading. Start never steals focus simply because enabled. Clipboard unavailable shows a selectable link plus copy instructions. |
| Build starts | Focus game surface once with visible control hint; clear held-key state. No Tab/form/button key sends gameplay. |
| Build watch → battle watch | Retain heading/Leave focus, announce `Belt down — now watching`; no game-input focus or gameplay bindings. |
| Elimination | Keep current focus if valid; announce watcher role, remove shop/gameplay actions. Tab reaches Leave; during build show metadata countdown only. |
| Reconnect loss/success | Retain valid focus and clear intent. Restore controls only after state and fresh focused key press; if focused element disappeared, focus current role heading. |
| Recovery failure / closed room | Focus failure heading once; Tab reaches explicit Watch if eligible → Return to start / Retry as relevant. Known result expiry keeps existing focus/actions. |
| Leave confirmation | Default Cancel; Tab Leave; Escape cancels to invoking control. Confirmed leave returns to start with Quick Play focused and status announced. |
| Play Again | Clear old state; new lobby admission focuses new heading. Failure restores Play Again; new private link is explicitly different. |
| Region/list change | Keep picker/initiating control focus; if a focused Watch row disappears, focus live-list heading. Never focus an entry from an old response. |

Readable labels distinguish YOU, HOST, BOT, WATCHING, disconnected, core active/destroyed and respawn/eliminated without color. Region status includes text and last probe time; latency is informative, never sorting. UI layouts must reflow with browser text zoom; actual contrast, focus, layout and assistive-technology behavior remain built-browser review requirements. No new framework, assets, chat or tutorial service is required.

## Observable acceptance scenarios

These are proposed Q4 oracles, not QA cases executed by this author. QA chooses real SDK/browser fixtures and records full SHA/config, server scheduling, bot seed, browser and network. Inspect received serialized state for privacy/role checks, not just pixels.

| Case | IDs | Given / When / Then |
|---|---|---|
| J01 | A01/A02/A08 | Lone human activates Quick Play: connected lobby within 10 seconds; at its fixed deadline exactly one labelled BOT; live build and legal movement within 20 seconds on agreed network. Later arrivals do not reset deadline. |
| J02 | A02/A08 | Second human admission wins before countdown/start: two humans, no bot. Five humans start immediately; sixth cannot enter as player. |
| J03 | A02/A08/A12 | Private host alone cannot start; Add BOT succeeds once; duplicate/non-host/public/add-after-lock requests cannot add a seat or mutate timer. Second human replaces private BOT if admission wins; start-first instead refuses player admission. |
| J04 | A02 | Waiting host disconnects with two humans: earliest remaining human becomes host, room/link remain, no countdown starts; no human remaining disposes. Old host return is not an automatic authority restoration. |
| J05 | A02/A09 | Active host leaves: immediate voluntary elimination when delivered, no transfer/restart. Failed delivery shows vulnerable disconnect grace rather than claiming server acknowledgement. |
| J06 | A09/A04 | Disconnect at d, recover d+299: same seat's current role and authorized phase view; expiry d+300: permanently eliminated, no pending spawn; d+301 old credential cannot restore player. Death/respawn during absence never extends deadline. |
| J07 | A09/A12 | Missing, forged, rotated or room/region-mismatched credential cannot impersonate by nickname; replacement closes old owner; interrupted rotation acknowledgement has a documented bounded recovery test. No credential in URL/public state/logs. |
| J08 | A09/A04 | Core loss eliminates absent awaiting-respawn seat before expiry: recovery yields watcher, no gameplay or build entities; disposal during recovery returns closed-match state without a guessed winner. |
| J09 | A07/A09 | Play Again during/after result window creates/joins fresh room; old token cannot affect it. Private replay creates new link/host; no group migration. Duplicate activation creates at most one live new-room membership. |
| J10 | A08/A04/A05 | BOT build fixture: filtered own-sector input; reachable deposit harvested, one legal wall then upgrade when funded. Swapping unseen enemy layouts while visible input/seed stays fixed cannot change bot decisions. |
| J11 | A08/A06/A07 | BOT blocked-path/no-resource/capped-upgrade fixtures: replans after three movement opportunities, no illegal purchases or Belt invulnerability; reachable battle fixture shows attack; every layout ends within accepted D2 bound. |
| J12 | A10/A04/A12 | Ten external watchers including build waiters admitted; eleventh refused. Five former players may retain their own connections separately. Elimination never increases external allowance or grants a second seat exemption. |
| J13 | A10/A04 | Build watcher receives only allowlisted metadata; eliminated build player loses sector entities immediately; at reveal receives full authorized world. Watcher move/fire/start/bot requests never mutate state. |
| J14 | A10/A11 | Public list excludes waiting/private/ended. Build Watch waits with countdown. Stale/full/ended row gives correct refusal; list timeout differs from no matches. Private locked link requires explicit Watch. |
| J15 | A11 | Preferred A unavailable, compatible B healthy: fallback to B, saved A retained. A restore changes next start-page join after health recheck; current room does not move. Automatic clears saved preference. |
| J16 | A11/A12 | Wrong protocol/environment/reported region, malformed health or timeout: no join to that endpoint. Different SHA with matching protocol is not itself mismatch. All unavailable offers Retry; one-region outage never selects development. |
| J17 | A11 | Private link A while preference B: only A attempted. A down/full/room gone returns bound failure, never joins B. Drain does not redirect existing reconnect; watcher admission evaluates its own capacity. |
| J18 | A11 | Region switch A→B while A response delayed: A health/list response cannot alter B mode/rows; focused removed row recovers to live-list heading. |
| J19 | A02/A08/A09/A10/A11 | Keyboard-only happy/failure/retry/leave/replay paths follow focus table; Space on buttons sends no fire; color hidden still leaves roles/hazards/status understandable. |
| J20 | A02/A12 | Private inactive at 4:30 shows 30-second warning, expires at 5:00; valid action resets inactivity; malformed spam/polling does not. Link expires, no reuse of identity/room ID. |

No row is marked Passed. Engineering confirms the lobby serialization, inactivity timer, watcher budget, reconnect issuance/rotation and typed refusal/message mapping; QA accepts testable boundary oracles; maintainer coordinates disposition. Runtime G5 requires E5/E6/Q4 plus D4 observations. G1 still separately requires Design movement/control review and independent Q1, currently owned under #32.
