import { describe, expect, it } from "vitest";
import { MemoryRoomRepository } from "@/lib/runtime/room-repository";
import { RoomStore } from "@/lib/runtime/room-store";
import {
  generateHostToken,
  generateParticipantToken,
  hashToken,
} from "@/lib/security/tokens";

function createStoreRoom() {
  const store = new RoomStore(new MemoryRoomRepository());
  return { store };
}

describe("token verification (AC-TEST-002)", () => {
  it("stores only the hash, never the plaintext", async () => {
    const { store } = createStoreRoom();
    const { room, hostToken } = await store.create({
      secret: "ABCD-1234",
      locale: "en",
      gameMode: "party",
      revealMode: "progressive",
      challengeCount: 3,
    });
    expect(room.hostTokenHash).not.toBe(hostToken);
    expect(room.hostTokenHash).toBe(hashToken(hostToken));
    expect(hashToken(hostToken)).toHaveLength(64); // SHA-256 hex
  });

  it("accepts the valid host token and rejects a wrong one", async () => {
    const { store } = createStoreRoom();
    const { room, hostToken } = await store.create({
      secret: "ABCD-1234",
      locale: "en",
      gameMode: "party",
      revealMode: "progressive",
      challengeCount: 3,
    });
    expect(await store.verifyHostToken(room.code, hostToken)).toBe(true);
    expect(await store.verifyHostToken(room.code, "wrong-token")).toBe(false);
    expect(await store.verifyHostToken("XXXXXX", hostToken)).toBe(false);
  });

  it("verifies participant tokens and keeps them isolated from host tokens", async () => {
    const { store } = createStoreRoom();
    const { room } = await store.create({
      secret: "ABCD-1234",
      locale: "en",
      gameMode: "party",
      revealMode: "progressive",
      challengeCount: 3,
    });
    const { participant, token } = await store.join(room.code, "Marco");

    expect(await store.verifyParticipantToken(room.code, participant.id, token)).toBe(true);
    expect(await store.verifyParticipantToken(room.code, participant.id, "nope")).toBe(false);
    // Participant token is not a host token and vice versa.
    expect(await store.verifyHostToken(room.code, token)).toBe(false);
    const otherHost = generateHostToken();
    expect(await store.verifyParticipantToken(room.code, participant.id, otherHost)).toBe(false);
  });

  it("generates host tokens of at least 256 bits and participant tokens of at least 128 bits", () => {
    expect(Buffer.byteLength(generateHostToken(), "base64url") * 8).toBeGreaterThanOrEqual(256);
    expect(Buffer.byteLength(generateParticipantToken(), "base64url") * 8).toBeGreaterThanOrEqual(128);
  });

  it("rejects a participant whose credentials do not exist", async () => {
    const { store } = createStoreRoom();
    const { room } = await store.create({
      secret: "ABCD-1234",
      locale: "en",
      gameMode: "party",
      revealMode: "progressive",
      challengeCount: 3,
    });
    await expect(store.resume(room.code, "missing-id", "some-token")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
