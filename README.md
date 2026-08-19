<p align="center">
  <strong style="font-size: 2.2em; letter-spacing: -0.04em;">🔒 Reveal Room</strong>
</p>

<p align="center">
  <strong>Make them earn the reveal.</strong>
  <br />
  A lightweight web party game that hides any message behind a short sequence
  of puzzles and unlocks it together. No accounts, ephemeral rooms, solo or
  party.
</p>

---

## Overview

Reveal Room is a small, phone-first web game for revealing a secret through a
quick string of generated puzzles. A host creates a temporary room, types in
whatever text should stay hidden (a gift code, a message, a clue, an
announcement), configures the game and shares a public room link. One or more
players join from their phones; solving challenges progressively reveals the
secret — or unlocks it entirely at the end.

The whole product is intentionally tiny: **state lives only in the memory of
one Node.js process**, there is no database and no hosted realtime service.
Rooms disappear automatically and the app is fully usable in English and
Italian.

The canonical artifact governing the implementation is
`REVEAL_ROOM_SPEC_v1.2.md` — product behavior, architecture, state, APIs,
security, validation and acceptance criteria, including its visual design
system (dark atmosphere, warm scarce yellow accent, seal/lock identity,
phone-first puzzle UI). The Next.js implementation itself is the next step
and will live in `src/`.

## Highlights

- **Ephemeral by design** — rooms live in memory only; a restart or redeploy
  intentionally destroys them. Empty rooms auto-delete after 5 minutes
- **No accounts** — opening a room takes seconds; participants resume from
  browser-local credentials while the room exists
- **Two modes** — Solo (one player solves everything) and Party (challenges
  are assigned fairly across the roster)
- **Two reveal modes** — Progressive (the secret leaks out with every solved
  challenge) and At the end (everything is masked until the finish)
- **Six puzzle types** — sequence, memory, odd-one-out, quick-math,
  word-scramble and order; all server-validated
- **Realtime without infrastructure** — native Server-Sent Events push full
  sanitized snapshots to every connected screen
- **Bilingual** — complete English and Italian UI, including locale word banks
- **Dependency-light** — runtime stack is just `next`, `react`, `react-dom`

## Tech Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Node.js runtime) |
| Language | TypeScript (strict) |
| Styling | Plain CSS / CSS Modules (no Tailwind, no UI kit) |
| Realtime | Client polling of the public snapshot (~1 s, version-aware) |
| State | Upstash Redis (shared ephemeral room state) |
| Concurrency | Per-room distributed locks (atomic compare-and-release) |
| Crypto | Native Node.js/Web APIs |
| i18n | Typed local dictionaries (EN/IT) |
| Testing | Vitest (dev-only) |

## Architecture

```text
                    Upstash Redis (shared room state)
                                   │
        ┌──────────────┬───────────┼───────────┬──────────────┐
        ▼              ▼           ▼           ▼              ▼
   POST /api/rooms  room polls  host actions  answers      heartbeats
        │              │           │           │              │
   players / host ◀───┴───────────┴───────────┴──────────────┘
      (browsers, fetch polling + fetch mutations)
```

- **Routes:** `/` landing, `/create`, `/r/[code]` player room, `/host/[code]`
  host control surface.
- **Server:** Route Handlers mutate room state through a single domain layer
  backed by a `RoomRepository` (Redis in production, memory in tests/dev).
  Every mutation runs under a per-room distributed lock; Redis TTL cleans up
  rooms automatically. One sanitizer produces all public snapshots.
- **Synchronization:** clients poll `GET /api/rooms/{code}` (~1 s when
  visible); snapshots carry a `version` so unchanged state causes no UI
  churn. There is no SSE endpoint in v1.2.
- **Presence:** authenticated heartbeats every 15 s; an actor is active for
  45 s; a room expires ~5 minutes after the last actor goes inactive (hard
  cap 24 h) via Redis TTL. Polling never extends a room's lifetime.
- **Security:** host token (≥ 256 bit) and participant tokens (≥ 128 bit)
  are stored as hashes only; the plaintext secret never leaves the server
  until the actual reveal.

## Getting Started

### Prerequisites

