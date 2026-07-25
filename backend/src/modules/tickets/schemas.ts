import { z } from 'zod';

export const validateTicketSchema = z.object({
  museumId: z.string().uuid('museumId must be a valid UUID'),
  ticketCode: z.string().min(1, 'ticketCode is required').max(200),
});

export type ValidateTicketInput = z.infer<typeof validateTicketSchema>;

export const validateTicketResponseSchema = z.object({
  valid: z.boolean(),
  ticketRequired: z.boolean(),
});
