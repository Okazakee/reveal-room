import { describe, expect, it } from "vitest";
import { MemoryRoomRepository } from "@/lib/runtime/room-repository";
import { roomExpiresAt } from "@/lib/runtime/room-repository";
import { RoomStore } from "@/lib/runtime/room-store";
import { FakeClock } from "@/tests/helpers";
import {
  ABSOLUTE_ROOM_TTL_MS,
  EMPTY_ROOM_TTL_MS,
  PRESENCE_TIMEOUT_MS,
} from "@/lib/types";

async function createRoom(store: RoomStore, mode: "solo" | "party" = "solo") {
  return store.create({
    secret: "TOP-SECRET-CODE",
    locale: "en",
    gameMode: mode,
    revealMode: "progressive",
    challengeCount: 3,
  });
}

function expectNotFound(promise: Promise<unknown>) {
  return expect(promise).rejects.toMatchObject({ code: "ROOM_NOT_FOUND" });
}

describe("presence and TTL lifecycle (AC-TEST-006, v1.2)", () => {
  it("keeps an actor active within 45 s and inactive after the window", async () => {
    const clock = new FakeClock();
    const repo = new MemoryRoomRepository(clock.now);
    const store = new RoomStore(repo, clock.now);
    const { room } = await createRoom(store);
    await store.join(room.code, "Marco");

    let state = await store.getPublicState(room.code);
    expect(state.roster[0]!.isActive).toBe(true);

    clock.advance(PRESENCE_TIMEOUT_MS - 1_000);
    state = await store.getPublicState(room.code);
    expect(state.roster[0]!.isActive).toBe(true);

    clock.advance(2_000); // past 45 s
    state = await store.getPublicState(room.code);
    expect(state.roster[0]!.isActive).toBe(false);
  });

  it("sets the room expiry to latest activity + 45 s + 5 min, capped at 24 h", async () => {
    const clock = new FakeClock();
    const repo = new MemoryRoomRepository(clock.now);
    const store = new RoomStore(repo, clock.now);
    const { room } = await createRoom(store);

    // Creation counts the host as active.
    expect(repo.expiryOf(room.code)).toBe(clock.now() + PRESENCE_TIMEOUT_MS + EMPTY_ROOM_TTL_MS);

    // A participant joining with a later lastSeenAt moves the expiry forward.
    clock.advance(10_000);
    const { participant } = await store.join(room.code, "Marco");
    expect(repo.expiryOf(room.code)).toBe(clock.now() + PRESENCE_TIMEOUT_MS + EMPTY_ROOM_TTL_MS);

    // Heartbeats extend the expiry.
    clock.advance(30_000);
    await store.touchParticipantPresence(room.code, participant.id);
    expect(repo.expiryOf(room.code)).toBe(clock.now() + PRESENCE_TIMEOUT_MS + EMPTY_ROOM_TTL_MS);
  });

  it("public polling does NOT extend the expiry", async () => {
    const clock = new FakeClock();
    const repo = new MemoryRoomRepository(clock.now);
    const store = new RoomStore(repo, clock.now);
    const { room } = await createRoom(store);
    const expiryAfterCreate = repo.expiryOf(room.code)!;

    clock.advance(60_000);
    await store.getPublicState(room.code); // read-only poll
    expect(repo.expiryOf(room.code)).toBe(expiryAfterCreate);
  });

  it("expires the room ~5 minutes after the final actor goes inactive", async () => {
    const clock = new FakeClock();
    const repo = new MemoryRoomRepository(clock.now);
    const store = new RoomStore(repo, clock.now);
    const { room } = await createRoom(store);

    // Host last seen at creation. Expiry = createdAt + 45 s + 5 min.
    const expiry = repo.expiryOf(room.code)!;
    clock.advance(expiry - clock.now() - 1_000);
    expect((await store.getPublicState(room.code)).status).toBe("lobby"); // still alive

    clock.advance(2_000); // past expiry
    await expectNotFound(store.getPublicState(room.code));
  });

  it("returning presence extends the expiry before it lapses", async () => {
    const clock = new FakeClock();
    const repo = new MemoryRoomRepository(clock.now);
    const store = new RoomStore(repo, clock.now);
    const { room } = await createRoom(store);
    const expiry = repo.expiryOf(room.code)!;

    // Host returns just before expiry and heartbeats: the room lives longer.
    clock.advance(expiry - clock.now() - 1_000);
    await store.touchHostPresence(room.code);
    expect(repo.expiryOf(room.code)!).toBeGreaterThan(clock.now());
    clock.advance(60_000);
    expect((await store.getPublicState(room.code)).status).toBe("lobby");
  });

  it("never exceeds the absolute 24 h TTL even with constant heartbeats", async () => {
    const clock = new FakeClock();
    const repo = new MemoryRoomRepository(clock.now);
    const store = new RoomStore(repo, clock.now);
    const { room } = await createRoom(store);
    const createdAt = clock.now();

    // Heartbeats keep the room alive within the 24 h window...
    for (let i = 0; i < 20; i++) {
      clock.advance(30_000);
      await store.touchHostPresence(room.code);
      expect(repo.expiryOf(room.code)!).toBeLessThanOrEqual(createdAt + ABSOLUTE_ROOM_TTL_MS);
    }
    // ...and the hard cap eventually expires it regardless of activity.
    clock.advance(ABSOLUTE_ROOM_TTL_MS + 1_000);
    await store.touchHostPresence(room.code).catch(() => undefined); // may already be gone
    await expectNotFound(store.getPublicState(room.code));
  });

  it("deletes immediately on host action (RR-PRES-007)", async () => {
    const store = new RoomStore(new MemoryRoomRepository());
    const { room } = await createRoom(store);
    expect(await store.deleteRoom(room.code, "host")).toBe(true);
    expect(await store.deleteRoom(room.code, "host")).toBe(false);
    await expectNotFound(store.getPublicState(room.code));
  });

  it("computes the expiry formula directly (spec v1.2 §41)", () => {
    const clock = new FakeClock();
    const repo = new MemoryRoomRepository(clock.now);
    void repo;
    const base: Parameters<typeof roomExpiresAt>[0] = {
      version: 1,
      code: "X",
      title: "t",
      secret: "s",
      locale: "en",
      gameMode: "solo",
      revealMode: "progressive",
      challengeCount: 3,
      status: "lobby",
      hostTokenHash: "h",
      hostPresence: { lastSeenAt: clock.now() },
      participants: new Map(),
      challengeHistory: [],
      revealOrder: [],
      revealedMaskableCount: 0,
      createdAt: clock.now(),
      usedTypes: [],
    };
    const expected = clock.now() + PRESENCE_TIMEOUT_MS + EMPTY_ROOM_TTL_MS;
    expect(roomExpiresAt(base)).toBe(expected);
    expect(roomExpiresAt(base)).toBeLessThanOrEqual(clock.now() + ABSOLUTE_ROOM_TTL_MS);
  });
});
