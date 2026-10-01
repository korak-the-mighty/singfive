import { describe, expect, it } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { rewrite, type RewriteRequest } from '../../server/coachApi';

const body: RewriteRequest = {
  task: 'take',
  song: { title: 'Amazing Grace', feel: 'Slow and exposed.' },
  evidence: { meanOffCents: 12 },
  draft: {
    headline: 'You were in tune nearly all the way through.',
    items: [
      { id: '0', text: 'The long note on “me” wavered.', evidence: 'heard' },
      { id: '1', text: 'One take isn’t a pattern yet.', evidence: 'unsure' },
    ],
  },
};

function fakeClient(parsed: unknown, stop = 'end_turn') {
  const calls: unknown[] = [];
  const client = { beta: { messages: { parse: async (p: unknown) => (calls.push(p), { stop_reason: stop, parsed_output: parsed }) } } };
  return { client: client as unknown as Anthropic, calls };
}

describe('AI coach rewrite', () => {
  it('keeps exactly the draft’s items, in order, and never invents new ones', async () => {
    const { client, calls } = fakeClient({
      headline: 'Nearly every note landed.',
      items: [
        { id: '1', text: 'We’ve only heard this once.' },
        { id: '0', text: 'The last note, on “me”, wobbled.' },
        { id: '99', text: 'You are a natural tenor!' },
      ],
    });
    const out = await rewrite(client, 'claude-opus-5-5', body);
    expect(out.headline).toBe('Nearly every note landed.');
    expect(out.items.map((i) => i.id)).toEqual(['0', '1']);
    expect(out.items[0].text).toContain('wobbled');
    expect(JSON.stringify(out)).not.toContain('tenor');
    const req = calls[0] as { model: string; messages: { content: string }[] };
    expect(req.model).toBe('claude-opus-5-5');
    // Only text and numbers go out; no audio.
    expect(req.messages[0].content).not.toMatch(/\baudio\b|\.wav\b|blob:|data:audio/i);
  });

  it('falls back to the draft when an item is missing or too long', async () => {
    const { client } = fakeClient({ headline: '', items: [{ id: '0', text: 'x'.repeat(900) }] });
    const out = await rewrite(client, 'claude-opus-5-5', body);
    expect(out.headline).toBe(body.draft.headline);
    expect(out.items[0].text).toBe(body.draft.items[0].text);
    expect(out.items[1].text).toBe(body.draft.items[1].text);
  });

  it('treats a refusal as a failure, so the local coach is used', async () => {
    const { client } = fakeClient(null, 'refusal');
    await expect(rewrite(client, 'claude-opus-5-5', body)).rejects.toThrow();
  });
});
