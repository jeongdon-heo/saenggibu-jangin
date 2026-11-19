import { useEffect } from "react";

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title === "홈" ? "생기부장인" : `${title} · 생기부장인`;
  }, [title]);
}
