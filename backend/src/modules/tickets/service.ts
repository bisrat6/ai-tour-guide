import { createHash } from 'node:crypto';
import { ApiError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { UpstreamUnavailableError } from '../../providers/resilience.js';
import { getTicketProvider } from '../../providers/ticketing/index.js';

/**
 * Checks a visitor's ticket against the museum's own vendor endpoint (dev3 §6).
 *
 * This never fails open: if the vendor is unreachable the caller gets a 502
 * rather than a free pass, because the alternative is that any vendor outage
 * becomes free admission.
 */
export async function validateTicket(
  museumId: string,
  ticketCode: string,
  requestId?: string,
): Promise<{ valid: boolean; ticketRequired: boolean }> {
  const museum = await prisma.museum.findUnique({ where: { id: museumId } });

  // A suspended museum is indistinguishable from a missing one to a visitor.
  if (!museum || museum.status === 'SUSPENDED') {
    throw ApiError.notFound('Museum not found.');
  }

  if (!museum.ticketValidationUrl) {
    return { valid: true, ticketRequired: false };
  }

  // Hashed, never logged in the clear: a ticket code can carry a booking
  // reference and the holder's personal details.
  const codeHash = createHash('sha256').update(ticketCode).digest('hex').slice(0, 12);
  logger.info({ requestId, museumId, codeHash }, 'Validating ticket');

  try {
    const result = await getTicketProvider().validate({
      endpointUrl: museum.ticketValidationUrl,
      ticketCode,
    });

    logger.info({ requestId, museumId, codeHash, valid: result.valid }, 'Ticket validation result');
    return { valid: result.valid, ticketRequired: true };
  } catch (err) {
    if (err instanceof UpstreamUnavailableError) {
      throw ApiError.upstreamUnavailable('The ticket vendor is temporarily unavailable.');
    }
    if (err instanceof ApiError) throw err;

    logger.error({ requestId, museumId, err }, 'Ticket vendor call failed');
    throw ApiError.upstreamFailure('Ticket validation service failed.');
  }
}
