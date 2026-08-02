export type EngineLifecycleOptions<T> = {
  load: (key: string) => Promise<T>;
  release: (resource: T, key: string) => Promise<void>;
};

export type ResidentEngine<T> = {
  key: string;
  resource: T;
};
