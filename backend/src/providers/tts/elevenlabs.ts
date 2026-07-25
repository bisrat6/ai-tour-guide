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
  readonly model = env.ELEVENLABS_MODEL;

  async synthesize(input: TtsSynthesizeInput): Promise<TtsSynthesizeOutput> {
    if (!env.ELEVENLABS_API_KEY) {
      return { stream: fakeAudioStream(input.text), contentType: 'audio/mpeg' };
    }

    return resilientCall({ providerName: 'elevenlabs-tts', timeoutMs: env.TTS_TIMEOUT_MS }, async (signal) => {
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${input.voiceId}/stream`,
        {
          text: input.text,
          model_id: this.model,
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
    });
  }
}

/** Deterministic offline fallback — no key configured (local dev / tests). */
function fakeAudioStream(text: string): Readable {
  const marker = Buffer.from(`FAKE_MP3:${text.slice(0, 40)}`, 'utf8');
  return Readable.from([marker]);
}
