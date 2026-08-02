export class PlaybackRecoveryGate {
  private attempted = new Set<string>();

  claim(key: string): boolean {
    if (this.attempted.has(key)) return false;
    this.attempted.add(key);
    return true;
  }

  reset(key: string): void {
    this.attempted.delete(key);
  }

  clear(): void {
    this.attempted.clear();
  }
}
