import { expect } from "vitest";
import { MemoryRoomRepository } from "@/lib/runtime/room-repository";
import { RoomStore } from "@/lib/runtime/room-store";

/** Deterministic in-memory clock for lifecycle tests. */
export class FakeClock {
  private value: number;

  constructor(start = 1_000_000) {
    this.value = start;
  }

  now = (): number => this.value;

  advance(ms: number): void {
    this.value += ms;
  }
}

interface ClientPayload {
  type: string;
  terms?: number[];
  options?: unknown[];
  grid?: string[];
  symbols?: string[];
  expression?: string;
  scrambled?: string;
  numbers?: number[];
}

/** Deterministic solver: derive the canonical answer from a client payload. */
export function solve(payload: unknown): unknown {
  const p = payload as ClientPayload;
  switch (p.type) {
    case "sequence": {
      const terms = p.terms!;
      const d = terms[1]! - terms[0]!;
      const isArithmetic = terms[2]! - terms[1]! === d && terms[3]! - terms[2]! === d;
      if (isArithmetic) return terms[3]! + d;
      const ratio = terms[1]! / terms[0]!;
      const isGeometric = terms[2]! / terms[1]! === ratio;
      if (isGeometric) return terms[3]! * ratio;
      // alternating pair: [x, y, x, y, x] → y
      return terms[1]!;
    }
    case "memory":
      return p.symbols!;
    case "odd-one-out": {
      const grid = p.grid!;
      const counts = new Map<string, number>();
      for (const glyph of grid) counts.set(glyph, (counts.get(glyph) ?? 0) + 1);
      const odd = [...counts.entries()].find(([, c]) => c === 1)![0]!;
      return grid.indexOf(odd);
    }
    case "quick-math": {
      // Test-only evaluator for the generated expression grammar (+, −, ×).
      const expression = p.expression!.replace(/×/g, "*").replace(/−/g, "-");
      return new Function(`return (${expression})`)() as number;
    }
    case "word-scramble": {
      const key = (w: string) => [...w].sort().join("");
      return p.options!.find((w) => key(w as string) === key(p.scrambled!))!;
    }
    case "order":
      return [...p.numbers!].sort((a, b) => a - b);
    default:
      throw new Error(`unknown type ${p.type}`);
  }
}

/** A wrong answer of the correct shape for the given payload. */
export function wrongAnswerFor(payload: unknown, canonical: unknown): unknown {
  const p = payload as ClientPayload;
  switch (p.type) {
    case "sequence":
    case "quick-math": {
      const wrongOption = p.options!.find((o) => o !== canonical);
      return wrongOption ?? ((canonical as number) + 1);
    }
    case "odd-one-out": {
      const index = canonical as number;
      return index === 0 ? 1 : 0;
    }
    case "word-scramble":
      return (p.options as string[]).find((o) => o !== canonical)!;
    case "memory": {
      const wrong = [...(canonical as string[])];
      const last = wrong.pop()!;
      wrong.unshift(last);
      return wrong;
    }
    case "order": {
      return [...(canonical as number[])].reverse();
    }
    default:
      return null;
  }
}

export interface TestCrew {
  store: RoomStore;
  repo: MemoryRoomRepository;
  code: string;
  hostToken: string;
  playerId: string;
  playerToken: string;
}

/** Create a solo room with one joined player, started, first challenge live. */
export async function setupSoloGame(): Promise<TestCrew> {
  const repo = new MemoryRoomRepository();
  const store = new RoomStore(repo);
  const { room, hostToken } = await store.create({
    secret: "ABCD-1234-PQRS",
    locale: "en",
    gameMode: "solo",
    revealMode: "progressive",
    challengeCount: 3,
  });
  const { participant, token } = await store.join(room.code, "Solo");
  await store.hostAction(room.code, { action: "start" });
  return {
    store,
    repo,
    code: room.code,
    hostToken,
    playerId: participant.id,
    playerToken: token,
  };
}

/** Solve the current challenge correctly and return its (now stale) id. */
export async function solveChallenge(crew: TestCrew): Promise<string> {
  const challenge = await crew.store.getChallenge(crew.code, crew.playerId);
  const answer = solve(challenge.payload);
  const result = await crew.store.submitAnswer(crew.code, crew.playerId, challenge.id, answer);
  expect(result.correct).toBe(true);
  return challenge.id;
}
