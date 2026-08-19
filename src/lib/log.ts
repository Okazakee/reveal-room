/**
 * Tiny structured logger. Never logs user content, tokens, or answers
 * (RR-SEC-007). Only the sparse lifecycle events named in the spec.
 */
export function logRoomEvent(message: string): void {
  console.log(`[reveal-room] ${message}`);
}
