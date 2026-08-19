import { RoomStore } from "@/lib/runtime/room-store";
import { getRoomRepository } from "@/lib/runtime/repository";

/**
 * Construct a domain store bound to the configured repository. The store is
 * stateless (rooms live in the repository), so a fresh instance per request
 * is correct and cheap.
 */
export function createStore(): RoomStore {
  return new RoomStore(getRoomRepository());
}
