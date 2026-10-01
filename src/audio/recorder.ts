// Microphone capture. Raw samples are captured in an AudioWorklet so the
// analysis sees exactly what the microphone heard (no codec, no processing).

const WORKLET = `
class FiveCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.rec = false;
    this.buf = new Float32Array(4096);
    this.n = 0;
    this.blocks = 0;
    this.port.onmessage = (e) => {
      if (e.data === 'start') { this.rec = true; this.sent = false; this.n = 0; }
      if (e.data === 'stop') { this.flush(); this.rec = false; this.port.postMessage({ type: 'stopped' }); }
    };
  }
  flush() {
    if (this.n > 0) { this.port.postMessage({ type: 'data', data: this.buf.slice(0, this.n) }); this.n = 0; }
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    let s = 0;
    for (let i = 0; i < ch.length; i++) s += ch[i] * ch[i];
    if ((this.blocks++ & 3) === 0) this.port.postMessage({ type: 'level', level: Math.sqrt(s / ch.length) });
    if (this.rec) {
      if (!this.sent) { this.sent = true; this.port.postMessage({ type: 'start', time: currentTime }); }
      for (let i = 0; i < ch.length; i++) {
        this.buf[this.n++] = ch[i];
        if (this.n === this.buf.length) { this.port.postMessage({ type: 'data', data: this.buf.slice(0) }); this.n = 0; }
      }
    }
    return true;
  }
}
registerProcessor('five-capture', FiveCapture);
`;

export type MicError = 'denied' | 'no-device' | 'unsupported' | 'other';

export class MicUnavailable extends Error {
  constructor(public kind: MicError, message: string) {
    super(message);
  }
}

export class Recorder {
  private chunks: Float32Array[] = [];
  private stopResolve: (() => void) | null = null;
  level = 0;
  startedAt = 0;
  onLevel: ((l: number) => void) | null = null;

  private constructor(
    public ctx: AudioContext,
    private stream: MediaStream,
    private node: AudioWorkletNode,
  ) {
    node.port.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'level') {
        this.level = m.level;
        this.onLevel?.(m.level);
      } else if (m.type === 'data') this.chunks.push(m.data);
      else if (m.type === 'start') this.startedAt = m.time;
      else if (m.type === 'stopped') this.stopResolve?.();
    };
  }

  get sampleRate() {
    return this.ctx.sampleRate;
  }

  static async open(): Promise<Recorder> {
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioWorkletNode === 'undefined') {
      throw new MicUnavailable('unsupported', 'This browser can’t record audio here. Try a recent Chrome, Edge, Firefox or Safari.');
    }
    let stream: MediaStream;
    try {
      // Processing meant for calls distorts singing: keep the raw voice.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
      });
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError')
        throw new MicUnavailable('denied', 'FIVE needs your microphone to hear you sing. Allow it in your browser’s address bar, then try again.');
      if (name === 'NotFoundError' || name === 'OverconstrainedError')
        throw new MicUnavailable('no-device', 'We couldn’t find a microphone. Plug one in or check your sound settings.');
      throw new MicUnavailable('other', 'The microphone couldn’t start. Close other apps using it and try again.');
    }
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
    try {
      await ctx.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }
    const src = ctx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(ctx, 'five-capture', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit' });
    const mute = ctx.createGain();
    mute.gain.value = 0;
    src.connect(node).connect(mute).connect(ctx.destination);
    if (ctx.state === 'suspended') await ctx.resume();
    return new Recorder(ctx, stream, node);
  }

  start() {
    this.chunks = [];
    this.startedAt = this.ctx.currentTime;
    this.node.port.postMessage('start');
  }

  async stop(): Promise<Float32Array> {
    await new Promise<void>((resolve) => {
      this.stopResolve = resolve;
      this.node.port.postMessage('stop');
      setTimeout(resolve, 500);
    });
    const len = this.chunks.reduce((s, c) => s + c.length, 0);
    const out = new Float32Array(len);
    let o = 0;
    for (const c of this.chunks) {
      out.set(c, o);
      o += c.length;
    }
    this.chunks = [];
    return out;
  }

  close() {
    this.stream.getTracks().forEach((t) => t.stop());
    this.ctx.close().catch(() => {});
  }
}
