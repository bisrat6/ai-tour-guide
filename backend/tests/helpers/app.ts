import request from 'supertest';
import { app } from '../../src/app.js';
import { fakePayment } from '../../src/providers/payments/fake.js';
import { fakeTicket } from '../../src/providers/ticketing/fake.js';

/** Supertest agent against the Express app. */
export function api() {
  return request(app);
}

/** Reset scriptable fakes between tests. */
export function resetFakes() {
  fakePayment.reset();
  fakeTicket.reset();
}

export { fakePayment, fakeTicket };

/**
 * Default headers for ticket routes in tests — bypasses rate limits so
 * suites do not share a 10/min budget. Omit in the rate-limit case itself.
 */
export const bypassRateLimit = {
  'x-test-bypass-rate-limit': '1',
};
