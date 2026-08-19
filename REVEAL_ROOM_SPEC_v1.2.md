# Reveal Room — Product & Technical Specification

> **Status:** v1.2 implementation specification  
> **Working product name:** Reveal Room  
> **Last reviewed:** 2026-08-18  
> **Functional source of truth:** `REVEAL_ROOM_SPEC_v1.2.md`  
> **Canonical visual source of truth:** `reveal-room-showroom.html`

---

## 0. How to use this specification

This document is intentionally prescriptive. The implementation must follow it unless a requirement is technically impossible or internally contradictory.

Rules:

1. Do not silently change product behavior.
2. Keep the v1 stack intentionally small.
3. Prefer native browser and Node.js APIs over dependencies.
4. Do not introduce a database, Redis, Supabase, hosted realtime service, authentication provider, analytics service, UI kit, Tailwind, component library, state-management library, i18n library, WebSocket library, or ORM.
5. All game/room state is ephemeral and exists only in the memory of one Node.js process.
6. A process restart, redeploy, crash, or replacement is allowed to destroy all rooms.
7. A room must also delete itself after it has had no active host or participants for 5 minutes.
8. The application must be fully usable in English and Italian.
9. The secret must never be sent to player clients before it has actually been revealed.
10. If implementation work uncovers a genuine contradiction, add an entry to the Decision Log at the end of this file before implementing the resolution.

Requirement IDs (`RR-*`) and acceptance criteria (`AC-*`) should be referenced in implementation tasks and reviews.

## 0.1 Source-of-truth hierarchy

The implementation is governed by **two canonical artifacts**:

1. `REVEAL_ROOM_SPEC_v1.2.md` — product behavior, architecture, state, security, realtime, validation, accessibility, routes, and acceptance criteria.
2. `reveal-room-showroom.html` — visual identity, composition, spacing, proportions, surface treatment, hierarchy, responsive feel, puzzle presentation, host dashboard styling, and final reveal styling.

### RR-SOT-001

Every implementation agent that touches UI must read both artifacts before editing UI code.

### RR-SOT-002

`reveal-room-showroom.html` is not optional inspiration. It is the canonical visual reference for v1.

The production application should look recognizably like that showroom rather than merely using the same colors.

### RR-SOT-003

If the two artifacts appear to conflict:

1. security, correctness, accessibility, and product behavior in this spec win;
2. otherwise the showroom wins for visual appearance and composition;
3. make the smallest deviation necessary;
4. document any meaningful unavoidable visual deviation in the Decision Log.

### RR-SOT-004

The showroom is **not production source code**.

Do not blindly paste its monolithic HTML/CSS into the application. Recreate the design with production React components, responsive CSS, real interactions, semantic markup, and the architecture defined in this spec.

### RR-SOT-005

The showroom itself contains meta/showcase sections used to demonstrate multiple application states.

The real public website must **not** expose showroom-only content such as:

- `Visual showroom · v1`;
- numbered showcase section labels such as `01 · Create`, `02 · Host`, etc.;
- design-token specimen sections;
- fake browser chrome;
- multiple route mockups on the same production page;
- explanatory copy that exists only to describe the design reference.

Instead:

- `/` uses the showroom's top navigation and hero direction as the real landing page;
- `/create` uses the showroom's Room Creation reference;
- `/host/[code]` uses the showroom's Live Host Dashboard reference;
- `/r/[code]` uses the showroom's phone/player/puzzle references;
- completed room state uses the showroom's `Unsealed.` reference.

### RR-SOT-006

Do not reinterpret the design into a generic SaaS template, admin dashboard, Tailwind starter aesthetic, neon game UI, casino UI, or unrelated design system.

---


# 1. Product definition

## 1.1 Summary

Reveal Room is a lightweight web party game for revealing a secret through a short sequence of puzzles.

A host creates a temporary room, enters any text to reveal, configures the game, and shares a public room link. One or more players join from their phones. Solving generated challenges progressively reveals the secret or unlocks it entirely at the end.

The secret can be anything that is meaningful as text:

- a gift-card or redemption code;
- a short message;
- a clue;
- a temporary password;
- an invitation;
- a location;
- a surprise announcement;
- a prize code.

The application must not contain gift-card-specific product logic.

## 1.2 Product principles

- **Ephemeral by design.** Rooms disappear automatically.
- **No accounts.** Opening a room should take seconds.
- **Phone-first.** The primary use case is several people around a table using phones.
- **Simple enough to understand immediately.**
- **Playful, not childish.**
- **Generic reveal engine.**
- **Minimal infrastructure.**
- **No fake security claims.** The secret is plaintext in the trusted server process while a room exists.

## 1.3 v1 goals

### RR-PROD-001
A host can create a complete playable room in under one minute.

### RR-PROD-002
The host receives a shareable player URL of the form:

`/r/{ROOM_CODE}`

### RR-PROD-003
The host can control the room from:

`/host/{ROOM_CODE}`

Host control access must require a secret host token stored on the host device, not included in the URL.

### RR-PROD-004
The application supports:

- Solo mode;
- Party mode;
- Progressive reveal;
- Reveal only at completion;
- 3–8 generated challenges;
- English;
- Italian.

### RR-PROD-005
Rooms must work without persistent storage.

### RR-PROD-006
The final reveal must feel like a meaningful completion moment and provide a one-tap Copy action.

---

# 2. Explicit non-goals for v1

The following are out of scope:

- user accounts;
- OAuth;
- persistent room history;
- databases;
- Redis/KV hosted services;
- cross-process state replication;
- payments;
- billing;
- public room discovery;
- leaderboards;
- matchmaking;
- user-generated puzzle scripts;
- AI-generated puzzles;
- image/audio uploads;
- custom themes;
- remote analytics;
- email/SMS delivery;
- push notifications;
- native apps;
- PWA installation requirements;
- QR-code generation;
- WebRTC;
- WebSockets;
- external realtime infrastructure;
- admin dashboard;
- moderation tooling;
- localization beyond `en` and `it`.

A clean extension point is desirable, but v1 must not pre-build these features.

---

# 3. Runtime and stack

## 3.1 Required stack

### RR-TECH-001
Use:

- Next.js 16.x App Router;
- TypeScript with `strict: true`;
- React version supported by the selected Next.js version;
- Node.js runtime;
- plain CSS / CSS Modules or a small global CSS system;
- Upstash Redis as the shared ephemeral room-state layer (production);
- ordinary `fetch` for client → server mutations;
- ordinary `fetch` polling for server → client room updates;
- native Node.js/Web APIs for cryptography, timers, collections, streams, and IDs.

Target Node.js 24 for production.

### RR-TECH-002
Do not use Tailwind.

### RR-TECH-003
Do not use an external state-management library.

Local component state, React context where genuinely useful, and server snapshots are sufficient.

### RR-TECH-004
Do not use an i18n library.

Use typed local dictionaries.

### RR-TECH-005
Runtime dependency budget:

- `next`
- `react`
- `react-dom`
- `@upstash/redis` (production shared room state only)

No other runtime dependency is expected for v1.2.

A test runner such as Vitest is allowed as a development dependency.

---

# 4. Deployment model

## 4.1 Canonical deployment

### RR-DEPLOY-001
The canonical production deployment is **Vercel with Upstash Redis** as the shared ephemeral room-state layer.

Room state lives in Redis, not in function-instance memory, so requests may be served by any number of horizontally scaled function instances. Redis TTL is the authoritative room cleanup mechanism.

A single-process Node.js deployment (a Docker container or a systemd/PM2 unit) remains a supported fallback for small self-hosted environments, but it is no longer the canonical v1.2 target.

### RR-DEPLOY-002
Room state is shared through Redis. No request depends on a particular function instance.

## 4.2 Vercel correctness

### RR-DEPLOY-003
Vercel function instances may be reused, replaced, paused, or horizontally scaled. v1.2 is correct under that model because:

- room state is read/written through a Redis-backed repository;
- every mutation runs under a per-room distributed lock;
- client synchronization uses polling, not a process-local event stream;
- Redis TTL replaces process garbage-collection timers.

A room may still be lost on process restart only in the sense that Redis is ephemeral storage: rooms expire by TTL (empty rooms ~5 minutes after the last actor goes inactive, hard cap 24 hours). This is intended behavior, not durable storage.

## 4.3 No custom Next.js server

### RR-DEPLOY-004
Do not introduce a custom Next.js HTTP server unless the standard Node.js deployment proves insufficient.

Next.js Route Handlers are the intended implementation.

---

# 5. Information architecture and routes

Required pages:

```text
/
├── /create
├── /r/[code]
├── /host/[code]
└── not-found
```

Required API shape:

```text
POST   /api/rooms
GET    /api/rooms/[code]
DELETE /api/rooms/[code]

POST   /api/rooms/[code]/join
POST   /api/rooms/[code]/presence
GET    /api/rooms/[code]/challenge
POST   /api/rooms/[code]/answer
POST   /api/rooms/[code]/host-action
```

There is no `events` endpoint in v1.2: client synchronization uses polling of
`GET /api/rooms/{code}` (see §18).

Every room API Route Handler must use the Node.js runtime explicitly where appropriate.

---

# 6. Landing page

## 6.1 Purpose

The landing page should explain the product in seconds.

## 6.2 Required UI

### RR-UI-001
The landing screen contains:

- Reveal Room wordmark / simple seal icon;
- concise headline;
- one-sentence explanation;
- primary `Create a room` CTA;
- a `Join a room` area with a 6-character room-code input;
- language toggle: `EN / IT`.

