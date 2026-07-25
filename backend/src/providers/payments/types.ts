/**
 * Payment provider contract (dev3 §4). Chapa is the only real implementation
 * today; the interface exists so a second processor is a new adapter rather
 * than a change to the billing module.
 */
export interface PaymentProvider {
  readonly name: string;

  initialize(input: {
    txRef: string;
    amount: string;
    currency: 'ETB';
    email: string;
    firstName: string;
    lastName: string;
    title: string;
    description: string;
    returnUrl: string;
    signal?: AbortSignal;
  }): Promise<{ checkoutUrl: string; providerRef?: string }>;

  verify(
    txRef: string,
    signal?: AbortSignal,
  ): Promise<{
    status: 'success' | 'pending' | 'failed';
    amount: string;
    currency: string;
    reference: string | null;
    raw: unknown;
  }>;
}

export type FakePaymentMode =
  'success' | 'pending' | 'fail' | 'timeout' | 'amount_mismatch' | 'currency_mismatch';

/** The extra surface the fake exposes so tests can drive it. */
export interface FakePaymentProvider extends PaymentProvider {
  setMode(mode: FakePaymentMode): void;
  setVerifyAmount(amount: string): void;
  getCallCount(): number;
  getInitializeCallCount(): number;
  getVerifyCallCount(): number;
  reset(): void;
}
