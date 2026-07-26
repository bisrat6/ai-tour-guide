import { z } from 'zod';

/**
 * The museum is identified either directly by `museumId`, or indirectly by the
 * room the visitor scanned. The app only ever has the latter: a QR code carries
 * a room id, and visitor responses withhold `Museum.id` on purpose. `museumId`
 * stays supported for callers that already hold one, such as the admin tooling.
 */
export const validateTicketRequestSchema = z
  .object({
    museumId: z.uuid().optional(),
    waypointId: z.uuid().optional(),
    ticketCode: z.string().min(1).max(200),
  })
  .refine((body) => (body.museumId === undefined) !== (body.waypointId === undefined), {
    message: 'exactly one of museumId or waypointId is required',
    path: ['waypointId'],
  });

export const validateTicketResponseSchema = z.object({
  valid: z.boolean(),
  // false means this museum has no ticket gate configured, so `valid` is
  // vacuously true rather than the result of a vendor check.
  ticketRequired: z.boolean(),
  // Opaque per-museum key, matching the one on GET /waypoint/:id, so the client
  // can cache this grant against the whole museum rather than a single room.
  museumScope: z.string(),
});

export type ValidateTicketRequest = z.infer<typeof validateTicketRequestSchema>;
export type ValidateTicketResponse = z.infer<typeof validateTicketResponseSchema>;
