// Small stable string hash (FNV-1a, 32-bit). Pure JS, no native dep. Used for
// cache keys (settings) and the per-chunk text-drift guard.
export function stableHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
