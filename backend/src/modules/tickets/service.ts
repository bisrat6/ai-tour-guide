import { createHash } from 'node:crypto';
import { ApiError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { UpstreamUnavailableError } from '../../providers/resilience.js';
import { getTicketProvider } from '../../providers/ticketing/index.js';
import { museumScopeFor } from '../../shared/museumScope.js';

/**
 * Checks a visitor's ticket against the museum's own vendor endpoint (dev3 §6).
 *
 * This never fails open: if the vendor is unreachable the caller gets a 502
 * rather than a free pass, because the alternative is that any vendor outage
 * becomes free admission.
 */
export type TicketTarget = { museumId: string } | { waypointId: string };

/**
 * The visitor app only ever holds a scanned room id, so the museum has to be
 * reached through the room. Returns null for anything unresolvable, leaving the
 * single not-found path below to decide what a visitor is told.
 */
async function resolveMuseum(target: TicketTarget) {
  if ('museumId' in target) {
    return prisma.museum.findUnique({ where: { id: target.museumId } });
  }

  const room = await prisma.room.findUnique({
    where: { id: target.waypointId },
    select: { museum: true },
  });
  return room?.museum ?? null;
}

export async function validateTicket(
  target: TicketTarget,
  ticketCode: string,
  requestId?: string,
): Promise<{ valid: boolean; ticketRequired: boolean; museumScope: string }> {
  const museum = await resolveMuseum(target);

  // A suspended museum is indistinguishable from a missing one to a visitor.
  if (!museum || museum.status === 'SUSPENDED') {
    throw ApiError.notFound('Museum not found.');
  }

  const museumId = museum.id;
  const museumScope = museumScopeFor(museumId);

  if (!museum.ticketValidationUrl) {
    return { valid: true, ticketRequired: false, museumScope };
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
    return { valid: result.valid, ticketRequired: true, museumScope };
  } catch (err) {
    if (err instanceof UpstreamUnavailableError) {
      throw ApiError.upstreamUnavailable('The ticket vendor is temporarily unavailable.');
    }
    if (err instanceof ApiError) throw err;

    logger.error({ requestId, museumId, err }, 'Ticket vendor call failed');
    throw ApiError.upstreamFailure('Ticket validation service failed.');
  }
}
