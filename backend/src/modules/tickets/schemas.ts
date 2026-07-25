import { z } from 'zod';

export const validateTicketRequestSchema = z.object({
  museumId: z.uuid(),
  ticketCode: z.string().min(1).max(200),
});

export const validateTicketResponseSchema = z.object({
  valid: z.boolean(),
  // false means this museum has no ticket gate configured, so `valid` is
  // vacuously true rather than the result of a vendor check.
  ticketRequired: z.boolean(),
});

export type ValidateTicketRequest = z.infer<typeof validateTicketRequestSchema>;
export type ValidateTicketResponse = z.infer<typeof validateTicketResponseSchema>;
