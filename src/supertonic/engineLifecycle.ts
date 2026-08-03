import type { EngineLifecycleOptions, ResidentEngine } from './engineLifecycleTypes';

// Serializes engine replacement while allowing active inference to finish.
export class EngineLifecycle<T> {
  private current: ResidentEngine<T> | null = null;
  private tail: Promise<void> = Promise.resolve();
  private activeUses = 0;
  private idleResolvers: Array<() => void> = [];

  constructor(private readonly options: EngineLifecycleOptions<T>) {}

  isResident(key: string): boolean {
    return this.current?.key === key;
  }

  get(key: string): Promise<T> {
    return this.serialize(async () => (await this.ensure(key)).resource);
  }

  async use<R>(key: string, run: (resource: T) => Promise<R>): Promise<R> {
    const resource = await this.serialize(async () => {
      const resident = await this.ensure(key);
      this.activeUses++;
      return resident.resource;
    });

    try {
      return await run(resource);
    } finally {
      this.activeUses--;
      this.resolveIdle();
    }
  }

  releaseCurrent(): Promise<void> {
    return this.serialize(async () => {
      await this.waitForIdle();
      await this.releaseResident();
    });
  }

  private async ensure(key: string): Promise<ResidentEngine<T>> {
    if (this.current?.key === key) return this.current;
    await this.waitForIdle();
    await this.releaseResident();
    const resource = await this.options.load(key);
    this.current = { key, resource };
    return this.current;
  }

  private async releaseResident(): Promise<void> {
    const resident = this.current;
    if (!resident) return;
    this.current = null;
    await this.options.release(resident.resource, resident.key);
  }

  private waitForIdle(): Promise<void> {
    return this.activeUses === 0
      ? Promise.resolve()
      : new Promise<void>((resolve) => this.idleResolvers.push(resolve));
  }

  private resolveIdle(): void {
    if (this.activeUses !== 0 || this.idleResolvers.length === 0) return;
    const resolvers = this.idleResolvers;
    this.idleResolvers = [];
    resolvers.forEach((resolve) => resolve());
  }

  private serialize<R>(run: () => Promise<R>): Promise<R> {
    const result = this.tail.then(run, run);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }
}
