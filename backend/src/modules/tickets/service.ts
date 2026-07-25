import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { getTicketProvider } from '../../providers/ticketing/index.js';
import { UpstreamUnavailableError } from '../../providers/resilience.js';
import { logger } from '../../lib/logger.js';
import { createHash } from 'crypto';

export async function validateTicket(
  museumId: string,
  ticketCode: string,
  requestId?: string,
): Promise<{ valid: boolean; ticketRequired: boolean }> {
  const museum = await prisma.museum.findUnique({ where: { id: museumId } });

  if (!museum || museum.status === 'SUSPENDED') {
    throw ApiError.notFound('Museum');
  }

  // Fast path: no ticket gate configured for this museum
  if (!museum.ticketValidationUrl) {
    return { valid: true, ticketRequired: false };
  }

  // Log code as a hash, never plain text — it can contain booking reference / PII
  const codeHash = createHash('sha256').update(ticketCode).digest('hex').slice(0, 12);
  logger.info({ requestId, museumId, codeHash }, 'Validating ticket');

  const provider = getTicketProvider();

  try {
    const result = await provider.validate({
      endpointUrl: museum.ticketValidationUrl,
      ticketCode,
    });

    logger.info({ requestId, museumId, codeHash, valid: result.valid }, 'Ticket validation result');
    return { valid: result.valid, ticketRequired: true };
  } catch (err) {
    if (err instanceof UpstreamUnavailableError) {
      throw ApiError.upstreamUnavailable('ticket vendor');
    }
    // Never fail open — upstream failure is a hard 502, not valid: true
    logger.error({ requestId, museumId, err }, 'Ticket vendor call failed');
    throw ApiError.upstreamFailure('Ticket validation service failed');
  }
}
