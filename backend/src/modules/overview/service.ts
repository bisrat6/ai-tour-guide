import { env } from '../../config/env.js';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { appVersion } from '../../lib/version.js';
import { getBreakerSnapshots } from '../../providers/resilience.js';
import type { AdminContext } from '../../types/express.js';
import { TIER_LIMITS } from '../billing/tiers.js';
import { computeMuseumStats } from '../museums/service.js';
import type { AdapterHealth, RoomReadiness, SystemHealth, TenantOverview } from './schemas.js';

/** Same threshold museums/service.ts uses, so the two screens never disagree. */
const MIN_NARRATION_CHARS = 40;

export async function getTenantOverview(
  admin: AdminContext,
  requestedMuseumId?: string,
): Promise<TenantOverview> {
  const museumId = admin.role === 'SYSTEM_ADMIN' ? requestedMuseumId : admin.museumId;
  if (!museumId) {
    throw ApiError.validation([
      { path: 'museumId', message: 'museumId is required for SYSTEM_ADMIN.' },
    ]);
  }
  if (admin.role !== 'SYSTEM_ADMIN' && museumId !== admin.museumId) {
    throw ApiError.crossTenant();
  }

  const museum = await prisma.museum.findUnique({
    where: { id: museumId },
    select: { id: true, name: true, tier: true, subscriptionStatus: true },
  });
  if (!museum) throw ApiError.notFound('Museum not found.');

  const [stats, roomRows] = await Promise.all([
    computeMuseumStats(museumId),
    prisma.room.findMany({
      where: { museumId },
      orderBy: { storyOrder: 'asc' },
      select: {
        id: true,
        storyOrder: true,
        title: true,
        narrationScript: true,
        roomAudioUrl: true,
        nextRoomId: true,
        updatedAt: true,
        _count: { select: { items: true } },
      },
    }),
  ]);

  // Walk the nextRoomId chain once so each room can report whether the visitor
  // route actually reaches it. An orphaned room is the single most common
  // authoring mistake and is invisible from the rooms list alone.
  const nextById = new Map(roomRows.map((room) => [room.id, room.nextRoomId]));
  const reachable = new Set<string>();
  let cursor: string | null = roomRows[0]?.id ?? null;
  while (cursor !== null && !reachable.has(cursor)) {
    reachable.add(cursor);
    cursor = nextById.get(cursor) ?? null;
  }

  const rooms: RoomReadiness[] = roomRows.map((room) => {
    const narrationChars = room.narrationScript.trim().length;
    const readiness: RoomReadiness['readiness'] =
      narrationChars < MIN_NARRATION_CHARS
        ? 'empty'
        : room._count.items === 0
          ? 'incomplete'
          : 'ready';

    return {
      id: room.id,
      storyOrder: room.storyOrder,
      title: room.title,
      readiness,
      itemCount: room._count.items,
      narrationChars,
      hasAudio: room.roomAudioUrl !== null,
      inSequence: reachable.has(room.id),
      updatedAt: room.updatedAt.toISOString(),
    };
  });

  return {
    museumId: museum.id,
    museumName: museum.name,
    stats,
    rooms,
    tier: museum.tier,
    subscriptionStatus: museum.subscriptionStatus,
    limits: TIER_LIMITS[museum.tier],
  };
}

/**
 * Describes an adapter from configuration plus whatever the circuit breaker
 * has observed. There is no synthetic probe here on purpose: pinging a paid
 * vendor every time an operator opens a dashboard is a bill, not a feature.
 * An adapter nothing has called yet reports `unknown` rather than `healthy`.
 */
