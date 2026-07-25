import type {
  FakePaymentMode,
  FakePaymentProvider,
} from './types.js';

export class FakePayment implements FakePaymentProvider {
  readonly name = 'fake-payment';

  private mode: FakePaymentMode = 'success';
  private callCount = 0;
  private initializeCalls = 0;
  private verifyCalls = 0;
  private verifyAmount = '4500.00';

  setMode(mode: FakePaymentMode) { this.mode = mode; }
  getCallCount() { return this.callCount; }
  getInitializeCallCount() { return this.initializeCalls; }
  getVerifyCallCount() { return this.verifyCalls; }
  reset() {
    this.callCount = 0;
    this.initializeCalls = 0;
    this.verifyCalls = 0;
    this.mode = 'success';
    this.verifyAmount = '4500.00';
  }
  setVerifyAmount(amount: string) { this.verifyAmount = amount; }

  async initialize(input: Parameters<FakePaymentProvider['initialize']>[0]) {
    this.callCount++;
    this.initializeCalls++;
    if (this.mode === 'timeout') {
      await new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 50));
    }
    if (this.mode === 'fail') {
      throw Object.assign(new Error('Fake init failure'), { statusCode: 500 });
    }
    return {
      checkoutUrl: `https://fake-chapa.test/checkout/${input.txRef}`,
      providerRef: `FAKE-${input.txRef}`,
    };
  }

  async verify(txRef: string) {
    this.callCount++;
    this.verifyCalls++;
    if (this.mode === 'timeout') {
      await new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 50));
    }
    if (this.mode === 'fail') {
      return { status: 'failed' as const, amount: this.verifyAmount, currency: 'ETB', reference: null, raw: {} };
    }
    if (this.mode === 'pending') {
      return { status: 'pending' as const, amount: this.verifyAmount, currency: 'ETB', reference: null, raw: {} };
    }
    if (this.mode === 'amount_mismatch') {
      return { status: 'success' as const, amount: '1.00', currency: 'ETB', reference: `REF-${txRef}`, raw: {} };
    }
    if (this.mode === 'currency_mismatch') {
      return { status: 'success' as const, amount: this.verifyAmount, currency: 'USD', reference: `REF-${txRef}`, raw: {} };
    }
    return {
      status: 'success' as const,
      amount: this.verifyAmount,
      currency: 'ETB',
      reference: `REF-${txRef}`,
      raw: {},
    };
  }
}

export const fakePayment = new FakePayment();
