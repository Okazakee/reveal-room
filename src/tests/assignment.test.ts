import { describe, expect, it } from "vitest";
import { MemoryRoomRepository } from "@/lib/runtime/room-repository";
import { RoomStore } from "@/lib/runtime/room-store";
import { FakeClock, solve } from "@/tests/helpers";
import { PRESENCE_TIMEOUT_MS } from "@/lib/types";

async function setupParty(clock: FakeClock, playerCount: number) {
  const repo = new MemoryRoomRepository(clock.now);
  const store = new RoomStore(repo, clock.now);
  const { room } = await store.create({
    secret: "PARTY-SECRET",
    locale: "en",
    gameMode: "party",
    revealMode: "progressive",
    challengeCount: 5,
  });
  const players: Array<{ id: string; token: string; name: string }> = [];
  for (let i = 0; i < playerCount; i++) {
    const name = `P${i + 1}`;
    const { participant, token } = await store.join(room.code, name);
    players.push({ id: participant.id, token, name });
  }
  return { store, repo, room, players };
}

/** Solve the current challenge as the given player. */
async function solveAs(store: RoomStore, code: string, playerId: string) {
  const challenge = await store.getChallenge(code, playerId);
  return store.submitAnswer(code, playerId, challenge.id, solve(challenge.payload));
}

describe("party assignment (AC-TEST-007)", () => {
  it("assigns every challenge to an active player and balances fairly", async () => {
    const clock = new FakeClock();
    const { store, room, players } = await setupParty(clock, 3);
    await store.hostAction(room.code, { action: "start" });

    const total = (await store.getPublicState(room.code)).challengeCount;
    for (let i = 0; i < total; i++) {
      const state = await store.getPublicState(room.code);
      const assigneeId = state.currentChallenge!.assigneeId;
      const assignee = players.find((p) => p.id === assigneeId);
      expect(assignee).toBeDefined();
      const result = await solveAs(store, room.code, assigneeId);
      expect(result.correct).toBe(true);
    }

    const finalRoster = (await store.getPublicState(room.code)).roster;
    const counts = finalRoster.map((p) => p.assignedCount).sort((a, b) => a - b);
    // 5 challenges across 3 players: counts differ by at most 1.
    expect(counts[2]! - counts[0]!).toBeLessThanOrEqual(1);
  });

  it("only assigns to players, never spectators", async () => {
    const clock = new FakeClock();
    const { store, room } = await setupParty(clock, 2);
    // Fill to the 12-player cap, then a 13th participant is a spectator.
    for (let i = 0; i < 10; i++) await store.join(room.code, `Extra${i}`);
    const { participant: spectator } = await store.join(room.code, "Spectator");
    expect(spectator.role).toBe("spectator");
    expect((await store.getPublicState(room.code)).roster.length).toBe(13);

    await store.hostAction(room.code, { action: "start" });
    const total = (await store.getPublicState(room.code)).challengeCount;
    for (let i = 0; i < total; i++) {
      const assigneeId = (await store.getPublicState(room.code)).currentChallenge!.assigneeId;
      expect(assigneeId).not.toBe(spectator.id);
      await solveAs(store, room.code, assigneeId);
    }
  });

  it("reassigns an inactive assignee's challenge to an active player", async () => {
    const clock = new FakeClock();
    const { store, room, players } = await setupParty(clock, 2);
    await store.hostAction(room.code, { action: "start" });

    const first = (await store.getPublicState(room.code)).currentChallenge!;
    const firstAssignee = first.assigneeId;
    const activeId = players.find((p) => p.id !== firstAssignee)!.id;

    // The assignee stops heartbeating; the other player stays active.
    clock.advance(PRESENCE_TIMEOUT_MS + 1_000);
    await store.touchParticipantPresence(room.code, activeId); // triggers normalization

    const after = await store.getPublicState(room.code);
    expect(after.currentChallenge!.id).toBe(first.id); // same challenge
    expect(after.currentChallenge!.assigneeId).toBe(activeId); // new assignee
    expect((await store.getChallenge(room.code, activeId)).id).toBe(first.id); // same payload/answer
  });

  it("normalizes via the public-read path when the assignee lapses", async () => {
    const clock = new FakeClock();
    const { store, room, players } = await setupParty(clock, 2);
    await store.hostAction(room.code, { action: "start" });

    const first = (await store.getPublicState(room.code)).currentChallenge!;
    const activeId = players.find((p) => p.id !== first.assigneeId)!.id;

    // Keep the other player active just before the 45 s window lapses.
    clock.advance(PRESENCE_TIMEOUT_MS - 1_000);
    await store.touchParticipantPresence(room.code, activeId);
    // The assignee (no heartbeat) crosses the window: the pure-read polling
    // path must reassign to the still-active player.
    clock.advance(2_000);
    const state = await store.getPublicState(room.code);
    expect(state.currentChallenge!.id).toBe(first.id); // same challenge
    expect(state.currentChallenge!.assigneeId).toBe(activeId); // reassigned by read path
  });

  it("solo mode always assigns to the solo player", async () => {
    const clock = new FakeClock();
    const repo = new MemoryRoomRepository(clock.now);
    const store = new RoomStore(repo, clock.now);
    const { room } = await store.create({
      secret: "SOLO",
      locale: "en",
      gameMode: "solo",
      revealMode: "progressive",
      challengeCount: 3,
    });
    const { participant } = await store.join(room.code, "Only");
    await store.join(room.code, "Late"); // spectator in solo
    await store.hostAction(room.code, { action: "start" });

    const total = (await store.getPublicState(room.code)).challengeCount;
    for (let i = 0; i < total; i++) {
      const assigneeId = (await store.getPublicState(room.code)).currentChallenge!.assigneeId;
      expect(assigneeId).toBe(participant.id);
      await solveAs(store, room.code, assigneeId);
    }
  });

  it("late joins after start become spectators", async () => {
    const clock = new FakeClock();
    const { store, room } = await setupParty(clock, 2);
    await store.hostAction(room.code, { action: "start" });
    const { participant } = await store.join(room.code, "LateJoiner");
    expect(participant.role).toBe("spectator");
  });
});
