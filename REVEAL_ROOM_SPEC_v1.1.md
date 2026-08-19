# Reveal Room — Product & Technical Specification

> **Status:** v1.1 implementation specification  
> **Working product name:** Reveal Room  
> **Last reviewed:** 2026-08-18  
> **Functional source of truth:** `REVEAL_ROOM_SPEC.md`  
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

1. `REVEAL_ROOM_SPEC.md` — product behavior, architecture, state, security, realtime, validation, accessibility, routes, and acceptance criteria.
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
- native `EventSource` / Server-Sent Events for server → client updates;
- ordinary `fetch` for client → server mutations;
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

No additional runtime dependency is expected for v1.

A test runner such as Vitest is allowed as a development dependency.

---

# 4. Deployment model and critical constraint

## 4.1 Canonical deployment

### RR-DEPLOY-001
The canonical production deployment is **one persistent Node.js process** running the Next.js application.

Examples:

- `next build && next start`;
- a single Docker container;
- a single process supervised by systemd/PM2 without cluster mode.

The process may restart and lose all rooms. That is expected behavior.

### RR-DEPLOY-002
Do not run more than one application instance if room state is in memory.

The host, player API requests, and SSE connections must all reach the same process.

## 4.2 Serverless warning

### RR-DEPLOY-003
A Vercel/serverless deployment may be used for visual demos or best-effort testing, but **must not be documented as a reliable production deployment for multiplayer in-memory rooms**.

Reason: function instances may be reused, replaced, paused, or horizontally scaled; instance memory is not a shared state store.

The README must clearly state this limitation.

## 4.3 No custom Next.js server

### RR-DEPLOY-004
Do not introduce a custom Next.js HTTP server unless the standard Node.js deployment proves insufficient.

Next.js Route Handlers plus streaming are the intended implementation.

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
GET    /api/rooms/[code]/events
GET    /api/rooms/[code]/challenge
POST   /api/rooms/[code]/answer
POST   /api/rooms/[code]/host-action
```

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
- in SSE payloads.

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

# 9. In-memory state model

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

  emptySince?: number

  eventSequence: number
}
```

Implementation-specific subscriber/event-emitter data should not be serialized as room state.

---

# 10. Global runtime store

## 10.1 Singleton

### RR-RUNTIME-001
Use a process-local singleton `RoomStore`.

Use `globalThis` in development to avoid accidental duplicate stores during module hot reload.

Conceptually:

```ts
globalThis.__revealRoomRuntime ??= createRuntime()
```

The runtime owns:

- `Map<string, Room>`;
- room event subscriptions;
- garbage-collection interval;
- in-memory rate-limit buckets if implemented.

## 10.2 Synchronous mutations

### RR-RUNTIME-002
Room state mutations must be synchronous and atomic within the JavaScript event loop whenever possible.

Do not place external asynchronous work between:

1. validating the current room/challenge state; and
2. mutating that state.

This prevents obvious double-submit races without introducing locking infrastructure.

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

## 11.3 Five-minute room deletion

### RR-PRES-003
When a room has zero active actors:

- active host count = 0; and
- active participant count = 0;

set:

`emptySince = now`

If any actor returns before deletion:

`emptySince = undefined`

If the room remains empty for at least:

`5 minutes`

delete the room and all associated in-memory data.

### RR-PRES-004
Presence means host **or** participant presence. A host keeping the control page open keeps the room alive.

## 11.4 Cleanup strategy

### RR-PRES-005
Use both:

1. a process interval sweep every 15 seconds; and
2. an opportunistic sweep before/after room-store operations.

This ensures cleanup still occurs predictably even if interval scheduling is delayed.

## 11.5 Absolute TTL

### RR-PRES-006
Every room has a hard maximum lifetime of:

`24 hours`

After 24 hours it may be deleted even if clients are still active.

This bounds accidental memory retention and is not user-configurable in v1.

## 11.6 Immediate delete

### RR-PRES-007
The host can explicitly delete a room at any time.

Deletion:

- removes state;
- closes/notifies subscribers where possible;
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
- publish an SSE snapshot.

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
Player-facing GET and SSE payloads must use a sanitized public state.

Example conceptual type:

```ts
interface PublicRoomState {
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
- internal subscribers;
- rate-limit state.

---

# 18. Server-Sent Events protocol

## 18.1 Why SSE

The app needs:

- server → browser room updates;
- normal HTTP mutations browser → server.

SSE is sufficient and keeps the architecture smaller than a bidirectional socket layer.

## 18.2 Endpoint

`GET /api/rooms/{code}/events`

### RR-SSE-001
Use `text/event-stream`.

Recommended headers:

```text
Content-Type: text/event-stream
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

