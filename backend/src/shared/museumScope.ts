import { createHash } from 'node:crypto';

/**
 * Domain separator, so a scope can never collide with a hash of the same id
 * computed for some other purpose elsewhere in the system.
 */
const SCOPE_DOMAIN = 'museum-scope:v1:';

/**
 * A stable, opaque per-museum key safe to hand to a visitor client.
 *
 * The visitor app needs to know that two rooms belong to the same museum — its
 * ticket grant is cached per museum for 24 hours, and a room-scoped key would
 * re-prompt in every room. It does not need to know *which* museum, and
 * `Museum.id` is platform state that visitor responses deliberately withhold
 * (see tests/integration/waypoints.test.ts).
 *
 * A truncated SHA-256 satisfies both: equal for rooms of one museum, different
 * across museums, and not the internal identifier. It is deliberately unsalted
 * so the value is stable for the lifetime of the museum — salting with a
 * rotatable secret would silently void every cached ticket grant on rotation.
 * 128 bits is far beyond what a collision would need, and the input is a v4
 * UUID, so enumerating candidates is not feasible.
 */
export function museumScopeFor(museumId: string): string {
  return createHash('sha256').update(`${SCOPE_DOMAIN}${museumId}`).digest('hex').slice(0, 32);
}
