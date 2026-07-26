// Logical reader page content (heading / sentence-split paragraph).

export type PageBlock =
  | { kind: 'h2'; text: string }
  | { kind: 'p'; sentences: string[] };
