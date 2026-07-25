import { env } from '../../config/env.js';
import { fakeTicket } from './fake.js';
import { httpTicket } from './http.js';
import type { TicketProvider } from './types.js';

export type { TicketProvider } from './types.js';

export function getTicketProvider(): TicketProvider {
  return env.TICKETS_PROVIDER === 'fake' ? fakeTicket : httpTicket;
}
