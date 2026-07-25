import type { FakePaymentMode, FakePaymentProvider } from './types.js';

/**
 * In-memory payment provider for development and tests. Selected by
 * PAYMENTS_PROVIDER=fake, which is the default — see the note in
 * providers/payments/index.ts about why that matters for production.
 */
export class FakePayment implements FakePaymentProvider {
  readonly name = 'fake-payment';

  private mode: FakePaymentMode = 'success';
  private callCount = 0;
  private initializeCalls = 0;
  private verifyCalls = 0;
  private verifyAmount = '4500.00';

  setMode(mode: FakePaymentMode): void {
    this.mode = mode;
  }

  setVerifyAmount(amount: string): void {
    this.verifyAmount = amount;
  }

  getCallCount(): number {
    return this.callCount;
  }

  getInitializeCallCount(): number {
    return this.initializeCalls;
  }

  getVerifyCallCount(): number {
    return this.verifyCalls;
  }

  reset(): void {
    this.callCount = 0;
    this.initializeCalls = 0;
    this.verifyCalls = 0;
    this.mode = 'success';
    this.verifyAmount = '4500.00';
  }

  async initialize(
    input: Parameters<FakePaymentProvider['initialize']>[0],
  ): Promise<{ checkoutUrl: string; providerRef?: string }> {
    this.callCount += 1;
    this.initializeCalls += 1;

    if (this.mode === 'timeout') {
      await new Promise((_resolve, reject) => {
        setTimeout(() => reject(new Error('timeout')), 50);
      });
    }
    if (this.mode === 'fail') {
      throw Object.assign(new Error('Fake init failure'), { statusCode: 500 });
    }

    return {
      checkoutUrl: `https://fake-chapa.test/checkout/${input.txRef}`,
      providerRef: `FAKE-${input.txRef}`,
    };
  }

  async verify(txRef: string): ReturnType<FakePaymentProvider['verify']> {
    this.callCount += 1;
    this.verifyCalls += 1;

    if (this.mode === 'timeout') {
      await new Promise((_resolve, reject) => {
        setTimeout(() => reject(new Error('timeout')), 50);
      });
    }

    const base = { amount: this.verifyAmount, currency: 'ETB', raw: {} };

    switch (this.mode) {
      case 'fail':
        return { ...base, status: 'failed', reference: null };
      case 'pending':
        return { ...base, status: 'pending', reference: null };
      case 'amount_mismatch':
        return { ...base, status: 'success', amount: '1.00', reference: `REF-${txRef}` };
      case 'currency_mismatch':
        return { ...base, status: 'success', currency: 'USD', reference: `REF-${txRef}` };
      default:
        return { ...base, status: 'success', reference: `REF-${txRef}` };
    }
  }
}

export const fakePayment = new FakePayment();
