import { describe, expect, it } from "vitest";
import { isRoomCodeFormat } from "@/lib/api/validation";
import { MemoryRoomRepository } from "@/lib/runtime/room-repository";
import { RoomStore } from "@/lib/runtime/room-store";
import { generateRoomCode } from "@/lib/security/tokens";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@/lib/types";

describe("room codes (AC-TEST-001)", () => {
  it("generates codes with the exact length", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateRoomCode()).toHaveLength(ROOM_CODE_LENGTH);
    }
  });

  it("uses only the unambiguous alphabet", () => {
    const alphabet = new Set(ROOM_CODE_ALPHABET);
    expect(alphabet.has("I")).toBe(false);
    expect(alphabet.has("L")).toBe(false);
    expect(alphabet.has("O")).toBe(false);
    expect(alphabet.has("0")).toBe(false);
    expect(alphabet.has("1")).toBe(false);

    for (let i = 0; i < 500; i++) {
      for (const ch of generateRoomCode()) {
        expect(alphabet.has(ch)).toBe(true);
      }
    }
  });

  it("does not collide in practice across many creations", async () => {
    const store = new RoomStore(new MemoryRoomRepository());
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const { room } = await store.create({
        secret: `secret-${i}`,
        locale: "en",
        gameMode: "solo",
        revealMode: "progressive",
        challengeCount: 3,
      });
      expect(seen.has(room.code)).toBe(false);
      seen.add(room.code);
    }
  });

  it("accepts only well-formed codes", () => {
    expect(isRoomCodeFormat("K7P4XM")).toBe(true);
    expect(isRoomCodeFormat("abc123")).toBe(false);
    expect(isRoomCodeFormat("ABC1234")).toBe(false);
    expect(isRoomCodeFormat("ABO123")).toBe(false); // contains O
    expect(isRoomCodeFormat("ABC123")).toBe(false); // contains 1
    expect(isRoomCodeFormat("ABI234")).toBe(false); // contains I
    expect(isRoomCodeFormat("")).toBe(false);
    expect(isRoomCodeFormat(123456)).toBe(false);
  });
});