No marketing carousel, pricing, feature grid, testimonials, or footer bloat.

### RR-UI-002 — Canonical landing composition

The real `/` landing page must take its composition directly from the showroom hero:

- compact floating/sticky top bar;
- Reveal Room seal mark + wordmark on the left;
- minimal navigation/actions on the right;
- dark atmospheric background;
- large left-aligned headline with the yellow accent reserved for the key phrase;
- concise supporting paragraph;
- `Create a room` as primary CTA;
- `Join with code` as secondary action;
- small trust/constraint line such as `No accounts · Ephemeral rooms · Solo or party`;
- right-side layered mobile product preview on wide screens;
- clean single-column adaptation on mobile.

Do not put the complete showroom below the hero on the actual landing page. The showroom's remaining sections are references for other application routes/states.

### Suggested English copy

Headline:

`Make them earn the reveal.`

Supporting copy:

`Hide a message behind a few quick puzzles, share the room, and reveal it together.`

### Suggested Italian copy

Headline:

`Fagli conquistare la sorpresa.`

Supporting copy:

`Nascondi un messaggio dietro qualche puzzle, condividi la stanza e svelalo insieme agli altri.`

Exact copy may be polished, but meaning and brevity should remain.

---

# 7. Create-room flow

Route: `/create`

## 7.1 Fields

### RR-CREATE-001 — Secret

Required multiline text input.

Constraints:

- 1–280 grapheme clusters;
- must contain at least one non-whitespace grapheme;
- maximum UTF-8 payload size: 2 KiB;
- treat as plain text only;
- preserve line breaks.

Label:

- EN: `What should they unlock?`
- IT: `Cosa devono sbloccare?`

Helper text must clarify that the content exists only for the lifetime of the room.

### RR-CREATE-002 — Title

Optional.

Constraints:

- maximum 80 grapheme clusters;
- default:
  - EN: `A secret is waiting`
  - IT: `C'è una sorpresa da sbloccare`

### RR-CREATE-003 — Final message

Optional.

Constraints:

- maximum 160 grapheme clusters;
- shown only when the secret is fully revealed.

Example:

- EN: `Happy birthday. You earned it.`
- IT: `Buon compleanno. Te lo sei guadagnato.`

### RR-CREATE-004 — Mode

Segmented control:

- `Solo`
- `Party`

Solo means one designated player solves every challenge.

Party means challenges are assigned across the player roster.

### RR-CREATE-005 — Reveal mode

Segmented control:

- `Progressive`
- `At the end`

Progressive reveals additional graphemes after each solved challenge.

At the end keeps the whole secret masked until the final challenge is solved.

### RR-CREATE-006 — Challenge count

Allowed values:

`3, 4, 5, 6, 7, 8`

Default: `5`.

Use a small stepper or segmented selector.

### RR-CREATE-007 — Game language

Allowed:

- English
- Italiano

This locale controls room UI and locale-specific word puzzles.

### RR-CREATE-008 — Create action

`Create room` sends the secret to the server over the same origin and creates the in-memory room.

On success:

1. receive room code and host access token;
2. save host token in `localStorage` under a room-specific key;
3. never save the secret in localStorage;
4. navigate to `/host/{code}`.

---

# 8. Room identifiers and access tokens

## 8.1 Public room code

### RR-SEC-001
Use a 6-character uppercase room code.

Alphabet:

`ABCDEFGHJKMNPQRSTUVWXYZ23456789`

Excluded ambiguous characters:

- I
- L
- O
- 0
- 1

Generate cryptographically random codes.

Retry collisions up to a bounded number of attempts.

## 8.2 Host token

### RR-SEC-002
Generate a cryptographically random host token of at least 256 bits.

Return plaintext only in the create-room response.

Store only a SHA-256 hash in room state.

The client stores the plaintext token in:

`localStorage["reveal-room:host:{code}"]`

The token must never appear:

- in a URL;
- in query parameters;
- in logs;
- in public room state;
- in public room state or API payloads.

Host mutations send:

`Authorization: Bearer {hostToken}`

### RR-SEC-003
If `/host/{code}` is opened on a device without the stored token, show a non-destructive error state:

`Host access is not available on this device.`

Do not provide a bypass.

## 8.3 Participant token

### RR-SEC-004
Joining creates:

- random participant ID;
- random participant token of at least 128 bits;
- participant token hash stored server-side.

Store participant credentials locally under a room-specific key so refresh/reopen can resume the same participant while the room still exists.

Participant-authenticated calls use:

`Authorization: Bearer {participantToken}`

The participant ID may be sent as a normal request field/header.

---

# 9. Room state model

The exact internal types may differ, but behavior must match the following model.

```ts
type Locale = 'en' | 'it'
type GameMode = 'solo' | 'party'
type RevealMode = 'progressive' | 'final'
type RoomStatus = 'lobby' | 'playing' | 'paused' | 'completed'
type ParticipantRole = 'player' | 'spectator'

interface PresenceState {
  lastSeenAt: number
}

interface Participant {
  id: string
  tokenHash: string
  displayName: string
  role: ParticipantRole
  joinedAt: number
  presence: PresenceState
  assignedCount: number
  completedCount: number
}

interface ChallengeInstance {
  id: string
  index: number
  type: ChallengeType
  assigneeId: string
  payload: unknown
  answer: unknown
  attempts: number
  createdAt: number
  completedAt?: number
}

interface Room {
  version: number
  code: string
  title: string
  secret: string
  finalMessage?: string
  locale: Locale
  gameMode: GameMode
  revealMode: RevealMode
  challengeCount: number

  status: RoomStatus

  hostTokenHash: string
  hostPresence: PresenceState

  participants: Map<string, Participant>

  currentChallenge?: ChallengeInstance
  challengeHistory: ChallengeInstance[]

  revealOrder: number[]
  revealedMaskableCount: number

  createdAt: number
  startedAt?: number
  completedAt?: number
}
```

Notes for v1.2:

- `version` starts at 1 and increments on every visible/state mutation. It is
  exposed in public snapshots for polling clients.
- `emptySince` and `eventSequence` from v1.1 are removed: TTL replaces
  empty-room bookkeeping, and polling replaces event sequences.
- Persisted state uses an explicit serializable representation (participants
  as a record, not a `Map`). Runtime-only data (locks, Redis keys) is never
  part of room state.
- A room is stored as one serialized JSON object per code; whole-room
  serialization is intentionally simple for party scale.

---

# 10. Room repository and distributed state

## 10.1 Repository boundary

### RR-RUNTIME-001
Game/domain code must not care whether room state comes from Redis or memory.

Introduce a persistence boundary with this intent:

```ts
interface RoomRepository {
  create(room: Room): Promise<boolean>       // false on code collision
  get(code: string): Promise<Room | null>
  mutate<T>(code: string, operation: (room: Room) => T | Promise<T>): Promise<T | null>
  delete(code: string): Promise<void>
}
```

Production uses `RedisRoomRepository` backed by Upstash Redis. Tests and
explicit local development modes use `MemoryRoomRepository`. There is exactly
one copy of the business rules: the domain layer.

No production fallback to memory: if Redis configuration is missing in a
production environment, repository construction must fail loudly, never
silently use memory.

## 10.2 Repository selection

Environment policy:

```text
NODE_ENV=test
    → MemoryRoomRepository

development with USE_MEMORY_STORE=true
    → MemoryRoomRepository

otherwise (including all Vercel environments)
    → RedisRoomRepository required (missing config = configuration error)
```

## 10.3 Distributed mutation lock

### RR-RUNTIME-002
Vercel can execute two function instances mutating the same room concurrently.

Every room mutation must run under a per-room distributed lock:

```text
SET rr:lock:{code} {randomToken} NX PX 5000
```

