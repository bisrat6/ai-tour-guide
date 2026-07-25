/**
 * Process-local in-flight request de-duplication. Concurrent callers with the
 * same key share one underlying promise instead of each triggering their own
 * (billable) provider call — the classic cache-stampede problem for the
 * moment right after a cache entry expires or is created for the first time.
 *
 * This is intentionally process-local, not distributed: correct for the
 * current single-instance deployment. If this ever runs on more than one
 * instance, a distributed lock (e.g. Redis) would be needed to close the gap
 * across processes — not worth building until that's actually the shape of
 * the deployment.
 */
export function dedupeInFlight<T>(store: Map<string, Promise<T>>, key: string, fn: () => Promise<T>): Promise<T> {
  const existing = store.get(key);
  if (existing) return existing;

  const promise = fn().finally(() => {
    store.delete(key);
  });
  store.set(key, promise);
  return promise;
}
