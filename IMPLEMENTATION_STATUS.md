# IMPLEMENTATION_STATUS.md

Coordination ledger for the Reveal Room implementation (spec: `REVEAL_ROOM_SPEC_v1.1.md`, visual source: `reveal-room-showroom.html`).

**Model note:** all work executed on the primary DeepSeek v4 Flash route (`opencode-go/deepseek-v4-flash`). OMP role defaults map to other models and the task tool exposes no model override, so per the model mandate no subagents were spawned; a single agent carried all tasks.

| Task | Owner | Status | Files / modules | Checks | Notes |
| --- | --- | --- | --- | --- | --- |
| T01 Scaffold + standards | primary | ✅ | `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.ts`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/not-found.tsx` | typecheck/lint/build pass | Bun runtime; Next 16.3.1; deps: next/react/react-dom only (+dev tools); no Tailwind/UI kit/DB |
| T02 Domain types, validation, security | primary | ✅ | `src/lib/types.ts`, `src/lib/api/validation.ts`, `src/lib/api/errors.ts`, `src/lib/security/tokens.ts` | `tokens.test.ts`, `room-code.test.ts`, bounds tests | room codes from unambiguous alphabet; SHA-256 token hashes; timing-safe verify; typed validators |
| T03 Reveal + puzzle engines | primary | ✅ | `src/lib/game/reveal.ts`, `src/lib/game/challenges.ts` | `reveal.test.ts`, `challenges.test.ts` | Intl.Segmenter graphemes; progressive/final checkpoints; all six puzzle types; per-locale word banks (EN 80 / IT 110 words) |
| T04 RoomStore + lifecycle | primary | ✅ | `src/lib/runtime/room-store.ts`, `rate-limit.ts`, `singleton.ts`, `src/lib/log.ts` | `presence.test.ts`, `assignment.test.ts`, `state-machine.test.ts`, `room-store.test.ts` | fake-clock lifecycle; 15 s/45 s/5 min/24 h; fair assignment; inactive reassignment; single sanitizer; globalThis singleton |
| T05 HTTP API | primary | ✅ | `src/app/api/rooms/**` (create, get/delete, join, presence, challenge, answer, host-action) | curl + browser smoke | auth boundaries, no-store, machine error codes, rate limits |
| T06 SSE | primary | ✅ | `src/app/api/rooms/[code]/events/route.ts` | curl + browser smoke | retry 3000, full snapshots, : ping keepalive, gone event, abort cleanup |
| T07 i18n + visual primitives | primary | ✅ | `src/lib/i18n/{en,it,index}.ts`, `components/{SealMark,Button,Dialog,LanguageToggle,TopBar,SecretDisplay,ProgressLocks,PlayerRoster,StatusScreen,Unsealed}.tsx` | browser audit | EN/IT parity at compile time; showroom tokens in globals.css |
| T08 Website + Host UX | primary | ✅ | `src/app/page.tsx`, `src/app/create/page.tsx`, `src/components/HostRoom.tsx`, `src/app/host/[code]/page.tsx` | browser 1440 px flow | hero/topbar/phones; create flow; host token localStorage; lobby/dashboard/controls/confirm dialogs |
| T09 Player UX + puzzles | primary | ✅ | `src/components/PlayerRoom.tsx`, `src/components/puzzles/*` (6), `src/app/r/[code]/page.tsx` | browser 390 px flow | join/resume/spectator/paused/Unsealed; all six puzzle UIs; heartbeat; reconnect |
| T10 Integration/hardening/docs | primary | ✅ | `src/tests/*` (9 files, 71 tests), `README.md` | `bun run test` 71/71, typecheck, lint, `bun run build` | browser-verified flows; README documents ephemeral/single-process/serverless caveats |

## Verification log

- `bun install` — 386 packages, ok
- `bun run typecheck` — clean
- `bun run lint` — clean (eslint-config-next flat config)
- `bun run test` — 71/71 pass (room code, tokens, reveal, public-state leak, state machine, presence fake-clock, assignment, puzzles, stale answers, bounds)
- `bun run build` — production build ok; all 12 routes registered
- Live smoke (next start): create → join ×2 → resume → start → pause → late spectator join → resume → invalid start (409) → spectator challenge fetch (403 NOT_ASSIGNEE) → SSE snapshot stream → delete → gone event → 404
- Full game via API + UI: all six puzzle types solved; progressive reveal exact checkpoints `ceil(maskable·i/N)`; completed state shows full secret, final message, elapsed, mode
- Browser audit 1440 px landing: showroom metrics match (100 px headline −6.5 px tracking, #F4C95D accent, sticky 17 px topbar rgba(15,18,23,.84) blur(16), 3°/−8° phone rotations, no overflow)
- Browser audit 390 px player: join, lobby, assignee puzzle, spectator, paused, Unsealed (yellow burst, accent secret card, copy, confetti, meta)
- Italian UI verified on landing/create/join (all strings localized; default IT title)

## Blockers

None. One environment limitation: `inspect_image` (vision review) was unavailable (provider usage limit), so visual verification used computed-style audits + DOM assertions against the showroom's exact CSS values instead.

## Production validation findings (2026-08-19, deployment dpl_DFpiZZyvPNUKEMT44gYh7YjeXUCF)

### Works when traffic sticks to one warm instance
- Full game completed end-to-end via real UI on production (room 97FZB3): create → 2 players join → start → 5/5 challenges solved by real clicks across both players (quick-math, memory, order, odd-one-out, sequence) → progressive reveal exact checkpoints → `Unsealed` on host + both players → Copy → "Copied" → metadata correct.
- Presence heartbeats, pause/resume, late-join spectator, non-assignee 403, stale 401s all behaved per spec while on the warm instance.
- Network inspection: 27 captured API responses, **zero containing the plaintext secret**; challenge payloads carry no answer key.

### Architectural blocker (Vercel multi-instance, RR-DEPLOY-003 confirmed live)
Process-local room state lives only on the function instance that served its create. Vercel routes requests across multiple instances of the same deployment:

- **Reproduction (measured)**: room `2GAT4R` — 10/10 parallel GETs OK immediately after create; 1.5 s later, 5 fresh GETs → **1 OK, 4 ROOM_NOT_FOUND** (Vercel logs show both 200 and 404 for the same room at 10:59:09–10:59:11, same deployment).
- **Observed consequences**: a player page reload → "This room is gone" while the room was alive (reload's fresh connection routed to a cold instance); a `start` action no-op'd (request hit a cold instance, room stayed lobby); after ~1 min of reduced traffic, 8/8 fresh GETs for two live rooms returned ROOM_NOT_FOUND while an open SSE page still showed the live game.
- Inactive-assignee reassignment DID work on the serving instance (room CZW8VE: challenge reassigned to the active keeper after the assignee's page closed and the 45 s window lapsed).

No app-level crash: logs show only 200/401/404 (app error codes), no 5xx. Per spec phase 22, **no shared persistence was added** — the architecture decision is deferred to the user.

## v1.2 — Redis-backed shared-state migration (2026-08-19)

Decision Log entry added to `REVEAL_ROOM_SPEC_v1.2.md` (§48): room state moved
from process-local memory to Upstash Redis; Vercel is canonical production
again; polling replaces SSE; Redis TTL replaces process GC; per-room
distributed locks guard mutations.

- **Repository boundary:** `RoomRepository` (create/get/mutate/delete) with
  `MemoryRoomRepository` (tests/dev) and `RedisRoomRepository` (production).
  Selector policy in `src/lib/runtime/repository.ts`: `NODE_ENV=test` →
  memory; dev + `USE_MEMORY_STORE=true` → memory; otherwise Redis required
  (missing config = error, never silent fallback).
- **Distributed lock:** `SET rr:lock:{code} {token} NX PX 5000`, bounded
  acquisition (~2 s, jittered retries), atomic compare-and-release Lua script
  in `finally`; `LockTimeoutError` → 503 retryable.
- **TTL:** `min(createdAt + 24 h, latestActorLastSeenAt + 45 s + 5 min)`
  applied on every write (`pxat`); public GET never extends expiry.
- **Rate limiting:** Redis fixed-window counters (create/join/answer) with
  memory equivalent for tests/dev.
- **Removed:** SSE endpoint, EventSource hook, subscriber registry, process GC
  interval, globalThis singleton, 250-room process cap.
- **Added:** `useRoomPolling` (1 s visible / 3 s hidden, version-aware,
  transient-failure tolerance, gone-state, visibility resume, immediate
  refresh after local mutations); `version` on Room + PublicRoomState.
- **Tests:** migrated to async repo-backed store; 86/86 across 11 files
  (incl. serialization round-trip, TTL formula, distributed lock via fake
  Redis, Redis rate limiter, read-path assignee normalization).
- **Local smoke (memory mode):** create/join/start/solve/pause/resume/
  spectator/complete/delete verified via API; versions monotonic; `/events`
  returns 404.
- **Gates:** typecheck ✓, lint ✓, tests 86/86 ✓, build ✓ (no events route).

## Single-process production deployment (2026-08-19)

Decision Log entry added to `REVEAL_ROOM_SPEC_v1.1.md` (§48): canonical deployment moved from Vercel to one persistent process; Vercel remains demo-only.

- Target host: `vps` (vps-553a1f39, OVHcloud, Debian) — `/opt/reveal-room`
- Image: `reveal-room:1.0.0` (oven/bun:1.3-slim, multi-stage, single `bun run start` process)
- Container: `reveal-room`, `restart: unless-stopped`, `deploy.replicas: 1`, no volumes
- Port: `127.0.0.1:3010 → 3000` (host loopback only)
- Verified on host: container healthy; PID 1 = `bun run start`; `/` and `/create` 200; SSE stream returns `text/event-stream`, `no-cache, no-transform`, `x-accel-buffering: no`, `retry: 3000` + snapshot; keepalive `: ping` observed on a 17 s stream
- Reverse proxy: Nginx Proxy Manager (host network) — proxy host config documented in README (advanced nginx snippet, `proxy_buffering off`, long timeouts); public domain pending user input
- Local gates re-run after all changes: typecheck ✓, lint ✓, tests 71/71 ✓, build ✓

## v1.2 production validation (2026-08-19, deployments dpl_j9Qvu3t… / dpl_AmWXm…)

All against the deployed Vercel + Upstash Redis build (final: dpl_AmWXmZkgMz4cDnUE2M5yspxcw85p).

- **Multi-session party flow (real UI):** 1 host + 2 isolated players; full game completed via real clicks — all six puzzle types across two rooms; progressive reveal correct; Unsealed on host + both players; Copy → "Copied"; metadata correct.
- **Cross-instance consistency (the v1.1 failure reproduction):** 37/37 GETs OK for a live room (12 parallel + 5 fresh batches with 1.2 s delays) — **zero ROOM_NOT_FOUND** (v1.1: 1/5 OK in the same pattern).
- **Concurrent mutations:** two identical correct answers fired simultaneously → one 200 `correct:true`, the duplicate **409 STALE_CHALLENGE**; wrong answer `correct:false`; heartbeats 204; progress advanced exactly once; version monotonic; no 5xx.
- **Refresh/resume:** player page reload → identical roster, no duplicate, room intact (the v1.1 "room is gone" scenario).
- **Inactive assignee:** assignee's page closed → after the 45 s window, challenge (unchanged id/answer) reassigned to the active player via the read-path normalization; roster shows active/inactive correctly.
- **Polling sync:** spectator UI updated within a poll cycle without SSE.
- **Secret-leak audit:** 11+ captured production responses; plaintext secret present only in `isFullyRevealed: true` responses; zero pre-reveal leaks (GET/challenge/answer/presence).
- **Rate limiting:** create limit enforced (hit 10/10 min mid-validation — expected behavior).
- **EN/IT + responsive:** Italian landing/create/join verified on the deployed build; 390 px mobile flow clean; one visual defect found and fixed (landing phone bleed caused 15 px horizontal overflow → `overflow-x: clip` on body; verified non-scrollable after redeploy; sticky topbar unaffected).
- **Logs:** steady 1 s polling 200s + presence 204s; no 5xx, no lock/Redis errors, no unexpected ROOM_NOT_FOUND (the only historical 500s were the auto-deserialization bug, fixed and re-verified).

## Known limitations (by design)

- In-memory only: restart deletes rooms; empty rooms delete after 5 min; 24 h hard TTL.
- `"•"` inside a secret is visually indistinguishable from a mask (documented in SecretDisplay; cosmetic only).
- Vercel/serverless is not a correctness-safe deployment (documented in README).
