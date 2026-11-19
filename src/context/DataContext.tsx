import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
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
  const dataRef = useRef(data);
  const persistRef = useRef(persistAllowed);

  useEffect(() => {
    if (!persistAllowed) return;
    const timer = window.setTimeout(() => {
      const result = saveTo(bundle.storage, data);
      if (!result.ok) setWarning(result.error);
      else {
        setWarning(bundle.warning);
        setSavedAt(new Date().toISOString());
      }
    }, 200);
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

  const apply = (next: AppData | ((current: AppData) => AppData)) => {
    setData((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      dataRef.current = resolved;
      return resolved;
    });
  };

  const replaceAll = (next: AppData) => {
    dataRef.current = next;
    persistRef.current = true;
    setPersistAllowed(true);
    setRecovering(false);
    setCorruptRaw(null);
    setData(next);
    const result = saveTo(bundle.storage, next);
    setWarning(result.ok ? bundle.warning : result.error);
    if (result.ok) setSavedAt(new Date().toISOString());
  };

  const api: DataApi = {
    data,
    savedText: savedLabel(savedAt),
    warning,
    recovering,
    corruptRaw,
    apply,
    replaceAll,
    startFresh: () => replaceAll(emptyData()),
  };

  return <DataContext.Provider value={api}>{children}</DataContext.Provider>;
}

export function useAppData(): DataApi {
  const value = useContext(DataContext);
  if (!value) throw new Error("DataProvider가 없습니다.");
  return value;
}
