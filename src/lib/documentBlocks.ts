export type DocBlock =
  | { kind: "text"; text: string }
  | { kind: "table"; rows: string[][] };