- Node.js 20.9+ (Node.js 24 recommended)
- [Bun](https://bun.sh) 1.3+ (used as runtime and package manager)

### Install

```bash
git clone https://github.com/Okazakee/reveal-room.git
cd reveal-room
bun install
bun run dev
```

No environment variables are required. Rooms are entirely in-memory.

### Scripts

```bash
bun run dev        # Development server
bun run build      # Production build
bun run start      # Production server
bun run lint       # Lint
bun run test       # Vitest suite
bun run typecheck  # tsc --noEmit
```

## Screenshots

*Screenshot placeholders — to be added: landing hero at 1440 px, host dashboard, player puzzle at 390 px, final Unsealed screen.*

## Deployment

### Canonical: Vercel + Upstash Redis (v1.2)

Room state lives in Upstash Redis, not in function-instance memory, so Vercel's
horizontally scaled function instances are all equivalent. Every mutation runs
under a per-room distributed lock, Redis TTL cleans rooms up automatically, and
clients synchronize by polling the public snapshot (~1 s). This is the
authoritative production deployment.

**Environment variables (server-side only, never `NEXT_PUBLIC_*`):**

```text
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

The Vercel Marketplace Upstash integration may expose the legacy KV-style
names instead — both are accepted:

```text
KV_REST_API_URL
KV_REST_API_TOKEN
```

In production, missing Redis configuration is a configuration error — the
app never silently falls back to memory.

**Local development** runs against an in-memory repository:

```bash
USE_MEMORY_STORE=true bun run dev
```

Tests always use the memory repository. `NODE_ENV=production` without
`USE_MEMORY_STORE` requires Redis.

**Deploy:**

```bash
vercel --prod
```

> **Production validation (2026-08-19):** the Vercel + Upstash Redis deployment
> was validated for the intended small-room party use case: full multi-session
> games completed via real UI, 37/37 cross-instance room reads were consistent
> (zero `ROOM_NOT_FOUND` for live rooms), concurrent duplicate answers were
> rejected by the distributed lock, refresh/resume kept identity, and the
> plaintext secret appeared in network traffic only after the actual reveal.
> Vercel horizontal scaling is now correctness-safe for this shared-state
> architecture (unlike the v1.1 process-local model).

### Optional fallback: single persistent process

A single-process deployment (one Docker container / one systemd or PM2 unit)
still works: the repository reads Redis, and all requests reach one process.
The old process-local-only architecture was superseded by the Redis-backed
repository and is not part of v1.2. The VPS container built for v1.1 remains
as an unused reference deployment.

> **⚠️ Ephemeral state.** Rooms are intentionally ephemeral. They live in
> Redis only for the lifetime of a game session: a room expires ~5 minutes
> after the last active actor goes inactive, and never outlives a hard 24-hour
> TTL. Redis is a temporary shared state layer, not durable user storage —
> there are no accounts and no history.

### Historical note (v1.1)

v1.1 stored rooms in process-local memory and used SSE. Vercel production
testing (2026-08-19) proved that process-local state is inconsistent across
horizontally scaled instances: the same live room returned HTTP 200 and
`ROOM_NOT_FOUND` within the same second, SSE and mutations could hit different
instances, and a player reload could show "This room is gone" while the room
was live on the instance holding the SSE stream. v1.2 fixes this by moving
room state to Redis and replacing SSE with polling (see the Decision Log in
`REVEAL_ROOM_SPEC_v1.2.md`).

## Security Notes

- Room secrets exist as **plaintext in server memory** for the lifetime of
  the room. This is **not** end-to-end encryption and must not be marketed as
  secure secret storage.
- The secret is never included in public room state, SSE payloads, challenge
  payloads or logs before it is actually revealed.
- Host and participant tokens never appear in URLs and are stored server-side
  only as hashes.
- Use HTTPS in real deployments.

## Status

- ✅ Canonical spec (`REVEAL_ROOM_SPEC_v1.2.md`) committed
- ✅ v1.2 implemented: Redis-backed shared state, polling transport, deployed to Vercel + Upstash Redis

## Roadmap

Ideas beyond v1 — kept separate, not built yet:

- optional QR join codes
- custom host-authored questions / puzzle packs
- room themes
- persistent or Redis-backed adapter
- timer mode, hints, sound
- more languages

## License

[MIT](LICENSE)