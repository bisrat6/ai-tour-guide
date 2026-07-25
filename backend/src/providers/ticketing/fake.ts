import type { TicketProvider } from './types.js';

export type FakeTicketMode = 'valid' | 'invalid' | 'timeout' | 'error';

/** In-memory ticket vendor for development and tests. */
export class FakeTicket implements TicketProvider {
  readonly name = 'fake-ticket';

  private mode: FakeTicketMode = 'valid';
  private callCount = 0;

  setMode(mode: FakeTicketMode): void {
    this.mode = mode;
  }

  getCallCount(): number {
    return this.callCount;
  }

  reset(): void {
    this.callCount = 0;
    this.mode = 'valid';
  }

  async validate(_input: Parameters<TicketProvider['validate']>[0]): Promise<{ valid: boolean }> {
    this.callCount += 1;

    if (this.mode === 'timeout') {
      await new Promise((_resolve, reject) => {
        setTimeout(() => reject(new Error('timeout')), 50);
      });
    }
    if (this.mode === 'error') {
      throw Object.assign(new Error('Fake vendor error'), { statusCode: 500 });
    }

    return { valid: this.mode === 'valid' };
  }
}

export const fakeTicket = new FakeTicket();
