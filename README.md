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
`REVEAL_ROOM_SPEC_v1.1.md` — product behavior, architecture, state, APIs,
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
| Realtime | Native Server-Sent Events (`EventSource`) |
| State | In-memory process-local `RoomStore` (no database, no KV) |
| Crypto | Native Node.js/Web APIs |
| i18n | Typed local dictionaries (EN/IT) |
| Testing | Vitest (dev-only) |

## Architecture

```text
                    in-memory RoomStore (one Node process)
                                   │
        ┌──────────────┬───────────┼───────────┬──────────────┐
        ▼              ▼           ▼           ▼              ▼
   POST /api/rooms  SSE events  host actions  answers      heartbeats
        │              │           │           │              │
   players / host ◀───┴───────────┴───────────┴──────────────┘
      (browsers, EventSource + fetch)
```

- **Routes:** `/` landing, `/create`, `/r/[code]` player room, `/host/[code]`
  host control surface.
- **Server:** Route Handlers mutate room state through a single domain layer;
  one sanitizer produces all public snapshots.
- **Presence:** authenticated heartbeats every 15 s; an actor is active for
  45 s; a room with zero active actors is deleted after 5 continuous empty
  minutes; absolute 24-hour TTL.
- **Security:** host token (≥ 256 bit) and participant tokens (≥ 128 bit)
  are stored server-side as hashes only; the plaintext secret never leaves
  the server until the actual reveal.

## Getting Started

### Prerequisites

- Node.js 20.9+ (Node.js 24 recommended)
- A package manager (`npm` or your choice)

### Install

```bash
git clone https://github.com/Okazakee/reveal-room.git
cd reveal-room
npm install
npm run dev
```

No environment variables are required. Rooms are entirely in-memory.

### Scripts

```bash
npm run dev        # Development server
npm run build      # Production build
npm run start      # Production server
npm run lint       # Lint
npm run test       # Vitest suite
npm run typecheck  # tsc --noEmit
```

## Deployment

**Canonical deployment: one persistent Node.js process.**

```bash
npm run build
npm run start
```

or a single Docker container / a single systemd or PM2 process (no cluster
mode). All hosts, players and SSE connections must reach the same process.

> **⚠️ Ephemeral state.** There is no persistence layer. Restarting or
> redeploying the process destroys every room, and empty rooms auto-delete
> after 5 minutes. This is correct, intended behavior.

> **⚠️ Vercel/serverless is not a reliable deployment for multiplayer.**
> Function instances may be reused, replaced, paused or scaled horizontally,
> and instance memory is not a shared state store. A serverless deployment may
> be used for visual demos or best-effort testing, but must not be treated as
> a correctness-safe production deployment for this memory-only design.

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

- ✅ Canonical spec (`REVEAL_ROOM_SPEC_v1.1.md`) committed
- ⏳ Next.js implementation (T01–T10 per the spec's work breakdown)

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