function describeAdapter(input: {
  id: string;
  label: string;
  provider: string;
  mode: AdapterHealth['mode'];
  timeoutMs: number | null;
  breakerPrefix: string;
  unconfiguredNote: string;
}): AdapterHealth {
  const snapshots = getBreakerSnapshots().filter((snapshot) =>
    snapshot.key.startsWith(`${input.breakerPrefix}:`),
  );

  const open = snapshots.find((snapshot) => snapshot.open);
  const failing = snapshots.reduce((worst, s) => Math.max(worst, s.consecutiveFailures), 0);

  let state: AdapterHealth['state'];
  let note: string;

  if (input.mode === 'unconfigured') {
    state = 'degraded';
    note = input.unconfiguredNote;
  } else if (open) {
    state = 'breaker_open';
    note = `Circuit breaker opened after ${open.consecutiveFailures} consecutive failures. Calls are refused until it half-opens.`;
  } else if (failing > 0) {
    state = 'retrying';
    note = `${failing} consecutive ${failing === 1 ? 'failure' : 'failures'} since the last success.`;
  } else if (snapshots.length === 0) {
    state = 'unknown';
    note = 'No call made since this process started, so there is nothing to report yet.';
  } else if (input.mode === 'fake') {
    state = 'degraded';
    note = 'Answered by the in-process fake. No real vendor is being called.';
  } else {
    state = 'healthy';
    note = 'Last call succeeded.';
  }

  return {
    id: input.id,
    label: input.label,
    provider: input.provider,
    mode: input.mode,
    state,
    consecutiveFailures: failing,
    breakerOpenedAt: open?.openedAt ?? null,
    timeoutMs: input.timeoutMs,
    note,
  };
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const start = performance.now();
  let dbLatencyMs: number;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Math.round(performance.now() - start);
  } catch {
    throw ApiError.upstreamUnavailable('Database is unreachable.');
  }

  const adapters: AdapterHealth[] = [
    describeAdapter({
      id: 'payments',
      label: 'Payments adapter',
      provider: env.PAYMENTS_PROVIDER === 'chapa' ? 'Chapa' : 'In-process fake',
      mode:
        env.PAYMENTS_PROVIDER === 'fake'
          ? 'fake'
          : env.CHAPA_SECRET_KEY
            ? 'live'
            : 'unconfigured',
      timeoutMs: env.CHAPA_TIMEOUT_MS,
      breakerPrefix: 'chapa',
      unconfiguredNote: 'PAYMENTS_PROVIDER is chapa but CHAPA_SECRET_KEY is unset.',
    }),
    describeAdapter({
      id: 'ticketing',
      label: 'Ticket validation adapter',
      provider: env.TICKETS_PROVIDER === 'http' ? 'Museum ticket vendor (HTTP)' : 'In-process fake',
      mode: env.TICKETS_PROVIDER === 'fake' ? 'fake' : 'live',
      timeoutMs: env.TICKET_VENDOR_TIMEOUT_MS,
      breakerPrefix: 'ticket-vendor',
      unconfiguredNote: 'No ticket vendor configured.',
    }),
    describeAdapter({
      id: 'llm',
      label: 'Language model adapter',
      provider: env.LLM_PROVIDER === 'openai' ? 'OpenAI' : 'AddisAI',
      mode: env.LLM_API_KEY ? 'live' : 'unconfigured',
      timeoutMs: env.LLM_TIMEOUT_MS,
      breakerPrefix: env.LLM_PROVIDER,
      unconfiguredNote: 'LLM_API_KEY is unset, so grounded chat cannot answer.',
    }),
    describeAdapter({
      id: 'tts',
      label: 'Speech synthesis adapter',
      provider: 'ElevenLabs',
      mode: env.ELEVENLABS_API_KEY ? 'live' : 'unconfigured',
      timeoutMs: env.TTS_TIMEOUT_MS,
      breakerPrefix: 'elevenlabs',
      unconfiguredNote: 'ELEVENLABS_API_KEY is unset, so narration cannot be synthesized.',
    }),
    describeAdapter({
      id: 'storage',
      label: 'Media storage adapter',
      provider: env.STORAGE_PROVIDER === 's3' ? 'S3-compatible bucket' : 'In-memory',
      mode:
        env.STORAGE_PROVIDER === 'memory'
          ? 'fake'
          : env.STORAGE_BUCKET
            ? 'live'
            : 'unconfigured',
      timeoutMs: null,
      breakerPrefix: 'storage',
      unconfiguredNote: 'STORAGE_PROVIDER is s3 but STORAGE_BUCKET is unset.',
    }),
  ];

  const degraded = adapters.some(
    (adapter) => adapter.state === 'breaker_open' || adapter.state === 'degraded',
  );

  return {
    status: degraded ? 'degraded' : 'ok',
    version: appVersion,
    environment: env.NODE_ENV,
    dbLatencyMs,
    uptimeSeconds: Math.round(process.uptime()),
    adapters,
    checkedAt: new Date().toISOString(),
  };
}
