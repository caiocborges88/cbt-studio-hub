import type { Database, Store } from "./service.js";
export class MemoryDatabase implements Database {
  data: Record<string, unknown>;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    initial: Record<string, unknown> = {},
    private persist?: (data: Record<string, unknown>) => void,
  ) {
    this.data = structuredClone(initial);
  }
  atomic<T>(work: (store: Store) => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const next = structuredClone(this.data);
      const store: Store = {
        get: async <V>(path: string) =>
          structuredClone((next[path] as V) ?? null),
        list: async <V>(path: string) => {
          const prefix = path.replace(/\/$/, "") + "/";
          return Object.entries(next)
            .filter(
              ([key]) =>
                key.startsWith(prefix) &&
                !key.slice(prefix.length).includes("/"),
            )
            .map(([, value]) => structuredClone(value) as V);
        },
        set: (path, value) => {
          next[path] = structuredClone(value);
        },
        delete: (path) => {
          delete next[path];
        },
      };
      const result = await work(store);
      this.data = next;
      this.persist?.(next);
      return structuredClone(result);
    });
    this.queue = run.catch(() => {});
    return run;
  }
}