### RR-SSE-002
Immediately send:

```text
retry: 3000
event: snapshot
data: {JSON_PUBLIC_ROOM_STATE}
```

### RR-SSE-003
After every meaningful room mutation, send a new full sanitized `snapshot`.

Do not build a complex client event reducer for v1. Full small snapshots are intentionally simpler.

### RR-SSE-004
Send a comment keepalive approximately every 15 seconds:

```text
: ping
```

### RR-SSE-005
Clean up the subscriber when the request abort signal fires.

### RR-SSE-006
Browser clients use native `EventSource`.

Clients must tolerate disconnects and automatic reconnects.

### RR-SSE-007
SSE connectivity is **not** the authoritative presence mechanism. Authenticated heartbeats are.

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
Before full reveal, no API or SSE response sent to a player/spectator may include the full plaintext secret.

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
Player and host pages track SSE state:

- connecting;
- connected;
- reconnecting.

### RR-CONN-002
A temporary SSE disconnect must not eject the player.

`EventSource` reconnect is expected.

### RR-CONN-003
If room GET/SSE indicates the room no longer exists:

- stop heartbeats;
- close EventSource;
- clear stale local room credentials;
- show localized `This room is gone` state;
- provide a link to home.

### RR-CONN-004
A reconnect should fetch/receive a fresh full snapshot, making the UI self-healing.

---

# 32. Resource limits and basic abuse protection

This is not an internet-scale security system. It must still be bounded.

### RR-LIMIT-001
Maximum rooms in one process:

`250`

Before rejecting creation, run a cleanup sweep.

If still full, return `ROOM_LIMIT_REACHED`.

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
Implement a small process-local fixed-window rate limiter for at least:

- room creation;
- join attempts;
- answer submissions.

Suggested defaults:

```text
Create: 10 / 10 minutes / IP
Join:   30 / minute / IP
Answer: 120 / minute / participant
```

Exact internal structure may be simple `Map` buckets with expiry.

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
- `emptySince` starts when final actor becomes inactive;
- room retained before 5 min;
- room deleted at/after 5 min;
- returning actor clears `emptySince`;
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
2. SSE connection is interrupted.
3. UI reports reconnecting.
4. EventSource reconnects.
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
- inspect SSE payloads;
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
│   │           ├── events/route.ts
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
│   │   └── singleton.ts
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

`useRoomConnection(code)`

Responsibilities:

- initial GET;
- EventSource lifecycle;
- latest public snapshot;
- connection status;
- cleanup on unmount.

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

# 41. Empty-room cleanup algorithm

Normative pseudocode:

```ts
const PRESENCE_TIMEOUT_MS = 45_000
const EMPTY_ROOM_TTL_MS = 5 * 60_000
const ABSOLUTE_ROOM_TTL_MS = 24 * 60 * 60_000

function isActive(lastSeenAt: number, now: number) {
  return now - lastSeenAt <= PRESENCE_TIMEOUT_MS
}

function sweepRoom(room: Room, now: number) {
  if (now - room.createdAt >= ABSOLUTE_ROOM_TTL_MS) {
    deleteRoom(room.code, 'absolute_ttl')
    return
  }

  const hostActive = isActive(room.hostPresence.lastSeenAt, now)

  const anyParticipantActive = [...room.participants.values()]
    .some((participant) => isActive(participant.presence.lastSeenAt, now))

  const occupied = hostActive || anyParticipantActive

  if (occupied) {
    room.emptySince = undefined
    handleInactiveChallengeAssignee(room, now)
    return
  }

  room.emptySince ??= now

  if (now - room.emptySince >= EMPTY_ROOM_TTL_MS) {
    deleteRoom(room.code, 'empty_timeout')
  }
}
```

Important:

- room creation itself should count the host as initially active;
- authenticated activity refreshes presence;
- do not use SSE connection count as the deletion authority;
- inactive participant records may remain inside an occupied room until the room is reset/deleted;
- global limits keep this bounded.

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
- singleton;
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

## T06 — SSE transport

Implement:
- subscriber management;
- initial snapshot;
- snapshot broadcasts;
- keepalive;
- abort cleanup;
- reconnect-safe client behavior.

Covers:
`RR-SSE-*`, `RR-CONN-*`.

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

- [ ] SSE initial snapshot works.
- [ ] Mutations appear on all clients.
- [ ] Keepalive works.
- [ ] Reconnect restores current state.
- [ ] SSE connection count is not used as authoritative presence.

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
3. Native browser `EventSource` is widely available and automatically reconnects after dropped SSE connections.
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

No decisions are recorded at initial publication.
