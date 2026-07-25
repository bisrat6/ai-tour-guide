import { env } from '../../config/env.js';
import type { TicketProvider } from './types.js';
import { httpTicket } from './http.js';
import { fakeTicket } from './fake.js';

export function getTicketProvider(): TicketProvider {
  if (env.TICKETS_PROVIDER === 'fake') return fakeTicket;
  return httpTicket;
}

export type { TicketProvider } from './types.js';
