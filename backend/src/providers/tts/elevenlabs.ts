import { Readable } from 'node:stream';
import { env } from '../../config/env.js';
import { providerCall, UpstreamFailureError } from '../resilience.js';
import type { TtsProvider, TtsSynthesizeInput, TtsSynthesizeOutput } from './types.js';

/**
 * Default TtsProvider (dev2 §12.2). Uses eleven_flash_v2_5 specifically — the
 * low-latency model, which is what a live chat answer needs. Streaming matters
 * on the live path; room narration is pre-generated offline where it does not.
 *
 * Ported from dev2's branch with axios replaced by fetch. The response body
 * arrives as a web ReadableStream and is adapted to a Node Readable, because
 * that is what the narrate module tees to the client and the cache.
 */

const MAX_ERROR_BODY_CHARS = 500;

export class ElevenLabsTtsProvider implements TtsProvider {
  readonly name = 'elevenlabs';

  /**
   * Cache identity rather than the wire model id. The offline fallback reports a
   * distinct value so its placeholder bytes cannot occupy the cache slot real
   * synthesis would use — otherwise audio generated before a key was configured
   * keeps being served afterwards, with nothing to indicate the key is unused.
   */
  readonly model = env.ELEVENLABS_API_KEY
    ? env.ELEVENLABS_MODEL
    : `${env.ELEVENLABS_MODEL}-offline-placeholder`;

  async synthesize(input: TtsSynthesizeInput): Promise<TtsSynthesizeOutput> {
    // config/env.ts refuses to boot production without a key, so this fallback
    // only ever runs in development and tests.
    const apiKey = env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return { stream: fakeAudioStream(input.text), contentType: 'audio/mpeg' };
    }

    return providerCall({
      name: 'elevenlabs-tts',
      operation: 'synthesize',
      timeoutMs: env.TTS_TIMEOUT_MS,
      fn: async (signal) => {
        const res = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(input.voiceId)}/stream`,
          {
            method: 'POST',
            headers: {
              'xi-api-key': apiKey,
              'Content-Type': 'application/json',
              Accept: 'audio/mpeg',
            },
            body: JSON.stringify({
              text: input.text,
              model_id: env.ELEVENLABS_MODEL,
              voice_settings: { stability: 0.5, similarity_boost: 0.75 },
            }),
            signal,
          },
        );

        if (!res.ok) {
          // On the success path the body is audio, but a refusal explains itself
          // in text — an exhausted quota, an unavailable voice. Reading it here
          // is what makes the failure diagnosable from the logs.
          const body = await res.text().catch(() => '');
          throw new UpstreamFailureError(
            `ElevenLabs returned ${res.status}: ${body.slice(0, MAX_ERROR_BODY_CHARS)}`,
            res.status,
          );
        }

        if (!res.body) {
          throw new UpstreamFailureError('ElevenLabs returned no audio body');
        }

        return {
          stream: Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]),
          contentType: 'audio/mpeg',
        };
      },
    });
  }
}

/** Deterministic offline fallback — no key configured (local development, tests). */
function fakeAudioStream(text: string): Readable {
  const marker = Buffer.from(`FAKE_MP3:${text.slice(0, 40)}`, 'utf8');
  return Readable.from([marker]);
}
