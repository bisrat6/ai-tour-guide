import axios from 'axios';
import { Readable } from 'stream';
import { env } from '../../config/env';
import { resilientCall } from '../../lib/resilientCall';
import { TtsProvider, TtsSynthesizeInput, TtsSynthesizeOutput } from './types';

/**
 * Default TtsProvider (§12.2). Uses eleven_flash_v2_5 specifically — the
 * model built for low latency, which is what a live chat answer needs.
 * Streaming is required on the live path; full-file generation is fine for
 * offline room narration since that is never on a user-facing request.
 */
export class ElevenLabsTtsProvider implements TtsProvider {
  readonly name = 'elevenlabs';

  /**
   * Cache identity, not the wire model id: it is mixed into every audio content
   * hash and recorded on each cached AudioAsset. The offline fallback reports a
   * distinct value so its placeholder bytes cannot occupy the cache slot real
   * synthesis would use — otherwise audio generated before a key was configured
   * keeps being served afterwards, with nothing to indicate the key is unused.
   */
  readonly model = env.ELEVENLABS_API_KEY
    ? env.ELEVENLABS_MODEL
    : `${env.ELEVENLABS_MODEL}-offline-placeholder`;

  async synthesize(input: TtsSynthesizeInput): Promise<TtsSynthesizeOutput> {
    if (!env.ELEVENLABS_API_KEY) {
      return { stream: fakeAudioStream(input.text), contentType: 'audio/mpeg' };
    }

    return resilientCall({ providerName: 'elevenlabs-tts', timeoutMs: env.TTS_TIMEOUT_MS }, async (signal) => {
      try {
        return await requestAudioStream(input, signal);
      } catch (err) {
        await drainStreamedErrorBody(err);
        throw err;
      }
    });
  }
}

async function requestAudioStream(input: TtsSynthesizeInput, signal: AbortSignal): Promise<TtsSynthesizeOutput> {
  const response = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${input.voiceId}/stream`,
    {
      text: input.text,
      model_id: env.ELEVENLABS_MODEL,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    },
    {
      headers: {
        'xi-api-key': env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      responseType: 'stream',
      signal,
    }
  );

  return { stream: response.data as Readable, contentType: 'audio/mpeg' };
}

/**
 * Because audio is requested as a stream, a rejection arrives with its
 * explanation (an exhausted key quota, an unavailable voice) as an unread
 * stream that the shared error logging cannot inspect — leaving a bare status
 * code as the only clue. Reading it into place puts the vendor's own reason in
 * the logs.
 */
async function drainStreamedErrorBody(err: unknown): Promise<void> {
  const response = (err as { response?: { data?: unknown } })?.response;
  if (!response || !(response.data instanceof Readable)) return;

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of response.data) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    response.data = Buffer.concat(chunks).toString('utf8');
  } catch {
    // Unreadable body — the status code will have to stand on its own.
  }
}

/** Deterministic offline fallback — no key configured (local dev / tests). */
function fakeAudioStream(text: string): Readable {
  const marker = Buffer.from(`FAKE_MP3:${text.slice(0, 40)}`, 'utf8');
  return Readable.from([marker]);
}
