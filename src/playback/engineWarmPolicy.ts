export function resolveWarmEngineModel(defaultModelId: string | null, activeModelId: string | null): string | null {
  return activeModelId ?? defaultModelId;
}

export function shouldReleaseEngineOnBackground(
  keepEngineWarm: boolean,
  playing: boolean,
  loading: boolean,
): boolean {
  return !keepEngineWarm && !playing && !loading;
}
