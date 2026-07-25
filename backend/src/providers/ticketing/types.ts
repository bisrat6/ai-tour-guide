export interface TicketProvider {
  readonly name: string;
  validate(input: {
    endpointUrl: string;
    ticketCode: string;
    secret?: string;
    signal?: AbortSignal;
  }): Promise<{ valid: boolean }>;
}
