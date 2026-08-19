import { describe, expect, it } from "vitest";
import { MemoryRoomRepository } from "@/lib/runtime/room-repository";
import { RoomStore } from "@/lib/runtime/room-store";
import { deserializeRoom, serializeRoom } from "@/lib/runtime/stored-room";
import { setupSoloGame, solveChallenge } from "@/tests/helpers";

describe("stored-room serialization (v1.2)", () => {
  it("round-trips a room without losing participants or challenges", async () => {
    const crew = await setupSoloGame();

    // Add a second participant and complete one challenge so the stored
    // shape covers participants + currentChallenge + history.
    await crew.store.join(crew.code, "Second");
    await solveChallenge(crew);

    const room = (await crew.repo.get(crew.code))!;
    const stored = serializeRoom(room);
    const roundTripped = deserializeRoom(JSON.parse(JSON.stringify(stored)) as typeof stored);

    expect(roundTripped.code).toBe(room.code);
    expect(roundTripped.secret).toBe(room.secret);
    expect(roundTripped.version).toBe(room.version);
    expect(roundTripped.revealOrder).toEqual(room.revealOrder);
    expect(roundTripped.revealedMaskableCount).toBe(room.revealedMaskableCount);
    expect(roundTripped.hostTokenHash).toBe(room.hostTokenHash);
    expect(roundTripped.usedTypes).toEqual(room.usedTypes);
    expect(roundTripped.participants.size).toBe(room.participants.size);
    expect(roundTripped.challengeHistory.length).toBe(room.challengeHistory.length);
    for (const participant of room.participants.values()) {
      const restored = roundTripped.participants.get(participant.id)!;
      expect(restored.displayName).toBe(participant.displayName);
      expect(restored.tokenHash).toBe(participant.tokenHash);
      expect(restored.presence.lastSeenAt).toBe(participant.presence.lastSeenAt);
      expect(restored.assignedCount).toBe(participant.assignedCount);
    }
    if (room.currentChallenge !== undefined) {
      expect(roundTripped.currentChallenge?.id).toBe(room.currentChallenge.id);
      expect(roundTripped.currentChallenge?.payload).toEqual(room.currentChallenge.payload);
      expect(roundTripped.currentChallenge?.answer).toEqual(room.currentChallenge.answer);
    }
  });

  it("persists only serializable domain data — no runtime internals", async () => {
    const crew = await setupSoloGame();
    const room = (await crew.repo.get(crew.code))!;
    const stored = serializeRoom(room);
    const json = JSON.stringify(stored);

    expect(json).not.toContain("subscribers");
    expect(json).not.toContain("emptySince");
    expect(json).not.toContain("eventSequence");
    expect(json).not.toContain("rr:room:");
    expect(json).not.toContain("rr:lock:");
    expect(stored.participants).toBeInstanceOf(Object); // record, not Map
    expect(stored.participants).not.toBeInstanceOf(Map);
  });

  it("deserialized rooms can be mutated through the repository", async () => {
    const repo = new MemoryRoomRepository();
    const store = new RoomStore(repo);
    const { room } = await store.create({
      secret: "ROUNDTRIP",
      locale: "en",
      gameMode: "solo",
      revealMode: "progressive",
      challengeCount: 3,
    });

    const rehydrated = deserializeRoom(JSON.parse(JSON.stringify(serializeRoom(room))) as ReturnType<typeof serializeRoom>);
    expect(await repo.create(rehydrated)).toBe(false); // same code already exists

    const joined = await store.join(room.code, "Player");
    expect(joined.participant.displayName).toBe("Player");
    const state = await store.getPublicState(room.code);
    expect(state.roster).toHaveLength(1);
    expect(state.version).toBeGreaterThanOrEqual(2); // create + join mutations
  });
});
