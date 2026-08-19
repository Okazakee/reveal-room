import { describe, expect, it } from "vitest";
import { RoomStore } from "@/lib/runtime/room-store";
import { MemoryRoomRepository } from "@/lib/runtime/room-repository";
import { setupSoloGame, solve, solveChallenge } from "@/tests/helpers";

describe("public state safety (AC-TEST-004)", () => {
  it("never contains the plaintext secret before completion", async () => {
    const crew = await setupSoloGame();
    const secret = "ABCD-1234-PQRS";

    let state = await crew.store.getPublicState(crew.code);
    expect(state.maskedSecret).toBe("••••••••••••••");
    expect(state.isFullyRevealed).toBe(false);
    expect(JSON.stringify(state)).not.toContain(secret);

    // After every intermediate challenge, the full secret is still absent.
    const total = state.challengeCount;
    for (let i = 0; i < total - 1; i++) {
      await solveChallenge(crew);
      state = await crew.store.getPublicState(crew.code);
      expect(state.isFullyRevealed).toBe(false);
      expect(JSON.stringify(state)).not.toContain(secret);
      expect(state.progress.completed).toBe(i + 1);
    }
  });

  it("exposes the secret only once fully revealed", async () => {
    const crew = await setupSoloGame();
    const secret = "ABCD-1234-PQRS";
    const total = (await crew.store.getPublicState(crew.code)).challengeCount;
    for (let i = 0; i < total; i++) await solveChallenge(crew);

    const state = await crew.store.getPublicState(crew.code);
    expect(state.status).toBe("completed");
    expect(state.isFullyRevealed).toBe(true);
    expect(state.maskedSecret).toBe(secret);
    expect(JSON.stringify(state)).toContain(secret);
  });

  it("never exposes tokens, answers, reveal order, or persisted internals", async () => {
    const crew = await setupSoloGame();
    const challenge = await crew.store.getChallenge(crew.code, crew.playerId);
    const state = await crew.store.getPublicState(crew.code);
    const serialized = JSON.stringify(state);

    expect(serialized).not.toContain(crew.hostToken);
    expect(serialized).not.toContain(crew.playerToken);
    // Structural: public state has no answer field at all.
    expect(serialized).not.toContain('"answer"');
    expect(serialized).not.toContain("revealOrder");
    expect(serialized).not.toContain("tokenHash");
    expect(serialized).not.toContain("rr:room:");
    expect(serialized).not.toContain("rr:lock:");
    // String/array answers must not appear anywhere (scalar numeric answers
    // legitimately collide with public counters like completed/total).
    const answer = challenge.answer;
    if (typeof answer === "string") {
      expect(serialized).not.toContain(answer);
    } else if (Array.isArray(answer)) {
      expect(serialized).not.toContain(JSON.stringify(answer));
    }
  });

  it("exposes version and omits finalMessage until fully revealed", async () => {
    const store = new RoomStore(new MemoryRoomRepository());
    const { room } = await store.create({
      secret: "X1",
      finalMessage: "Happy birthday",
      locale: "en",
      gameMode: "solo",
      revealMode: "final",
      challengeCount: 3,
    });
    const { participant } = await store.join(room.code, "Solo");
    await store.hostAction(room.code, { action: "start" });

    const before = await store.getPublicState(room.code);
    expect(before.version).toBeGreaterThanOrEqual(1);
    expect(before.finalMessage).toBeUndefined();
    expect(before.isFullyRevealed).toBe(false);

    for (let i = 0; i < 3; i++) {
      const challenge = await store.getChallenge(room.code, participant.id);
      await store.submitAnswer(room.code, participant.id, challenge.id, solve(challenge.payload));
    }
    const after = await store.getPublicState(room.code);
    expect(after.isFullyRevealed).toBe(true);
    expect(after.finalMessage).toBe("Happy birthday");
    expect(after.version).toBeGreaterThan(before.version);
  });
});
