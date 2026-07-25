import type { TicketProvider } from './types.js';

export type FakeTicketMode = 'valid' | 'invalid' | 'timeout' | 'error';

export class FakeTicket implements TicketProvider {
  readonly name = 'fake-ticket';
  private mode: FakeTicketMode = 'valid';
  private callCount = 0;

  setMode(mode: FakeTicketMode) { this.mode = mode; }
  getCallCount() { return this.callCount; }
  reset() { this.callCount = 0; this.mode = 'valid'; }

  async validate(_input: Parameters<TicketProvider['validate']>[0]) {
    this.callCount++;
    if (this.mode === 'timeout') {
      await new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 50));
    }
    if (this.mode === 'error') {
      throw Object.assign(new Error('Fake vendor error'), { statusCode: 500 });
    }
    return { valid: this.mode === 'valid' };
  }
}

export const fakeTicket = new FakeTicket();
