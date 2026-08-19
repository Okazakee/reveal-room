import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { MemoryRoomRepository } from "@/lib/runtime/room-repository";
import { RoomStore } from "@/lib/runtime/room-store";
import { setupSoloGame, solveChallenge } from "@/tests/helpers";

function expectCode(error: unknown, code: ApiError["code"]) {
  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).code).toBe(code);
}

describe("state machine (AC-TEST-005)", () => {
  it("rejects start without any joined player", async () => {
    const store = new RoomStore(new MemoryRoomRepository());
    const { room } = await store.create({
      secret: "S",
      locale: "en",
      gameMode: "solo",
      revealMode: "progressive",
      challengeCount: 3,
    });
    try {
      await store.hostAction(room.code, { action: "start" });
      expect.unreachable();
    } catch (error) {
      expectCode(error, "PLAYER_REQUIRED");
    }
  });

  it("requires at least two active players to start a party game", async () => {
    const store = new RoomStore(new MemoryRoomRepository());
    const { room } = await store.create({
      secret: "S",
      locale: "en",
      gameMode: "party",
      revealMode: "progressive",
      challengeCount: 3,
    });
    await store.join(room.code, "Alone");
    try {
      await store.hostAction(room.code, { action: "start" });
      expect.unreachable();
    } catch (error) {
      expectCode(error, "PLAYERS_REQUIRED");
    }
    await store.join(room.code, "Second");
    await store.hostAction(room.code, { action: "start" });
    expect((await store.getPublicState(room.code)).status).toBe("playing");
  });

  it("allows lobby → playing and pauses/resumes", async () => {
    const crew = await setupSoloGame();
    expect((await crew.store.getPublicState(crew.code)).status).toBe("playing");

    await crew.store.hostAction(crew.code, { action: "pause" });
    expect((await crew.store.getPublicState(crew.code)).status).toBe("paused");

    await crew.store.hostAction(crew.code, { action: "resume" });
    expect((await crew.store.getPublicState(crew.code)).status).toBe("playing");
  });

  it("rejects invalid transitions with INVALID_STATE", async () => {
    const crew = await setupSoloGame();
    const invalid = async (action: { action: string }) => {
      try {
        await crew.store.hostAction(crew.code, action as never);
        expect.unreachable();
      } catch (error) {
        expectCode(error, "INVALID_STATE");
      }
    };

    await invalid({ action: "start" }); // already playing
    await invalid({ action: "resume" }); // not paused
    await crew.store.hostAction(crew.code, { action: "pause" }); // playing → paused
    await invalid({ action: "pause" }); // pause from paused
    await invalid({ action: "start" }); // start from paused
  });

  it("completes after the final challenge and resets back to lobby", async () => {
    const crew = await setupSoloGame();
    const total = (await crew.store.getPublicState(crew.code)).challengeCount;
    for (let i = 0; i < total; i++) await solveChallenge(crew);

    const completed = await crew.store.getPublicState(crew.code);
    expect(completed.status).toBe("completed");
    expect(completed.isFullyRevealed).toBe(true);
    expect(completed.stats?.elapsedMs).toBeGreaterThanOrEqual(0);

    // An answer attempt after completion is rejected (no current challenge).
    try {
      await crew.store.submitAnswer(crew.code, crew.playerId, "anything", 1);
      expect.unreachable();
    } catch (error) {
      expectCode(error, "CHALLENGE_NOT_FOUND");
    }

    await crew.store.hostAction(crew.code, { action: "reset" });
    const reset = await crew.store.getPublicState(crew.code);
    expect(reset.status).toBe("lobby");
    expect(reset.progress.completed).toBe(0);
    expect(reset.isFullyRevealed).toBe(false);
    expect(reset.maskedSecret).not.toBe("ABCD-1234-PQRS");
    expect(reset.currentChallenge).toBeUndefined();
  });

  it("reveal now ends the game immediately from playing", async () => {
    const crew = await setupSoloGame();
    await crew.store.hostAction(crew.code, { action: "reveal" });
    const state = await crew.store.getPublicState(crew.code);
    expect(state.status).toBe("completed");
    expect(state.isFullyRevealed).toBe(true);
    expect(state.maskedSecret).toBe("ABCD-1234-PQRS");
  });

  it("skip advances progress like a solved challenge", async () => {
    const crew = await setupSoloGame();
    await crew.store.hostAction(crew.code, { action: "skip" });
    const state = await crew.store.getPublicState(crew.code);
    expect(state.progress.completed).toBe(1);
    expect(state.status).toBe("playing");
    expect(state.currentChallenge).toBeDefined();
  });
});
