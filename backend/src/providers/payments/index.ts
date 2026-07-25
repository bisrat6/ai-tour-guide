import { env } from '../../config/env.js';
import type { PaymentProvider } from './types.js';
import { chapaPayment } from './chapa.js';
import { fakePayment } from './fake.js';

export function getPaymentProvider(): PaymentProvider {
  if (env.PAYMENTS_PROVIDER === 'fake') return fakePayment;
  return chapaPayment;
}

export type { PaymentProvider, FakePaymentProvider } from './types.js';
