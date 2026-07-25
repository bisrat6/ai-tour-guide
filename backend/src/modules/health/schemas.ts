import { z } from 'zod';

/**
 * The deploy gate's response shape. Lives in a schema file like every other
 * module's so scripts/generate-openapi.ts can publish it — a platform polling
 * this route deserves a contract as much as any admin client does.
 */
export const healthResponseSchema = z
  .object({
    status: z.literal('ok'),
    dbLatencyMs: z
      .int()
      .min(0)
      .meta({ description: 'Round-trip time of a real SELECT 1 against Postgres.', example: 3 }),
    version: z
      .string()
      .meta({ description: 'Value of version in package.json.', example: '0.1.0' }),
  })
  .meta({ id: 'HealthResponse' });

export type HealthResponse = z.infer<typeof healthResponseSchema>;
