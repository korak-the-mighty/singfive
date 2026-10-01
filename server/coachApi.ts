// Optional AI coach endpoint, served by Vite's own server (dev and preview).
//
// Privacy: the browser sends only the coach's draft sentences and the numbers
// behind them. Audio never leaves the device. If ANTHROPIC_API_KEY is not set,
// /api/coach/status reports ai:false and the app uses its local coach only.

import Anthropic from '@anthropic-ai/sdk';
import { betaJSONSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/beta/json-schema';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

export interface RewriteRequest {
  task: 'take' | 'profile';
  song?: { title: string; feel: string };
  /** Plain numbers and facts behind the draft. */
  evidence: Record<string, unknown>;
  draft: { headline: string; items: { id: string; text: string; evidence: 'heard' | 'think' | 'unsure' }[] };
}

export interface RewriteResponse {
  headline: string;
  items: { id: string; text: string }[];
}

const SYSTEM = `You are the coach inside FIVE, an app where someone becomes a singer through five songs they chose.

You receive a draft written by FIVE's measurement engine, plus the numbers behind it. Rewrite the draft so it sounds like a perceptive, warm, direct singing teacher who listened closely.

Rules:
- Keep every item's meaning and its certainty. Items marked "heard" are measured facts. Items marked "think" are interpretations; keep them sounding like interpretations ("that usually means…"). Items marked "unsure" say what we don't know yet; keep them uncertain.
- Never add a fact, number or claim that is not in the draft or the evidence. Never praise what the evidence doesn't support. If something is weak, say so kindly and plainly.
- Plain words. Short sentences. No jargon: avoid "cents", "pitch accuracy", "tessitura", "intonation", "register". Refer to songs by title and to moments by their words.
- Each item stays one or two sentences. The headline is one sentence.
- Connect items to each other and across songs where the evidence allows; that is where you add value.
- Return the same item ids you were given, in the same order.`;

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, text: { type: 'string' } },
        required: ['id', 'text'],
        additionalProperties: false,
      },
    },
  },
  required: ['headline', 'items'],
  additionalProperties: false,
} as const;

function readBody(req: IncomingMessage, limit = 64_000): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

function isRewriteRequest(x: unknown): x is RewriteRequest {
  const r = x as RewriteRequest;
  return (
    !!r &&
    (r.task === 'take' || r.task === 'profile') &&
    typeof r.draft?.headline === 'string' &&
    Array.isArray(r.draft.items) &&
    r.draft.items.length <= 40 &&
    r.draft.items.every((i) => typeof i.id === 'string' && typeof i.text === 'string')
  );
}

export async function rewrite(client: Anthropic, model: string, body: RewriteRequest): Promise<RewriteResponse> {
  const response = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: betaJSONSchemaOutputFormat(OUTPUT_SCHEMA) },
    system: SYSTEM,
    messages: [{ role: 'user', content: JSON.stringify(body) }],
  });
  if (response.stop_reason === 'refusal') throw new Error('refused');
  const out = response.parsed_output;
  if (!out) throw new Error('no output');
  // Only accept rewrites of items we sent; keep the draft for anything missing.
  const allowed = new Map(body.draft.items.map((i) => [i.id, i.text]));
  const items = body.draft.items.map((i) => {
    const r = out.items.find((x) => x.id === i.id);
    const text = r?.text?.trim();
    return { id: i.id, text: text && text.length <= 500 ? text : allowed.get(i.id)! };
  });
  const headline = out.headline.trim() && out.headline.length <= 300 ? out.headline.trim() : body.draft.headline;
  return { headline, items };
}

export function coachApi(env: Record<string, string | undefined> = process.env): Plugin {
  const key = env.ANTHROPIC_API_KEY;
  const model = env.FIVE_COACH_MODEL || 'claude-opus-5-5';
  const client = key ? new Anthropic({ apiKey: key, timeout: 60_000, maxRetries: 1 }) : null;

  const handler = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url ?? '';
    if (!url.startsWith('/api/coach')) return next();
    if (url.startsWith('/api/coach/status')) return send(res, 200, { ai: !!client, model: client ? model : null });
    if (url.startsWith('/api/coach/rewrite') && req.method === 'POST') {
      if (!client) return send(res, 503, { error: 'No AI coach configured (ANTHROPIC_API_KEY is not set).' });
      let body: unknown;
      try {
        body = JSON.parse(await readBody(req));
      } catch {
        return send(res, 400, { error: 'Bad request body.' });
      }
      if (!isRewriteRequest(body)) return send(res, 400, { error: 'Unexpected request shape.' });
      try {
        return send(res, 200, await rewrite(client, model, body));
      } catch (err) {
        if (err instanceof Anthropic.AuthenticationError) return send(res, 502, { error: 'The AI coach key was rejected.' });
        if (err instanceof Anthropic.RateLimitError) return send(res, 429, { error: 'The AI coach is busy. Try again in a moment.' });
        if (err instanceof Anthropic.APIError) return send(res, 502, { error: `AI coach error (${err.status ?? 'network'}).` });
        return send(res, 502, { error: 'The AI coach could not answer.' });
      }
    }
    return send(res, 404, { error: 'Not found' });
  };

  return {
    name: 'five-coach-api',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}
