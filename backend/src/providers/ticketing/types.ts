/**
 * Ticket vendor contract (dev3 §6). Each museum points at its own vendor
 * endpoint, so the "provider" here is a transport, not a specific vendor.
 */
export interface TicketProvider {
  readonly name: string;

  validate(input: {
    endpointUrl: string;
    ticketCode: string;
    secret?: string;
    signal?: AbortSignal;
  }): Promise<{ valid: boolean }>;
}
