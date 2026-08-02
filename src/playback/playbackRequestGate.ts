export type PlaybackRequestId = number;

// Synthesis itself cannot be interrupted safely, but stale async completions
// must never replace or start the player. Every foreground intent owns one ID;
// canceling advances the generation and invalidates all older work.
export class PlaybackRequestGate {
  private generation = 0;

  begin(): PlaybackRequestId {
    this.generation += 1;
    return this.generation;
  }

  cancel(): void {
    this.generation += 1;
  }

  current(): PlaybackRequestId {
    return this.generation;
  }

  isCurrent(requestId: PlaybackRequestId): boolean {
    return requestId === this.generation;
  }
}
