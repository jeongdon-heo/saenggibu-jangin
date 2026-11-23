const STORAGE_KEY = "saenggibujangin.subject";

export function rememberedSubject(ids: string[]): string | null {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    return saved && ids.includes(saved) ? saved : null;
  } catch {
    return null;
  }
}

export function rememberSubject(id: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* 저장하지 못해도 이번 화면의 선택은 유지됩니다. */
  }
}
