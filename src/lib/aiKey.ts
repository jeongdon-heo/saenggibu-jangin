import type { StorageLike } from "./storage";

export const AI_KEY_STORAGE = "saenggibujangin.aiKey";

export function readAiKey(storage: StorageLike): string {
  try {
    return storage.getItem(AI_KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export function writeAiKey(storage: StorageLike, key: string) {
  storage.setItem(AI_KEY_STORAGE, key);
}

export function clearAiKey(storage: StorageLike) {
  storage.removeItem(AI_KEY_STORAGE);
}
