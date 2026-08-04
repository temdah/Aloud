export function rangesOverlap(start: number, end: number, otherStart: number, otherEnd: number): boolean {
  return end > otherStart && start < otherEnd;
}
