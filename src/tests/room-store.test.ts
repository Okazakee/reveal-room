import { describe, expect, it } from "vitest";
import { ApiError, API_ERROR_CODES } from "@/lib/api/errors";
import {
  validateCreateBody,
  validateDisplayName,
  validateSecret,
} from "@/lib/api/validation";
import { MemoryRoomRepository } from "@/lib/runtime/room-repository";
import { RoomStore } from "@/lib/runtime/room-store";
import { MAX_PARTICIPANTS_PER_ROOM } from "@/lib/types";
import { setupSoloGame, solveChallenge, wrongAnswerFor } from "@/tests/helpers";

function expectInvalid(fn: () => unknown) {
  try {
    fn();
    expect.unreachable();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("INVALID_REQUEST");
  }
}

describe("stale challenge handling (AC-TEST-009)", () => {
  it("rejects re-submission of a solved challenge without advancing twice", async () => {
    const crew = await setupSoloGame();
    const staleId = await solveChallenge(crew); // challenge 1 solved
    expect((await crew.store.getPublicState(crew.code)).progress.completed).toBe(1);

    // Re-submit the old challenge id with an arbitrary answer.
    try {
      await crew.store.submitAnswer(crew.code, crew.playerId, staleId, 1);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe("STALE_CHALLENGE");
    }

    const afterSecond = await crew.store.getPublicState(crew.code);
    expect(afterSecond.progress.completed).toBe(1); // not advanced twice
    expect(afterSecond.currentChallenge!.id).not.toBe(staleId);
  });

  it("returns correct:false for a wrong answer and does not advance", async () => {
    const crew = await setupSoloGame();
    const challenge = await crew.store.getChallenge(crew.code, crew.playerId);
    const wrong = wrongAnswerFor(challenge.payload, challenge.answer);
    const result = await crew.store.submitAnswer(crew.code, crew.playerId, challenge.id, wrong);
    expect(result.correct).toBe(false);
    expect((await crew.store.getPublicState(crew.code)).progress.completed).toBe(0);
    expect((await crew.store.getPublicState(crew.code)).currentChallenge!.id).toBe(challenge.id);
  });

  it("rejects answers when the requester is not the assignee", async () => {
    const store = new RoomStore(new MemoryRoomRepository());
    const { room } = await store.create({
      secret: "X",
      locale: "en",
      gameMode: "party",
      revealMode: "progressive",
      challengeCount: 3,
    });
    const { participant: a } = await store.join(room.code, "A");
    const { participant: b } = await store.join(room.code, "B");
    await store.hostAction(room.code, { action: "start" });

    const challenge = (await store.getPublicState(room.code)).currentChallenge!;
    const nonAssignee = challenge.assigneeId === a.id ? b : a;
    try {
      await store.submitAnswer(room.code, nonAssignee.id, challenge.id, 1);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe("NOT_ASSIGNEE");
    }
  });
});

describe("input bounds (AC-TEST-010)", () => {
  const validBase = {
    secret: "valid secret",
    locale: "en",
    gameMode: "solo" as const,
    revealMode: "progressive" as const,
    challengeCount: 5,
  };

  it("rejects empty or whitespace-only secrets", () => {
    expectInvalid(() => validateSecret(""));
    expectInvalid(() => validateSecret("   \n  "));
    expect(() => validateSecret("x")).not.toThrow();
  });

  it("rejects secrets over 280 graphemes", () => {
    expectInvalid(() => validateSecret("a".repeat(281)));
    expect(() => validateSecret("a".repeat(280))).not.toThrow();
  });

  it("rejects secrets over 2 KiB of UTF-8 even within the grapheme cap", () => {
    // One ZWJ family emoji is a single grapheme but ~18 UTF-8 bytes, so a
    // 280-grapheme secret can exceed the 2 KiB payload cap.
    const family = "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}"; // 👨‍👩‍👧
    const heavy = family.repeat(280);
    expect(Buffer.byteLength(heavy, "utf8")).toBeGreaterThan(2 * 1024);
    expectInvalid(() => validateSecret(heavy));

    // 280 graphemes of 4-byte CJK fit under 2 KiB and are accepted.
    const cjk = "漢".repeat(280);
    expect(() => validateSecret(cjk)).not.toThrow();
  });

  it("rejects invalid enums and challenge counts", () => {
    expectInvalid(() => validateCreateBody({ ...validBase, locale: "fr" }));
    expectInvalid(() => validateCreateBody({ ...validBase, gameMode: "coop" }));
    expectInvalid(() => validateCreateBody({ ...validBase, revealMode: "partial" }));
    expectInvalid(() => validateCreateBody({ ...validBase, challengeCount: 9 }));
    expectInvalid(() => validateCreateBody({ ...validBase, challengeCount: 2 }));
    expectInvalid(() => validateCreateBody({ ...validBase, secret: 42 }));
    expectInvalid(() => validateCreateBody(null));
  });

  it("bounds display names to 1–24 graphemes and trims whitespace", () => {
    expect(validateDisplayName("  Marco  ")).toBe("Marco");
    expect(validateDisplayName("M")).toBe("M");
    // 6 graphemes (3 family emoji + 3 letters) pass the 24-grapheme cap.
    expect(() => validateDisplayName("👨‍👩‍👧‍👦X".repeat(3))).not.toThrow();
    expectInvalid(() => validateDisplayName("   "));
    expectInvalid(() => validateDisplayName("a".repeat(25)));
    // 26 graphemes of family emoji exceed the cap.
    expectInvalid(() => validateDisplayName("👨‍👩‍👧‍👦".repeat(26)));
    expectInvalid(() => validateDisplayName(7));
  });

  it("caps participants at 20 per room", async () => {
    const store = new RoomStore(new MemoryRoomRepository());
    const { room } = await store.create({
      secret: "X",
      locale: "en",
      gameMode: "party",
      revealMode: "progressive",
      challengeCount: 3,
    });
    for (let i = 0; i < MAX_PARTICIPANTS_PER_ROOM; i++) {
      await store.join(room.code, `P${i}`);
    }
    try {
      await store.join(room.code, "OneTooMany");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe("ROOM_FULL");
    }
  });

  it("exposes every documented error code", () => {
    const expected = [
      "INVALID_REQUEST",
      "ROOM_NOT_FOUND",
      "ROOM_FULL",
      "ROOM_LIMIT_REACHED",
      "UNAUTHORIZED",
      "INVALID_STATE",
      "PLAYER_REQUIRED",
      "PLAYERS_REQUIRED",
      "NOT_ASSIGNEE",
      "CHALLENGE_NOT_FOUND",
      "STALE_CHALLENGE",
      "RATE_LIMITED",
    ];
    for (const code of expected) {
      expect(API_ERROR_CODES).toContain(code);
    }
  });
});