- lock TTL: 5000 ms;
- acquisition retries every ~40–100 ms, bounded maximum wait ~1500–2500 ms;
- on acquisition timeout, return a retryable server error (503); never corrupt state;
- release only with an atomic compare-and-release script (delete only if the
  stored token equals the caller's token), always in `finally`.

Canonical mutation flow inside the lock:

```text
1. acquire per-room lock
2. GET room
3. if missing → ROOM_NOT_FOUND
4. deserialize
5. validate auth / state / current challenge
6. mutate domain state
7. increment room.version
8. recompute room expiry (see §11.4 / §41)
9. SET serialized room with the computed expiry
10. release lock (finally)
```

No external network work happens inside the lock beyond the minimum Redis
operations required for the mutation.

## 10.4 Room version

Persisted rooms carry `version: number` (starting at 1), incremented on every
visible/state mutation. Public snapshots expose `version` so polling clients
can skip React state churn when nothing changed.

---

# 11. Presence model

This is a core product behavior.

## 11.1 Heartbeats

### RR-PRES-001
Every authenticated host or participant client sends a presence heartbeat every:

`15 seconds`

Authenticated game API activity should also refresh that actor's `lastSeenAt`.

## 11.2 Active window

### RR-PRES-002
An actor is active if:

`now - lastSeenAt <= 45 seconds`

This allows two missed heartbeats before the actor is considered gone.

## 11.3 Room expiry (replaces process deletion)

### RR-PRES-003
Room deletion is TTL-driven in Redis; there is no process garbage-collection
timer. A room expires approximately `5 minutes` after the final actor becomes
inactive. Since an actor is active for 45 seconds after its last presence
activity, the expiry candidate is:

```text
latest relevant lastSeenAt (host or any participant)
  + PRESENCE_TIMEOUT_MS (45 s)
  + EMPTY_ROOM_TTL_MS   (5 min)
```

capped by the absolute room TTL:

```text
roomExpiresAt = min(
  createdAt + ABSOLUTE_ROOM_TTL_MS (24 h),
  latestActorLastSeenAt + 45 s + 5 min
)
```

The Redis key is written with this absolute expiry. Any mutation that changes
presence (heartbeat, join, authenticated activity) recomputes and reapplies
the expiry. **Public room polling must never extend the expiry.**

### RR-PRES-004
Presence means host **or** participant presence. A host keeping the control page open keeps the room alive.

## 11.4 Cleanup strategy

### RR-PRES-005
Cleanup is authoritative Redis TTL only. No server-side interval sweeps, no
opportunistic in-process sweeps.

Because Redis expires the whole room key, `emptySince` bookkeeping is not
needed in v1.2; the expiry formula models the same user-visible behavior
(room dies ~5 minutes after the last actor's 45-second active window lapses).

## 11.5 Absolute TTL

### RR-PRES-006
Every room has a hard maximum lifetime of:

`24 hours`

The expiry formula never exceeds `createdAt + 24 h`. This bounds accidental
retention and is not user-configurable in v1.2.

## 11.6 Immediate delete

### RR-PRES-007
The host can explicitly delete a room at any time.

Deletion:

- removes the room key from Redis;
- causes subsequent API calls to return room-not-found;
- clears local host storage when the host UI receives the deletion state/error.

---

# 12. Joining and roster behavior

## 12.1 Lobby join

### RR-JOIN-001
A player opens `/r/{code}`.

If the room exists and is in `lobby`, show:

- room title;
- host-selected locale;
- masked secret preview;
- name field;
- `Join room`.

Display name:

- 1–24 grapheme clusters;
- trim surrounding whitespace;
- plain text;
- duplicate names are allowed.

## 12.2 Resume

### RR-JOIN-002
If valid participant credentials for the room already exist in localStorage, attempt to resume that participant automatically.

If credentials are invalid or room no longer exists, discard them and show the normal join state.

## 12.3 Late joins

### RR-JOIN-003
If a room is already `playing` or `paused`, new joins are allowed only as `spectator`.

Spectators:

- appear in the roster;
- receive public progress updates;
- are never assigned a challenge for the current game;
- see the final reveal.

A host can reset to lobby before starting again if late players should participate.

## 12.4 Solo

### RR-JOIN-004
In Solo mode:

- the first lobby participant is the player;
- additional joins become spectators;
- start requires at least one active player.

## 12.5 Party

### RR-JOIN-005
In Party mode:

- all lobby participants are players until the maximum player count;
- maximum active player roster: `12`;
- additional joins become spectators;
- starting should normally require at least 2 active players;
- if only one active player exists, the host UI should explain why Start is disabled.

---

# 13. Host lobby

Route: `/host/{code}`

## 13.1 Required display

### RR-HOST-001
Show:

- room title;
- room code prominently;
- player link;
- `Share` button using Web Share API when available;
- `Copy link` fallback;
- game mode;
- reveal mode;
- number of challenges;
- connected roster with active/inactive indication;
- Start button.

Do not display the full secret before completion.

## 13.2 Start behavior

### RR-HOST-002
On Start:

- validate required active player count;
- freeze current lobby players as the game's player roster;
- change status to `playing`;
- set `startedAt`;
- generate challenge 1;
- assign challenge 1;
- publish a fresh public snapshot (clients pick it up on their next poll).

---

# 14. Party assignment

## 14.1 Fair assignment

### RR-GAME-001
For Party mode, assign each new challenge to an active game player with the lowest `assignedCount`.

If several players are tied, choose randomly.

Increment `assignedCount` when assignment occurs.

This should keep challenge distribution approximately balanced without introducing a scheduler.

## 14.2 Solo assignment

### RR-GAME-002
Every challenge is assigned to the Solo player.

## 14.3 Inactive assignee

### RR-GAME-003
If the current challenge assignee becomes inactive for more than the 45-second presence window:

- if another active game player exists, reassign the same challenge to an eligible active player;
- do not regenerate the answer;
- increment assignment accounting for the new assignee only if needed by the chosen implementation;
- publish a snapshot.

If no active game player exists, leave the game waiting.

When an eligible player returns, the challenge may be assigned/reassigned automatically.

The host always has `Skip challenge` as an escape hatch.

---

# 15. Game state machine

Allowed transitions:

```text
lobby
  └── start ──> playing

playing
  ├── pause ──> paused
  ├── final challenge solved ──> completed
  ├── reveal now ──> completed
  └── reset ──> lobby

paused
  ├── resume ──> playing
  ├── reveal now ──> completed
  └── reset ──> lobby

completed
  └── reset ──> lobby
```

### RR-STATE-001
Invalid state transitions return `409 Conflict` with a machine-readable error code.

### RR-STATE-002
Reset:

- keeps the room;
- keeps title, secret, locale, mode, reveal mode, and configured challenge count;
- keeps participant identities in the lobby;
- clears challenge history;
- clears current challenge;
- clears progress/reveals;
- resets participant assignment/completion counters;
- clears started/completed timestamps;
- sets status to `lobby`.

Spectators from the previous running game become normal lobby participants, subject to mode/player limits when the next game starts.

---

# 16. Host controls during play

### RR-HOST-CTRL-001
Host controls:

- Pause;
- Resume;
- Skip current challenge;
- Reveal now;
- Reset game;
- Delete room.

Dangerous actions require a lightweight confirmation dialog:

- Reveal now;
- Reset game;
- Delete room.

### RR-HOST-CTRL-002 — Skip

Skipping the current challenge:

- marks it as skipped in history or equivalent stats;
- advances progress exactly as if a challenge had been completed;
- generates/assigns the next challenge unless this was the final challenge;
- reveals the appropriate portion of the secret.

### RR-HOST-CTRL-003 — Reveal now

Reveal now:

- reveals the entire secret;
- marks status `completed`;
- sets `completedAt`;
- does not require remaining challenges.

---

# 17. Public room snapshot

### RR-API-001
Player-facing GET payloads must use a sanitized public state.

Example conceptual type:

```ts
interface PublicRoomState {
  version: number
  code: string
  title: string
  locale: Locale
  gameMode: GameMode
  revealMode: RevealMode
  challengeCount: number
  status: RoomStatus

  maskedSecret: string
  isFullyRevealed: boolean
  finalMessage?: string

  progress: {
    completed: number
    total: number
    percentage: number
  }

  roster: Array<{
    id: string
    displayName: string
    role: ParticipantRole
    isActive: boolean
    assignedCount: number
    completedCount: number
  }>

  currentChallenge?: {
    id: string
    index: number
    type: ChallengeType
    assigneeId: string
  }

  stats?: {
    elapsedMs: number
    totalAttempts: number
  }
}
```

### RR-API-002
`finalMessage` must be omitted until the room is fully revealed.

### RR-API-003
The following must never exist in public state:

- full unrevealed secret;
- host token/hash;
- participant token/hash;
- challenge answer;
- secret reveal order;
- lock tokens;
- Redis keys;
- internal persisted fields (e.g. token hashes);
- rate-limit state.

`version` is the only persistence-adjacent value exposed, and it is safe
(monotonic state marker).

---

# 18. Client synchronization — polling

## 18.1 Why polling

Vercel functions are stateless and horizontally scaled, so a process-local
event stream cannot broadcast room updates. Clients poll the sanitized public
snapshot instead:

```text
browser
   ├── GET /api/rooms/{code} every ~1000 ms
   └── mutations through normal HTTP/fetch
```

## 18.2 Polling behavior

### RR-POLL-001
While a room UI is active, poll `GET /api/rooms/{code}` approximately every
`1000 ms` (visible tab). Background/hidden tabs may poll less frequently
(e.g. 2500–5000 ms) and must poll immediately on `visibilitychange → visible`.

### RR-POLL-002
If the snapshot `version` is unchanged, avoid unnecessary React state churn.

### RR-POLL-003
After a mutation initiated by the current client, immediately fetch a fresh
snapshot (or use the mutation response) so the acting client does not wait a
full poll interval. Other clients update on their next poll.

### RR-POLL-004
Error semantics:

- transient network failure / 5xx / 429 → keep the last valid snapshot and
  show a subtle reconnecting state;
- authoritative `404 ROOM_NOT_FOUND` → room-gone state; stop polling and clear
  stale local credentials;
- one failed poll must never by itself show the room-gone state.

### RR-POLL-005
Polling is **not** presence. Only authenticated presence/activity mutations
extend a room's expiry. Public GETs must never extend room TTL.

### RR-POLL-006
Polling GET should remain read-only. If lifecycle normalization is needed
(e.g. inactive assignee reassignment), the server may acquire the room lock and
write only when normalization is actually required; it must not write on every
poll.

---

# 19. API contracts

---

# 19. API contracts

All JSON mutation responses use:

```ts
type ApiSuccess<T> = {
  ok: true
  data: T
}

type ApiFailure = {
  ok: false
  error: {
    code: string
  }
}
```

API errors return machine-readable codes only where practical. Client dictionaries produce localized messages.

Room API responses must use:

`Cache-Control: no-store`

## 19.1 Create

`POST /api/rooms`

Body:

```ts
{
  secret: string
  title?: string
  finalMessage?: string
  locale: 'en' | 'it'
  gameMode: 'solo' | 'party'
  revealMode: 'progressive' | 'final'
  challengeCount: 3 | 4 | 5 | 6 | 7 | 8
}
```

Success:

```ts
{
  ok: true
  data: {
    code: string
    hostToken: string
    playerPath: string
    hostPath: string
  }
}
```

## 19.2 Public state

`GET /api/rooms/{code}`

Returns only `PublicRoomState`.

## 19.3 Join / resume

`POST /api/rooms/{code}/join`

New join body:

```ts
{
  displayName: string
}
```

Resume request may use stored participant ID plus Bearer participant token.

Success:

```ts
{
  participantId: string
  participantToken?: string
  role: 'player' | 'spectator'
  room: PublicRoomState
}
```

A resume does not need to rotate the token.

## 19.4 Presence

`POST /api/rooms/{code}/presence`

Authenticated either as host or participant.

Body identifies actor type and participant ID where necessary.

Response may be `204 No Content`.

## 19.5 Challenge fetch

`GET /api/rooms/{code}/challenge`

Participant-authenticated.

If requester is the active assignee, return the client-safe challenge payload.

Never return the answer.

If requester is not the assignee, return a suitable no-content/forbidden response without leaking payload.

## 19.6 Answer

`POST /api/rooms/{code}/answer`

Participant-authenticated.

Body:

```ts
{
  challengeId: string
  answer: unknown
}
```

Wrong gameplay answer:

```ts
{
  ok: true
  data: {
    correct: false
  }
}
```

Correct:

```ts
{
  ok: true
  data: {
    correct: true
  }
}
```

Correct completion mutates room state and emits a snapshot.

## 19.7 Host action

`POST /api/rooms/{code}/host-action`

Host-authenticated.

Body discriminated union:

```ts
{ action: 'start' }
{ action: 'pause' }
{ action: 'resume' }
{ action: 'skip' }
{ action: 'reveal' }
{ action: 'reset' }
```

## 19.8 Delete

`DELETE /api/rooms/{code}`

Host-authenticated.

Deletes immediately.

---

# 20. API error codes

Minimum required machine codes:

```text
INVALID_REQUEST
ROOM_NOT_FOUND
ROOM_FULL
ROOM_LIMIT_REACHED
UNAUTHORIZED
INVALID_STATE
PLAYER_REQUIRED
PLAYERS_REQUIRED
NOT_ASSIGNEE
CHALLENGE_NOT_FOUND
STALE_CHALLENGE
RATE_LIMITED
```

Suggested HTTP mapping:

- 400 — invalid input;
- 401 — token invalid/missing;
- 403 — actor not allowed;
- 404 — room/challenge not found;
- 409 — state conflict/stale challenge;
- 429 — simple runtime rate limit;
- 503 — global room limit reached.

Do not localize error prose on the server. Localize by error code on the client.

---

# 21. Puzzle engine

## 21.1 General requirements

### RR-PUZZLE-001
Puzzles must be generated independently of the secret.

### RR-PUZZLE-002
Every active challenge stores:

- unique challenge ID;
- index;
- type;
- assignee;
- safe client payload;
- canonical server answer;
- attempt count.

### RR-PUZZLE-003
Do not repeat a puzzle type until the available pool has been exhausted when possible.

### RR-PUZZLE-004
No puzzle may require an external service.

### RR-PUZZLE-005
No puzzle may depend only on color perception.

### RR-PUZZLE-006
Wrong answers have no time penalty in v1.

Show a short localized `Try again` feedback state.

### RR-PUZZLE-007
The server validates answers. Client-side validation may improve UX but cannot be the only completion gate.

Anti-cheat is not a v1 goal; server validation primarily protects game state consistency.

---

# 22. Required v1 puzzle types

Implement all six.

## 22.1 Sequence

`sequence`

Show a short number sequence and four possible next values.

Examples of safe generator families:

- constant addition;
- constant subtraction;
- multiplication by a small factor;
- alternating addition using a generated pair.

Generation must guarantee exactly one correct option.

Client submits selected numeric value.

## 22.2 Memory

`memory`

Show a sequence of 5–8 distinct/repeated glyphs for a short memorization phase, then hide it and ask the player to reproduce it by tapping glyph buttons.

Use symbols/shapes/emoji that remain distinguishable without color alone.

Server answer is the sequence.

No external timer synchronization is required.

## 22.3 Odd One Out

`odd-one-out`

Display a 3×3 or 4×4 grid of symbols where exactly one tile differs.

Server answer is the differing tile index.

Difference must be shape/glyph-based, not color-only.

## 22.4 Quick Math

`quick-math`

Display a generated arithmetic expression using small integers and `+`, `-`, `×`.

Avoid division in v1.

Keep results within a mobile-friendly mental-math range.

Use four multiple-choice answers.

## 22.5 Word Scramble

`word-scramble`

Use a small local word bank for each supported locale.

Requirements:

- common words;
- approximately 5–9 letters;
- avoid proper nouns;
- avoid obscure inflections;
- avoid accented characters in the initial word bank if they complicate input;
- provide four answer choices rather than free text.

The scrambled order must differ from the correct word.

Keep at least 20 candidate words per locale.

## 22.6 Order

`order`

Display 5 distinct small integers in random order.

Ask the player to tap them from smallest to largest.

Client submits the chosen ordered array.

Server verifies exact order.

---

# 23. Challenge progression

### RR-GAME-004
On correct answer:

1. mark current challenge complete;
2. set completion timestamp;
3. increment assignee completed count;
4. append/store in history;
5. advance reveal progress;
6. if final challenge:
   - reveal entire secret;
   - set room `completed`;
   - set `completedAt`;
7. otherwise:
   - generate next challenge;
   - assign it;
8. emit a fresh public snapshot.

### RR-GAME-005
Double-submission of an already completed/stale challenge must not advance the room twice.

Use challenge IDs and current-state checks.

---

# 24. Secret reveal engine

## 24.1 Grapheme handling

### RR-REVEAL-001
Use `Intl.Segmenter` with grapheme granularity on the server.

The reveal engine must behave sensibly with emoji and combined Unicode characters.

## 24.2 Maskable positions

### RR-REVEAL-002
Whitespace is never maskable.

Every non-whitespace grapheme is maskable, including punctuation.

Hidden grapheme:

`•`

Preserve original whitespace/newlines exactly.

Example:

Secret:

```text
ABCD-1234
See you there
```

Fully masked:

```text
•••••••••
••• ••• •••••
```

## 24.3 Reveal order

### RR-REVEAL-003
At room creation:

1. collect all maskable grapheme indexes;
2. cryptographically shuffle them;
3. store the shuffled index order server-side.

Do not send this order to clients.

This distributes progressive reveals throughout the secret rather than always exposing the prefix.

## 24.4 Progressive mode

### RR-REVEAL-004
For challenge number `i` of `N`, the target number of revealed maskable graphemes is approximately:

`ceil(maskableCount * i / N)`

The final challenge always reveals all.

## 24.5 Final mode

### RR-REVEAL-005
For `final` mode:

- completed challenges before the last reveal zero graphemes;
- the final completion reveals all graphemes.

Progress UI still advances normally.

## 24.6 Secret exposure rule

### RR-REVEAL-006
Before full reveal, no API response sent to a player/spectator may include the full plaintext secret.

Hiding plaintext with CSS is explicitly forbidden.

---

# 25. Player room UI

Route: `/r/{code}`

The page is state-driven.

## 25.1 Lobby

Show:

- room title;
- seal/lock visual;
- masked secret;
- name/join state;
- roster after joining;
- `Waiting for the host`.

## 25.2 Playing — assignee

Show:

- `Your turn`;
- challenge number, e.g. `3 / 5`;
- puzzle;
- submit/tap interaction;
- progress;
- masked secret beneath;
- roster summary.

Challenge must be the main visual focus.

## 25.3 Playing — non-assignee

Show:

- current assignee name;
- localized text such as `Marco is breaking the next lock`;
- puzzle type label, but not private challenge payload;
- progress;
- masked secret;
- roster.

This encourages players to look at the assignee's phone and participate socially.

## 25.4 Paused

Show a clear seal overlay/state:

- EN: `The host paused the game.`
- IT: `L'host ha messo il gioco in pausa.`

Do not destroy challenge state.

## 25.5 Completed

Required:

- opening/unsealed animation;
- full secret in a high-contrast copyable area;
- `Copy` button;
- final message if configured;
- elapsed time;
- completed challenge count;
- small CSS-only celebratory effect;
- respect `prefers-reduced-motion`.

If Clipboard API fails, keep the secret selectable and show a localized fallback message.

---

# 26. Host play UI

While playing, host page shows:

- room code/share action;
- progress;
- masked secret;
- current assignee;
- challenge type;
- active/inactive roster;
- Pause/Resume;
- Skip;
- Reveal now;
- Reset;
- Delete room.

The host dashboard should work comfortably on a phone but may use a wider desktop layout.

---

# 27. Visual design system

## 27.1 Canonical reference

### RR-VIS-001

`reveal-room-showroom.html` is the **canonical visual reference** for the application.

The implementation must reproduce its design language closely enough that a side-by-side comparison clearly reads as the same product.

Visual fidelity applies to:

- overall atmosphere;
- dark-first palette;
- warm yellow seal accent;
- typographic hierarchy;
- whitespace;
- thin-border surfaces;
- card proportions;
- rounded corners;
- restrained depth/shadows;
- compact floating top bar;
- lock/seal icon language;
- `SecretDisplay`;
- progress segments/locks;
- host dashboard structure;
- player phone-first structure;
- puzzle tiles/answer choices;
- presence indicators;
- completion/reveal presentation.

The showroom is stronger authority than generic implementation preferences for these areas.

## 27.2 Direction

Theme: **sealed message / lock / reveal**.

The application should feel:

- dark;
- tactile;
- restrained;
- modern;
- slightly cinematic;
- social/party-oriented without looking juvenile;
- polished enough to be portfolio-grade.

Avoid:

- casino aesthetics;
- gift-card branding;
- skeuomorphic vault doors;
- generic SaaS cards everywhere;
- excessive gradients;
- glassmorphism everywhere;
- neon cyberpunk;
- gaming HUD clutter;
- cartoon lock art;
- stock illustrations;
- large icon libraries;
- gratuitous animation.

### RR-VIS-002

Yellow is scarce. Use it primarily for:

- seal/lock identity;
- primary CTA;
- current/complete progress;
- revealed secret graphemes;
- current-turn emphasis;
- completion moment.

Do not flood large portions of the UI with yellow.

## 27.3 Palette

Use CSS variables.

Canonical base palette:

```css
--bg: #0b0d10;
--bg-2: #0f1217;
--surface: #14171c;
--surface-raised: #1b1f26;
--surface-soft: #11141a;
--text: #f5f7fa;
--muted: #9aa3af;
--faint: #6e7784;
--border: #2a3039;
--border-soft: #20252d;
--accent: #f4c95d;
--accent-strong: #ffd86b;
--accent-soft: rgba(244, 201, 93, 0.12);
--success: #77d69b;
--danger: #ff7373;
```

Exact contrast-safe adjustments are allowed, but the result must remain visually equivalent to the showroom.

### RR-VIS-003

The page background may use extremely subtle radial accent glows as in the showroom.

Do not turn the background into a decorative gradient showcase.

## 27.4 Typography

No external web-font dependency.

Use a system stack:

```css
font-family:
  Inter, ui-sans-serif, system-ui, -apple-system,
  BlinkMacSystemFont, "Segoe UI", sans-serif;
```

If `Inter` is unavailable locally, system UI is expected.

### RR-VIS-004

Headlines should use:

- high weight;
- tight tracking;
- compact line height;
- strong size contrast.

The landing hero should feel substantially larger than normal application headings.

Secret/code text uses a monospace/system-monospace treatment.

## 27.5 Shape and surface language

Canonical guidance:

- main showcase/application cards: approximately 18–28 px radius depending on scale;
- inputs/buttons: approximately 9–12 px radius;
- thin low-contrast borders;
- dark raised surfaces;
- restrained shadows;
- occasional subtle inner highlight;
- generous touch targets;
- no borderless sea of floating text.

The seal/lock icon should be inline SVG or CSS, not an icon dependency.

## 27.6 Landing website

### RR-VIS-005

The real `/` page is based on the showroom hero, not a generic marketing site.

Wide layout:

- approximately two-column;
- text/CTA left;
- layered player-phone previews right;
- preview phones intentionally overlap and use modest rotation/depth;
- right side is product UI, not illustration.

Mobile layout:

- single column;
- headline first;
- CTAs next;
- product previews below;
- no horizontal clipping of essential content.

Do not add unrelated marketing sections merely because common landing pages have them.

## 27.7 Create-room screen

### RR-VIS-006

`/create` should visually follow the showroom's room-creation board:

- contained central application surface;
- clear form card;
- simple preview card where space allows;
- compact segmented controls;
- discrete numeric challenge selector;
- visible masked-secret preview;
- yellow primary Create action;
- minimal chrome.

On narrow phones, stack form and preview vertically or omit the redundant preview if necessary to preserve usability.

## 27.8 Host dashboard

### RR-VIS-007

`/host/[code]` should follow the showroom dashboard hierarchy:

Primary region:

- room code/share actions;
- current challenge;
- current assignee;
- current masked reveal/progress.

Secondary region:

- participant roster;
- active presence dots;
- compact host controls.

The host dashboard must feel like a game control surface, not an enterprise admin panel.

Danger actions should visually remain secondary until confirmation.

## 27.9 Player/puzzle presentation

### RR-VIS-008

`/r/[code]` is phone-first and should closely follow the showroom phone screens.

Lobby:

- compact brand/top row;
- lock/seal centerpiece;
- room title;
- masked secret;
- roster;
- waiting state.

Assignee challenge:

- small current-turn eyebrow;
- clear puzzle title;
- large central puzzle interaction;
- challenge progress;
- masked secret below.

Non-assignee:

- preserve the same shell;
- replace private puzzle details with current assignee/social waiting context.

### RR-VIS-009

Puzzle UI should be visually consistent across all six puzzle types.

Common language:

- dark tiles;
- thin borders;
- rounded corners;
- yellow current/selected state;
- strong centered challenge instruction;
- no puzzle-specific visual theme that breaks the application identity.

## 27.10 Signature component — SecretDisplay

### RR-VIS-010

`SecretDisplay` is a signature UI element and must match the showroom's feel.

Requirements:

- dark bordered card;
- tiny uppercase/faint label;
- monospace-like secret text;
- revealed graphemes use accent emphasis;
- masked graphemes use subdued gray;
- preserved whitespace/newlines;
- safe wrapping;
- no layout jump when a mask becomes the original grapheme;
- subtle reveal transition only;
- final full-secret state remains selectable.

## 27.11 Progress language

### RR-VIS-011

Represent challenge progression as a row of small rounded lock/segment markers as in the showroom.

States:

- completed — accent;
- current — partially/accent-emphasized;
- remaining — subdued dark segment.

Do not replace this with a large generic progress bar unless needed as an accessibility supplement.

## 27.12 Presence language

### RR-VIS-012

Presence should appear as:

- compact roster rows;
- initials/avatar circles where useful;
- small green active indicator;
- current player highlighted primarily through typography/accent.

Do not create chat-app-style presence complexity.

## 27.13 Completed / Unsealed state

### RR-VIS-013

Completion must reproduce the showroom's visual payoff:

- brighter accent-centered composition;
- open/unsealed lock mark;
- large `Unsealed.` title in English;
- localized equivalent in Italian;
- one concise final line;
- full secret inside a prominent bordered monospace card;
- yellow Copy action;
- small result metadata such as challenges completed / elapsed time / mode;
- subtle CSS-only celebratory effect.

This screen must feel clearly more resolved and brighter than the active-game screens.

## 27.14 Motion

### RR-VIS-014

Motion is restrained.

Allowed:

- newly revealed grapheme transition;
- subtle lock/open state;
- small completion burst/confetti-like CSS effect;
- mild card/phone decorative transforms on landing;
- compact feedback transitions.

Avoid:

- continuous floating/bouncing;
- large parallax systems;
- animation libraries;
- blocking celebration sequences.

Honor `prefers-reduced-motion`.

## 27.15 Production-vs-showroom rule

### RR-VIS-015

The production application must **reuse the visual decisions, not the showroom scaffolding**.

Do not ship:

- fake browser chrome;
- fake device frames inside actual player pages;
- the showcase's design-token cards;
- mock labels such as `Puzzle 01`;
- multiple states shown side-by-side merely for demonstration.

Those are reference mechanisms only.

## 27.16 Visual acceptance

### AC-VIS-001

At approximately 1440 px desktop width, `/` should be recognizably equivalent to the showroom hero in:

- hierarchy;
- palette;
- two-column balance;
- top bar;
- phone preview treatment;
- CTA emphasis.

### AC-VIS-002

At approximately 390 px mobile width, `/r/[code]` should visually read like the showroom phone UI without requiring a fake phone frame.

### AC-VIS-003

The host page should visibly preserve the showroom split between game status and roster/controls on wide screens and stack cleanly on mobile.

### AC-VIS-004

The final completed state should visibly preserve the showroom's centered `Unsealed` payoff and prominent secret card.

### AC-VIS-005

A reviewer must explicitly compare the implementation against `reveal-room-showroom.html` and reject:

- generic framework-default UI;
- obvious visual drift;
- overuse of accent color;
- materially different card/spacing hierarchy;
- a landing page that omits the product-preview composition without a responsive reason.

---

# 28. Responsive behavior

### RR-UI-RESP-001
Design mobile-first for approximately 360 px width and above.

### RR-UI-RESP-002
Primary actions must remain reachable without horizontal scrolling.

### RR-UI-RESP-003
Puzzle grids must fit common phone widths.

### RR-UI-RESP-004
Host desktop view may expand to a maximum content width around 960 px.

### RR-UI-RESP-005
Long secrets must wrap safely and never overflow the viewport.

---

# 29. Accessibility

### RR-A11Y-001
All controls keyboard accessible.

### RR-A11Y-002
Visible focus styles.

### RR-A11Y-003
Minimum touch target around 44×44 CSS px for primary interactive targets.

### RR-A11Y-004
Do not communicate puzzle correctness or active state with color alone.

### RR-A11Y-005
Use semantic buttons and form labels.

### RR-A11Y-006
Use `aria-live` for:

- challenge result feedback;
- newly revealed progress;
- connection/restoration messages where useful.

### RR-A11Y-007
Honor `prefers-reduced-motion`.

### RR-A11Y-008
Final secret must be selectable text.

---

# 30. Internationalization

## 30.1 Supported locales

```ts
type Locale = 'en' | 'it'
```

### RR-I18N-001
No user-facing application string should be hardcoded inside feature components.

Use dictionaries such as:

```text
src/lib/i18n/en.ts
src/lib/i18n/it.ts
```

or an equivalent typed structure.

### RR-I18N-002
The English dictionary defines the canonical message shape.

Italian must satisfy the same shape at compile time.

### RR-I18N-003
Landing/create UI locale:

1. stored user preference if present;
2. otherwise browser language (`it*` → Italian; everything else → English).

### RR-I18N-004
Room gameplay locale is the locale chosen by the host at creation.

### RR-I18N-005
Word Scramble uses the room locale's word bank.

### RR-I18N-006
Dates are not important in room UI. Elapsed durations should be formatted without an external date library.

---

# 31. Connection states

### RR-CONN-001
Player and host pages track a connection state:

- connecting;
- connected;
- reconnecting;
- gone.

### RR-CONN-002
A temporary poll failure must not eject the player or wipe credentials.
Transient network/5xx/429 failures keep the last valid snapshot and show a
subtle reconnecting state; the next successful poll restores `connected`.

### RR-CONN-003
If polling returns an authoritative `404 ROOM_NOT_FOUND`:

- stop heartbeats;
- stop polling;
- clear stale local room credentials;
- show localized `This room is gone` state;
- provide a link to home.

### RR-CONN-004
Every successful poll delivers a fresh full snapshot, making the UI
self-healing after reconnects.

---

# 32. Resource limits and basic abuse protection

This is not an internet-scale security system. It must still be bounded.

### RR-LIMIT-001
The previous v1.1 process-specific cap ("maximum rooms in one process: 250")
does not map to serverless Redis and is removed. Room count is bounded by:

- Redis TTL cleanup (rooms expire automatically);
- Upstash account/database limits;
- creation rate limiting (below).

Room creation still returns `ROOM_LIMIT_REACHED` only when the creation rate
limit is exhausted.

### RR-LIMIT-002
Maximum participants/spectators stored per room:

`20`

Maximum game players:

`12`.

### RR-LIMIT-003
Bound string inputs according to this spec before storing them.

### RR-LIMIT-004
Bound answer payload JSON size through reasonable route/body validation and reject obviously oversized/invalid shapes.

### RR-LIMIT-005
Implement a fixed-window rate limiter for at least:

- room creation;
- join attempts;
- answer submissions.

Suggested defaults:

```text
Create: 10 / 10 minutes / IP
Join:   30 / minute / IP
Answer: 120 / minute / participant
```

On Vercel the limiter must be Redis-backed (cross-instance consistent):
expiring counters using `INCR` + `EXPIRE` are sufficient. Tests and explicit
local development modes may use a memory equivalent. IP extraction may use
trusted proxy headers (`x-forwarded-for`) where available; this is lightweight
abuse resistance, not strong identity.

### RR-LIMIT-006
IP extraction may use trusted proxy headers where available, but this limiter must be documented as lightweight abuse resistance, not strong identity.

### RR-LIMIT-007
Rate-limit state is ephemeral and should be swept.

---

# 33. Security and privacy rules

### RR-SEC-005
The server process necessarily holds the room secret in plaintext. Do not claim end-to-end encryption.

### RR-SEC-006
Use HTTPS in real deployment.

### RR-SEC-007
Never log:

- room secret;
- host token;
- participant token;
- challenge answers.

### RR-SEC-008
Treat all title/name/message/secret content as plain text.

Do not render user content through `dangerouslySetInnerHTML`.

### RR-SEC-009
All room state endpoints use `no-store`.

### RR-SEC-010
Host/participant bearer-token comparisons should use hash comparison appropriate for equal-length digests. Avoid storing plaintext tokens server-side.

### RR-SEC-011
No sensitive credentials in URL query parameters or fragments are needed for v1.

### RR-SEC-012
Do not expose stack traces to clients in production.

---

# 34. Validation

Create small explicit validators instead of adding a schema library.

Required validation helpers should cover:

- locale;
- game mode;
- reveal mode;
- challenge count;
- room code format;
- title;
- secret;
- final message;
- display name;
- host action;
- challenge answer shape by puzzle type.

Return typed results.

Do not use `any` as a shortcut.

---

# 35. Logging

Keep logging sparse.

Allowed examples:

```text
room_created code=ABC123
room_started code=ABC123 players=5
room_completed code=ABC123 duration_ms=...
room_deleted code=ABC123 reason=empty_timeout
room_deleted code=ABC123 reason=absolute_ttl
```

Do not log user content.

A tiny logging helper is acceptable.

No external telemetry in v1.

---

# 36. Test strategy

Use a lightweight test runner for pure server/domain code.

## 36.1 Required automated tests

### AC-TEST-001 — Room code
- correct length;
- alphabet only;
- collision retry behavior.

### AC-TEST-002 — Token verification
- valid host token accepted;
- wrong token rejected;
- participant token isolated.

### AC-TEST-003 — Reveal masking
- whitespace preserved;
- unrevealed graphemes masked;
- progressive checkpoints monotonic;
- final reveals 100%;
- final-only reveals zero before final;
- emoji/combined graphemes handled.

### AC-TEST-004 — Public state
A test must assert that serialized public state does not contain the plaintext secret before completion.

### AC-TEST-005 — State machine
- lobby → playing;
- playing ↔ paused;
- final completion → completed;
- reset → lobby;
- invalid transitions rejected.

### AC-TEST-006 — Presence
Using an injectable/fake clock where practical:

- actor active within 45 s;
- actor inactive after threshold;
- `roomExpiresAt` moves forward with the latest actor activity;
- room retained before 5 min;
- room deleted at/after 5 min;
- returning actor extends expiry;
- absolute 24 h TTL deletes.

### AC-TEST-007 — Party assignment
- chooses active players only;
- prefers lowest assigned count;
- reasonably balances assignments;
- inactive assignee can be replaced.

### AC-TEST-008 — Puzzle generators
For every type:
- generated payload valid;
- canonical answer validates;
- an intentionally wrong answer fails;
- generator does not throw over a reasonable repeated sample.

### AC-TEST-009 — Stale answer
Submitting a solved/old challenge ID cannot advance progress again.

### AC-TEST-010 — Input bounds
Oversized/invalid strings and enum values rejected.

## 36.2 Required build gates

Before completion:

```text
typecheck passes
lint passes
unit tests pass
production build passes
```

If the scaffold's standard scripts differ, provide equivalent scripts.

---

# 37. Manual acceptance scenarios

## AC-FLOW-001 — Solo / progressive / English

1. Host creates a Solo room with a 5-challenge progressive reveal.
2. Host copies player link.
3. Player joins.
4. Host starts.
5. Player solves all 5 challenge types encountered.
6. Secret progressively reveals.
7. Final challenge exposes full secret.
8. Copy works.
9. Final message and elapsed stats display.

## AC-FLOW-002 — Party / Italian

1. Host creates Party room in Italian.
2. Three players join.
3. Host starts.
4. Challenges are assigned among players.
5. Non-assignees see whose turn it is.
6. Solving updates every connected screen without manual refresh.
7. Final reveal appears on all screens.

## AC-FLOW-003 — Pause

1. Host pauses during an active challenge.
2. Player UI enters paused state.
3. Current challenge is preserved.
4. Resume restores it.

## AC-FLOW-004 — Reconnect

1. Player joins.
2\. a poll request fails transiently.
3. UI reports reconnecting.
4\. the next poll succeeds.
5. Fresh snapshot restores current game state.
6. Player identity is preserved by stored credentials.

## AC-FLOW-005 — Assignee leaves

1. Party game active.
2. Current assignee stops heartbeats.
3. After presence timeout, another active player gets the challenge.
4. Game continues.

## AC-FLOW-006 — Automatic destruction

1. Host and all players stop heartbeats.
2. Room becomes empty.
3. Before 5 minutes, reconnect keeps room.
4. After 5 continuous empty minutes, room is deleted.
5. Old room URL displays gone/not-found state.

## AC-FLOW-007 — Process restart

1. Create room.
2. Restart Node process.
3. Room is gone.
4. UI handles this cleanly.

This is expected, not a bug.

## AC-FLOW-008 — Secret non-exposure

Before completion:
- inspect initial HTML;
- inspect public room GET;
- inspect polling GET payloads;
- inspect player challenge payload.

The full secret must not be present.

---

# 38. Suggested source structure

The implementation may refine names, but maintain clear domain boundaries.

```text
src/
├── app/
│   ├── api/
│   │   └── rooms/
│   │       ├── route.ts
│   │       └── [code]/
│   │           ├── route.ts
│   │           ├── join/route.ts
│   │           ├── presence/route.ts
│   │           ├── challenge/route.ts
│   │           ├── answer/route.ts
│   │           └── host-action/route.ts
│   ├── create/page.tsx
│   ├── host/[code]/page.tsx
│   ├── r/[code]/page.tsx
│   ├── not-found.tsx
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
│
├── components/
│   ├── Button.tsx
│   ├── Dialog.tsx
│   ├── LanguageToggle.tsx
│   ├── PlayerRoster.tsx
│   ├── ProgressLocks.tsx
│   ├── SecretDisplay.tsx
│   ├── SealMark.tsx
│   └── puzzles/
│       ├── SequencePuzzle.tsx
│       ├── MemoryPuzzle.tsx
│       ├── OddOneOutPuzzle.tsx
│       ├── QuickMathPuzzle.tsx
│       ├── WordScramblePuzzle.tsx
│       └── OrderPuzzle.tsx
│
├── lib/
│   ├── api/
│   │   ├── errors.ts
│   │   └── validation.ts
│   ├── game/
│   │   ├── assignment.ts
│   │   ├── challenges.ts
│   │   ├── reveal.ts
│   │   └── state-machine.ts
│   ├── i18n/
│   │   ├── index.ts
│   │   ├── en.ts
│   │   └── it.ts
│   ├── runtime/
│   │   ├── rate-limit.ts
│   │   ├── room-store.ts
│   │   ├── repository.ts
│   │   └── rate-limit.ts
│   ├── security/
│   │   └── tokens.ts
│   └── types.ts
│
└── tests/
    ├── assignment.test.ts
    ├── challenges.test.ts
    ├── presence.test.ts
    ├── reveal.test.ts
    ├── room-store.test.ts
    └── state-machine.test.ts
```

Do not create abstractions solely to match this tree. The goal is separation, not file count.

---

# 39. Client architecture

### RR-CLIENT-001
Do not introduce global client state machinery.

Each room page may use a focused hook such as:

`useRoomPolling(code)`

Responsibilities:

- immediate initial fetch;
- poll the public snapshot approximately every 1 second (visible tab);
- skip React state churn when `version` is unchanged;
- latest public snapshot;
- connection status (connecting / connected / reconnecting / gone);
- tolerate transient failures (keep last snapshot);
- stop on unmount and when the room is permanently gone;
- immediate refresh after local mutations and on `visibilitychange → visible`.

### RR-CLIENT-002
A separate presence hook may:

- start authenticated heartbeat interval;
- refresh presence after important mutations;
- stop when room is gone.

### RR-CLIENT-003
Host token and participant credentials are read only in client components.

Do not accidentally serialize them from Server Components.

### RR-CLIENT-004
Challenge assignee page fetches the private challenge payload only when snapshot says the current participant is the assignee.

---

# 40. Server implementation invariants

These invariants are mandatory.

### RR-INV-001
Only `RoomStore` (or the chosen domain-equivalent module) mutates room state.

### RR-INV-002
API handlers validate/authenticate then call domain operations.

Do not duplicate game rules across route handlers.

### RR-INV-003
Public state is produced by one sanitizer/serializer function.

### RR-INV-004
Challenge completion is idempotent with respect to stale challenge IDs.

### RR-INV-005
Room deletion has one implementation path reused by:

- host delete;
- empty timeout;
- absolute TTL.

### RR-INV-006
Every domain mutation that changes visible state triggers a snapshot notification.

### RR-INV-007
No public serializer accepts an option that can accidentally include the secret before full reveal.

Make the safe behavior structural rather than caller-dependent.

---

# 41. Room expiry algorithm

Normative formula. Redis TTL is the only cleanup mechanism; there is no sweep
loop.

```ts
const PRESENCE_TIMEOUT_MS = 45_000
const EMPTY_ROOM_TTL_MS = 5 * 60_000
const ABSOLUTE_ROOM_TTL_MS = 24 * 60 * 60_000

function isActive(lastSeenAt: number, now: number) {
  return now - lastSeenAt <= PRESENCE_TIMEOUT_MS
}

function roomExpiresAt(room: Room): number {
  const latestActivity = Math.max(
    room.hostPresence.lastSeenAt,
    ...[...room.participants.values()].map((p) => p.presence.lastSeenAt),
  )
  return Math.min(
    room.createdAt + ABSOLUTE_ROOM_TTL_MS,
    latestActivity + PRESENCE_TIMEOUT_MS + EMPTY_ROOM_TTL_MS,
  )
}
```

The repository applies `roomExpiresAt` on every room write:

- room creation counts the host as initially active (expiry computed from
  `createdAt`);
- heartbeat and authenticated activity mutations recompute and reapply expiry;
- public polling GET does not write and therefore does not extend expiry;
- completion keeps normal presence/empty-room expiry (the room still expires
  ~5 minutes after the last actor goes inactive);
- explicit delete removes the key immediately;
- the 24-hour absolute TTL is never exceeded.

Inactive assignee reassignment cannot rely on a background sweep. Deterministic
room operations (heartbeat, game mutations, and the public-read path) check
whether the current assignee exceeded the 45-second presence window; if so and
another eligible active game player exists, the same challenge (answer
unchanged) is reassigned under the room lock. The public-read path performs
this write only when normalization is actually needed.

Important:

- authenticated activity refreshes presence;
- polling connection count is not the presence authority;
- inactive participant records may remain inside an occupied room until the
  room is reset/deleted;
- TTL keeps storage bounded.

---

# 42. UX edge cases

## 42.1 Host closes immediately after creation

Room remains as long as players remain active.

If nobody is active, 5-minute empty deletion begins.

## 42.2 Host loses host token

No recovery in v1.

Players may finish if the game is already running.

Otherwise room eventually expires.

## 42.3 Player refreshes

Resume from local participant credentials.

## 42.4 Player clears browser storage

They may rejoin as a new participant.

If game already started, they become a spectator.

## 42.5 All players leave but host remains

Room stays alive.

## 42.6 Host leaves but players remain

Room stays alive.

## 42.7 Nobody remains after completion

Five-minute deletion applies normally.

## 42.8 Secret is only one character

Allowed.

Progressive reveal may effectively reveal it on the first completed challenge. That is acceptable.

## 42.9 Very short secret vs many challenges

Some progressive checkpoints may reveal no new grapheme due to integer rounding. Progress still advances.

Prefer a checkpoint function that distributes reveals as evenly as possible and guarantees full reveal at completion.

## 42.10 Secret contains HTML-looking text

Render literally as text.

---

# 43. README requirements

The repository README must contain:

1. concise product description;
2. screenshot placeholder or optional screenshot section;
3. feature list;
4. stack;
5. local setup;
6. test/build commands;
7. architecture summary;
8. explicit ephemeral-state explanation;
9. 5-minute empty cleanup behavior;
10. explicit single-process deployment requirement;
11. explicit Vercel/serverless limitation;
12. security note explaining that room secrets are plaintext in server memory;
13. English/Italian support;
14. roadmap ideas kept separate from v1.

Do not market the app as secure secret storage.

---

# 44. Implementation work breakdown

The following task IDs are intended for agent coordination.

## T01 — Scaffold and standards

Requirements:
- Next.js App Router;
- TypeScript strict;
- CSS foundation;
- lint/typecheck/test/build scripts;
- base directory structure;
- no prohibited dependencies.

Done when:
- app boots;
- checks run;
- landing skeleton works.

## T02 — Domain types, validation, security utilities

Implement:
- core types;
- validators;
- room code generation;
- host/participant token generation + hashing/verification;
- API error helpers.

Covers:
`RR-SEC-*`, validation sections, parts of `RR-LIMIT-*`.

## T03 — Reveal and puzzle engines

Implement:
- grapheme segmentation;
- mask/reveal checkpoints;
- all six puzzle generators/validators;
- challenge selection;
- unit tests.

Covers:
`RR-PUZZLE-*`, `RR-REVEAL-*`.

## T04 — Runtime RoomStore and lifecycle

Implement:
- room repository (Redis-backed);
- room creation;
- join/resume;
- game state machine;
- assignment;
- presence;
- GC;
- explicit deletion;
- room/public serializer;
- resource caps;
- rate limiter;
- unit tests.

Covers:
`RR-RUNTIME-*`, `RR-PRES-*`, `RR-STATE-*`, `RR-INV-*`.

## T05 — HTTP API

Implement all required Route Handlers.

Covers:
API contracts, authentication, validation, no-store behavior.

## T06 — Client polling transport

Implement:
- polling hook (`useRoomPolling`);
- version-aware snapshot refresh;
- transient-failure tolerance;
- gone-state handling;
- visibility resume.

Covers:
`RR-POLL-*`, `RR-CONN-*`.

## T07 — i18n and shared UI system

Before implementation, read `reveal-room-showroom.html` in full.

Implement:
- typed EN/IT dictionaries;
- locale selection;
- canonical showroom palette/design tokens;
- seal/lock inline-SVG identity;
- shared primitive components;
- `SecretDisplay`;
- progress segments/locks;
- roster/presence primitives;
- accessibility primitives.

Covers:
`RR-I18N-*`, `RR-VIS-*`, visual system, accessibility basics.

## T08 — Website + Host UX

Use the showroom as the canonical visual reference.

Implement:
- real `/` landing page based on the showroom hero/topbar;
- do not ship showroom-only showcase sections;
- create flow matching the Room Creation reference;
- host token persistence;
- host lobby matching the visual identity;
- sharing/copy;
- roster;
- start;
- live dashboard matching the Live Host Dashboard reference;
- controls;
- completion state;
- dangerous-action confirmations.

Covers:
landing, host/create, and `RR-VIS-*` requirements.

## T09 — Player UX and puzzles

Use the showroom phone screens and puzzle cards as the canonical visual reference.

Implement:
- join/resume;
- lobby;
- player/spectator states;
- all six puzzle components in one coherent visual language;
- paused state;
- final `Unsealed` reveal/copy treatment;
- reconnection UI;
- presence heartbeat;
- responsive phone-first behavior without fake device frames in production.

Covers:
player flows, puzzle interaction, and `RR-VIS-*`.

## T10 — Integration, hardening, visual review, docs

Perform:
- full automated tests;
- typecheck;
- lint;
- production build;
- manual scenario review;
- inspect network/public serializers for secret leakage;
- explicit side-by-side visual comparison with `reveal-room-showroom.html`;
- desktop landing review around 1440 px;
- mobile player review around 390 px;
- host dashboard responsive review;
- final `Unsealed` screen review;
- reject generic/default-framework visual drift;
- reduced motion/accessibility review;
- README;
- clean dead code.

---

# 45. Definition of Done

The application is complete only when all conditions are true.

## Product

- [ ] Host can create a room.
- [ ] Public room link works.
- [ ] Host access works without token in URL.
- [ ] Solo mode works end-to-end.
- [ ] Party mode works end-to-end.
- [ ] Progressive reveal works.
- [ ] Final-only reveal works.
- [ ] All six puzzle types work.
- [ ] 3–8 challenge configuration works.
- [ ] English UI is complete.
- [ ] Italian UI is complete.
- [ ] Host pause/resume/skip/reveal/reset/delete work.
- [ ] Player reconnect/resume works.
- [ ] Late spectator behavior works.
- [ ] Final copy action works.

## Runtime

- [ ] State is in memory only.
- [ ] Process restart intentionally destroys rooms.
- [ ] Heartbeats run every 15 s.
- [ ] 45 s presence timeout works.
- [ ] 5-minute empty-room deletion works.
- [ ] Returning presence cancels empty deletion.
- [ ] 24-hour hard TTL works.
- [ ] Global resource limits exist.

## Realtime

- [ ] Initial poll snapshot works.
- [ ] Mutations appear on all clients.
- [ ] Keepalive works.
- [ ] Reconnect restores current state.
- [ ] Polling is not used as authoritative presence.

## Security / correctness

- [ ] Secret absent from public payloads before reveal.
- [ ] Secret absent from logs.
- [ ] Tokens absent from URLs.
- [ ] Token hashes stored server-side.
- [ ] Stale challenge cannot double-advance.
- [ ] User content rendered as text.
- [ ] APIs are no-store.
- [ ] Invalid state transitions rejected.

## Visual fidelity

- [ ] `reveal-room-showroom.html` was treated as the canonical visual reference.
- [ ] Real `/` landing reproduces the showroom hero/topbar/product-preview direction.
- [ ] Showroom-only meta sections are not shipped as public website content.
- [ ] `/create` reproduces the showroom creation hierarchy.
- [ ] `/host/[code]` reproduces the showroom dashboard hierarchy.
- [ ] `/r/[code]` reproduces the showroom phone-first visual language.
- [ ] All puzzle UIs share the showroom tile/card language.
- [ ] `SecretDisplay` matches the showroom masked/revealed treatment.
- [ ] Final state reproduces the showroom `Unsealed` payoff.
- [ ] Desktop and mobile layouts were explicitly compared against the showroom.
- [ ] UI does not look like a generic SaaS/framework starter.

## Quality

- [ ] Typecheck passes.
- [ ] Lint passes.
- [ ] Unit tests pass.
- [ ] Production build passes.
- [ ] No prohibited dependency was introduced.
- [ ] README documents the single-process deployment requirement.
- [ ] README warns Vercel/serverless is not reliable for this memory-only multiplayer architecture.

---

# 46. Future roadmap — explicitly not v1

Potential later extensions:

- optional QR join code;
- custom host-authored questions;
- custom puzzle packs;
- room themes;
- persistent adapter interface;
- Redis adapter;
- Vercel-compatible shared-state adapter;
- replay/history;
- timer mode;
- hint system;
- sound;
- PWA;
- more languages;
- public shareable result card;
- player voting/team puzzles;
- WebSocket transport adapter;
- encrypted-at-rest persistent secrets if persistence is ever added.

Do not implement these while completing v1 unless needed to fix a v1 defect.

---

# 47. Research-grounded implementation notes

These notes describe platform facts checked while preparing the spec on 2026-08-18.

1. The current Next.js documentation lists Next.js 16.3.1 and a minimum Node.js version of 20.9.
2. Next.js Route Handlers can stream raw responses with Web Streams and explicitly call out Server-Sent Events as a use case.
3. Browser `fetch` polling is simple and works across stateless serverless instances; room state is shared through Upstash Redis, so any instance can serve any room.
4. `Intl.Segmenter` is suitable for grapheme segmentation and is available across current modern browsers/runtimes.
5. Next.js supports normal self-hosting as a Node.js server; a custom server is not required for this architecture.
6. Vercel can reuse function instances and preserve memory during reuse, but functions can also scale to multiple instances.
7. Vercel's own current guidance for shared state says not to rely on instance memory when any instance may handle a connection/request.
8. Therefore, this v1's in-memory multiplayer correctness model intentionally targets a single persistent Node process.

These constraints are architectural, not temporary implementation details.

---

# 48. Decision Log

Use this only when implementation discovers a real contradiction or unavoidable platform issue.

Format:

```text
YYYY-MM-DD — Decision title
Requirement(s): RR-...
Problem:
Decision:
Reason:
Consequences:
```

---

2026-08-19 — Canonical production deployment moved from Vercel to a single persistent process

Requirement(s): RR-DEPLOY-001, RR-DEPLOY-002, RR-DEPLOY-003

Problem:
Production validation on a Vercel deployment (2026-08-19, deployment `dpl_DFpiZZyvPNUKEMT44gYh7YjeXUCF`) proved the application behavior itself works end-to-end (create, join, start, all six puzzle types solved via real UI, progressive reveal, pause/resume, late-join spectator, inactive-assignee reassignment, completion and `Unsealed` on all clients, copy action, EN/IT, responsive layout; a network audit found zero plaintext-secret exposure pre-reveal). It also proved the platform is incompatible with the process-local `RoomStore`: Vercel routes requests across multiple function instances of the same deployment, so the same live room returned HTTP 200 and `ROOM_NOT_FOUND` within the same second; SSE streams and mutation requests could land on different instances; a player-page reload could report the room gone while the room was still live on the instance holding the open SSE stream; a `start` action could silently no-op on a cold instance. Exact reproduction: room `2GAT4R` — 10/10 parallel GETs OK immediately after create, then 1.5 s later 5 fresh GETs returned 1 OK and 4 `ROOM_NOT_FOUND`.

Decision:
Keep the v1 state architecture unchanged (in-memory, process-local `RoomStore`; no database, Redis, KV, or shared-state adapter). Make the canonical production/event deployment a single persistent application process (one Docker container, exactly one Next.js/Bun process, no replicas, no cluster mode) behind Nginx Proxy Manager with HTTPS. Vercel remains deployed only as a visual/demo deployment and is no longer the authoritative production environment.

Reason:
RR-DEPLOY-003 already documented that serverless instance memory is not a shared state store; the production validation confirmed this is a real, reproducible failure rather than a theoretical caveat. RR-DEPLOY-001/RR-DEPLOY-002 specify the single-process model as the canonical v1 deployment. No product or state architecture change was required to satisfy the specification.

Consequences:
- Production: single container on the existing VPS (internal HTTP port 3010 bound to localhost; Nginx Proxy Manager proxies the public HTTPS domain to it, with SSE buffering disabled).
- Vercel: demo/visual only; README states it is not correctness-safe for process-local multiplayer state.
- No changes to application code, game rules, or the in-memory state model.

---

2026-08-19 — v1.2: room state moved from process-local memory to Upstash Redis for Vercel correctness

Requirement(s): RR-DEPLOY-001, RR-DEPLOY-002, RR-DEPLOY-003, RR-RUNTIME-001, RR-RUNTIME-002

Problem:
Vercel production testing (v1.1) demonstrated that process-local room state is
inconsistent across horizontally scaled function instances. The same live room
produced simultaneous HTTP 200 and ROOM_NOT_FOUND responses, and SSE/mutation
requests could observe different process-local states (exact reproduction:
room `2GAT4R` — 10/10 parallel GETs OK immediately after create, then 1.5 s
later 5 fresh GETs returned 1 OK and 4 ROOM_NOT_FOUND). A single-process VPS
deployment was prepared as a fallback, but the product requirement is that
Reveal Room runs reliably on Vercel production.

Decision:
- Vercel remains the canonical production platform;
- room state moves to Upstash Redis (`@upstash/redis`, official SDK);
- process-local SSE is removed;
- client synchronization moves to lightweight polling of the public snapshot
  (approximately 1 s, version-aware);
- Redis TTL replaces process garbage-collection timers (expiry = latest actor
  activity + 45 s active window + 5 min empty retention, hard-capped at
  `createdAt + 24 h`);
- per-room distributed mutation locking (SET NX PX, token-verified compare-and-
  release) preserves atomic game state across concurrent function instances;
- Redis-backed fixed-window rate limiting replaces the process-local limiter;
- the process-specific 250-room global cap is removed (TTL + creation rate
  limit + Upstash account limits bound storage);
- a repository boundary (`RoomRepository`) keeps game/domain logic independent
  of the storage backend; a memory repository remains for tests and explicit
  local development modes, with no production fallback to memory.

Reason:
Vercel's execution model (instance reuse, replacement, horizontal scaling)
cannot share function memory. Shared room state in Redis makes every instance
equivalent, and polling removes the need for a process-local event stream.
Product behavior and visual design remain unchanged.

Consequences:
- Canonical production: Vercel + Upstash Redis (spec v1.2).
- The single-process VPS deployment remains as an optional fallback and is not
  modified or deleted.
- `REVEAL_ROOM_SPEC_v1.1.md` is preserved as history; v1.2 becomes the
  canonical functional/technical source of truth.
