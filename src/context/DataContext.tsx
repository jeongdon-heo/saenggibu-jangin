import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { clearAiKey, readAiKey, writeAiKey } from "../lib/aiKey";
import { emptyData } from "../lib/defaults";
import { savedLabel } from "../lib/format";
import { getBrowserStorage, loadFrom, saveTo } from "../lib/storage";
import type { AppData } from "../types";

type DataApi = {
  data: AppData;
  savedText: string;
  warning: string | null;
  recovering: boolean;
  corruptRaw: string | null;
  apply: (next: AppData | ((current: AppData) => AppData)) => void;
  replaceAll: (next: AppData) => void;
  startFresh: () => void;
  aiKey: string;
  setAiKey: (key: string) => void;
  persistAiAccess: (remember: boolean, key: string) => void;
};

const DataContext = createContext<DataApi | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [bundle] = useState(() => getBrowserStorage());
  const [loaded] = useState(() => loadFrom(bundle.storage));
  const [data, setData] = useState<AppData>(loaded.data);
  const [persistAllowed, setPersistAllowed] = useState(loaded.persist);
  const [recovering, setRecovering] = useState(!loaded.persist);
  const [corruptRaw, setCorruptRaw] = useState<string | null>(loaded.rawBackup);
  const [warning, setWarning] = useState<string | null>(loaded.persist ? bundle.warning : null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [aiKey, setAiKeyState] = useState(() => (loaded.data.aiSettings.rememberKey ? readAiKey(bundle.storage) : ""));
  const dataRef = useRef(data);
  const persistRef = useRef(persistAllowed);

  useEffect(() => {
    if (!persistAllowed) return;
    const timer = window.setTimeout(() => {
      const result = saveTo(bundle.storage, data);
      if (!result.ok) setWarning(result.error);
      else {
        setWarning(bundle.warning);
        const next = new Date().toISOString();
        setSavedAt((current) => (savedLabel(current) === savedLabel(next) ? current : next));
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [bundle.storage, bundle.warning, data, persistAllowed]);

  useEffect(() => {
    const flush = () => {
      if (!persistRef.current) return;
      saveTo(bundle.storage, dataRef.current);
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [bundle.storage]);

  const apply = useCallback((next: AppData | ((current: AppData) => AppData)) => {
    setData((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      dataRef.current = resolved;
      return resolved;
    });
  }, []);

  const replaceAll = useCallback((next: AppData) => {
    dataRef.current = next;
    persistRef.current = true;
    setPersistAllowed(true);
    setRecovering(false);
    setCorruptRaw(null);
    setData(next);
    const result = saveTo(bundle.storage, next);
    setWarning(result.ok ? bundle.warning : result.error);
    if (result.ok) setSavedAt(new Date().toISOString());
  }, [bundle.storage, bundle.warning]);

  const persistAiAccess = useCallback((remember: boolean, key: string) => {
    setAiKeyState(key);
    if (remember && key.trim()) writeAiKey(bundle.storage, key);
    else clearAiKey(bundle.storage);
  }, [bundle.storage]);

  const setAiKey = useCallback((key: string) => {
    setAiKeyState(key);
    if (dataRef.current.aiSettings.rememberKey) {
      if (key.trim()) writeAiKey(bundle.storage, key);
      else clearAiKey(bundle.storage);
    }
  }, [bundle.storage]);
  const startFresh = useCallback(() => replaceAll(emptyData()), [replaceAll]);
  const api = useMemo<DataApi>(() => ({
    data,
    savedText: savedLabel(savedAt),
    warning,
    recovering,
    corruptRaw,
    apply,
    replaceAll,
    startFresh,
    aiKey,
    setAiKey,
    persistAiAccess,
  }), [aiKey, apply, corruptRaw, data, persistAiAccess, recovering, replaceAll, savedAt, setAiKey, startFresh, warning]);

  return <DataContext.Provider value={api}>{children}</DataContext.Provider>;
}

export function useAppData(): DataApi {
  const value = useContext(DataContext);
  if (!value) throw new Error("DataProvider가 없습니다.");
  return value;
}
