import { env } from '../../config/env.js';
import { chapaPayment } from './chapa.js';
import { fakePayment } from './fake.js';
import type { PaymentProvider } from './types.js';

export type { PaymentProvider, FakePaymentProvider, FakePaymentMode } from './types.js';

/**
 * NOTE (carried over from dev3's branch, see docs/d3-integration-audit.md):
 * PAYMENTS_PROVIDER defaults to 'fake' and nothing refuses 'fake' in
 * production, so a deploy that forgets to set it would grant paid tiers with no
 * money taken. Left as-is here because this port deliberately does not change
 * billing behaviour; it needs a decision and a production guard.
 */
export function getPaymentProvider(): PaymentProvider {
  return env.PAYMENTS_PROVIDER === 'fake' ? fakePayment : chapaPayment;
}
