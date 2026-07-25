export interface PaymentProvider {
  readonly name: string;

  initialize(input: {
    txRef: string;
    amount: string;         // two-decimal string, e.g. "4500.00"
    currency: 'ETB';
    email: string;
    firstName: string;
    lastName: string;
    title: string;          // <= 16 chars — Chapa enforces this
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

// ── Fake provider used in tests ───────────────────────────────────────────────
export type FakePaymentMode = 'success' | 'pending' | 'fail' | 'timeout' | 'amount_mismatch' | 'currency_mismatch';

export interface FakePaymentProvider extends PaymentProvider {
  setMode(mode: FakePaymentMode): void;
  getCallCount(): number;
  getInitializeCallCount(): number;
  getVerifyCallCount(): number;
  reset(): void;
  setVerifyAmount(amount: string): void;
}
