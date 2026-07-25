import { z } from 'zod';

/**
 * Every error code the admin API can return, per §7.2 of
 * docs/backend-implementation-plan.md. This is the contract other
 * developers write client error handling against — it must not drift
 * from that table without updating both places.
 */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  FORBIDDEN: 'FORBIDDEN',
  CROSS_TENANT_ACCESS: 'CROSS_TENANT_ACCESS',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  ROOM_REFERENCED: 'ROOM_REFERENCED',
  INVALID_ROOM_SEQUENCE: 'INVALID_ROOM_SEQUENCE',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  UPSTREAM_FAILURE: 'UPSTREAM_FAILURE',
  UPSTREAM_UNAVAILABLE: 'UPSTREAM_UNAVAILABLE',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export const errorCodeSchema = z.enum(ErrorCode).meta({
  id: 'ErrorCode',
  description: 'Machine-readable error code. See §7.2 of the backend implementation plan.',
});

export const errorEnvelopeSchema = z
  .object({
    error: z.object({
      message: z.string().meta({ example: 'Invalid credentials.' }),
      code: errorCodeSchema,
      requestId: z.string().meta({ example: '01HQZXK7N8VJYB3F9G6R2T4W5M' }),
      details: z
        .array(
          z.object({
            path: z.string(),
            message: z.string(),
          }),
        )
        .optional()
        .meta({ description: 'Present only for VALIDATION_ERROR, one entry per invalid field.' }),
    }),
  })
  .meta({
    id: 'ErrorEnvelope',
    description: 'Shape of every non-2xx response, from every route. See §7.1.',
  });

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
