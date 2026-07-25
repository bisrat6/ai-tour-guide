/**
 * Process-local in-flight de-duplication (dev2 §13.5). Concurrent callers with
 * the same key share one underlying promise instead of each triggering their
 * own billable provider call — the cache-stampede window right after an entry
 * expires or is created for the first time. A tour group asking the same
 * question at once should cost one LLM call, not one per visitor.
 *
 * Deliberately process-local, which is correct for a single-instance
 * deployment. Across replicas it would need a distributed lock, and that is not
 * worth building until the deployment actually has that shape.
 */
export function dedupeInFlight<T>(
  store: Map<string, Promise<T>>,
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const existing = store.get(key);
  if (existing) return existing;

  const promise = fn().finally(() => {
    store.delete(key);
  });
  store.set(key, promise);
  return promise;
}
