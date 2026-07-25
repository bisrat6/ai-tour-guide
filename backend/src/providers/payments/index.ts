import { env } from '../../config/env.js';
import { chapaPayment } from './chapa.js';
import { fakePayment } from './fake.js';
import type { PaymentProvider } from './types.js';

export type { PaymentProvider, FakePaymentProvider, FakePaymentMode } from './types.js';

/**
 * The default is 'fake' so development and tests need no Chapa account. That
 * default is safe only because config/env.ts refuses to boot a production
 * process with it — the fake provider reports every checkout as paid.
 */
export function getPaymentProvider(): PaymentProvider {
  return env.PAYMENTS_PROVIDER === 'fake' ? fakePayment : chapaPayment;
}
