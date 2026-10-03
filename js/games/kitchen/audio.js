// Kitchen Quest v0.6.0 procedural foley, ported from the user-supplied source
// (src/audio/synth.ts). Original sounds, no recordings; one bounded voice pool.
// Summer Quest addition: `isMuted` is the app's shared sound switch.
import { seeded } from './motion.js';

const WET = new Set(['tomato', 'pickles', 'sauce']);
const DURATIONS = { patty: .115, cheese: .14, tomato: .13, lettuce: .09, pickles: .095, sauce: .175, press: .027, undo: .09, clear: .12, cap: .12, soft: .085, celebrate: .31, bell: .44, chop: .06, sizzle: .22, flip: .1 };
const FOOD = ['patty', 'cheese', 'tomato', 'lettuce', 'pickles', 'sauce'];
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** Deterministic original foley; keys have a finite bank. */
export function synthesize(key, sampleRate) {
  const [material, variantText] = key.split(':'); const variant = Number(variantText) || 0;
  const duration = DURATIONS[material] || .1;
  const data = new Float32Array(Math.ceil(sampleRate * duration));
  const random = seeded(key.split('').reduce((n, c) => Math.imul(n, 31) + c.charCodeAt(0), 71));
  let phase = 0, low = 0, low2 = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate, u = t / duration, noise = random() * 2 - 1;
    low += .16 * (noise - low); low2 += .035 * (noise - low2);
    const attack = Math.min(1, t / .0025), end = Math.min(1, (1 - u) * 18);
    let sample = 0;
    if (WET.has(material)) {
      const base = material === 'sauce' ? 310 : material === 'tomato' ? 430 : 650;
      const frequency = 75 + (base + variant * 19) * Math.exp(-t * (material === 'sauce' ? 30 : 48));
      phase += Math.PI * 2 * frequency / sampleRate;
      const body = Math.sin(phase) * Math.exp(-u * 5) * (material === 'pickles' ? .47 : .65);
      const splash = (low - low2) * 3.1 * Math.exp(-u * 7) * (material === 'sauce' ? 1.3 : .75);
      const bubble = Math.sin(phase * 1.43) * Math.exp(-Math.pow((t - .024) / .018, 2)) * .18;
      sample = (body + splash + bubble) * attack * end;
    } else if (material === 'patty' || material === 'cap') {
      phase += Math.PI * 2 * (65 + 105 * Math.exp(-t * 60)) / sampleRate;
      sample = (Math.sin(phase) * .73 + low * 1.4) * Math.exp(-u * 6) * attack * end;
    } else if (material === 'cheese') {
      phase += Math.PI * 2 * (130 + 180 * Math.exp(-t * 36) + 32 * Math.sin(t * 120)) / sampleRate;
      sample = (Math.sin(phase) * .42 + (low - low2) * 2.3 * (.65 + .35 * Math.sin(t * 190))) * Math.exp(-u * 5.6) * attack * end;
    } else if (material === 'lettuce') {
      sample = ((noise - low) * .48 + low * .5) * Math.exp(-u * 6) * (.65 + .35 * Math.sin(t * 570)) * attack * end;
    } else if (material === 'chop') {
      // Summer Quest: a short woody knock for the chopping board.
      phase += Math.PI * 2 * (220 + 260 * Math.exp(-t * 90)) / sampleRate;
      sample = (Math.sin(phase) * .55 + (noise - low) * .5) * Math.exp(-u * 9) * attack * end;
    } else if (material === 'sizzle') {
      sample = (noise - low) * .42 * Math.exp(-u * 3) * (.5 + .5 * Math.sin(t * 900)) * attack * end;
    } else if (material === 'bell') {
      for (const [start, hz, weight] of [[0, 1174.66, .54], [.075, 1567.98, .30]]) {
        const a = t - start; if (a >= 0) sample += (Math.sin(a * Math.PI * 2 * hz) + .22 * Math.sin(a * Math.PI * 2 * hz * 2.76) + .09 * Math.sin(a * Math.PI * 2 * hz * 4.07)) * Math.exp(-a * 13) * Math.min(1, a / .002) * weight;
      }
      sample *= end;
    } else if (material === 'celebrate') {
      for (const [start, hz, gain] of [[0, 659.25, .36], [.055, 880, .27], [.105, 1318.5, .22]]) {
        const a = t - start; if (a >= 0) sample += (Math.sin(a * Math.PI * 2 * hz) + .2 * Math.sin(a * Math.PI * 2 * hz * 2)) * Math.exp(-a * 22) * Math.min(1, a / .003) * gain;
      }
      sample *= end;
    } else {
      const hz = material === 'undo' ? 180 + u * 650 : material === 'soft' ? 240 - u * 50 : material === 'clear' ? 160 + u * 170 : material === 'flip' ? 300 + u * 500 : 500 - u * 220;
      phase += Math.PI * 2 * hz / sampleRate;
      sample = (Math.sin(phase) * .48 + low * (material === 'clear' ? 2 : .55)) * Math.exp(-u * 6) * attack * end;
    }
    data[i] = Math.tanh(sample * 1.12) * .82;
  }
  return data;
}

/** Gesture-started, bounded voices. Audio failure never rejects a food command. */
export class KitchenAudio {
  constructor(isMuted) {
    this.isMuted = isMuted || (() => false);
    this.buffers = new Map(); this.voices = new Map(); this.variants = {};
    this.lastPress = 0; this.volume = .6;
  }
  unlock() {
    try {
      if (!this.context) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.context = new AC(); this.master = this.context.createGain(); this.master.gain.value = this.volume * .56;
        const compressor = this.context.createDynamicsCompressor();
        compressor.threshold.value = -15; compressor.knee.value = 14; compressor.ratio.value = 6; compressor.attack.value = .002; compressor.release.value = .08;
        const headroom = this.context.createGain(); headroom.gain.value = .68;
        this.master.connect(compressor); compressor.connect(headroom); headroom.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    } catch (e) { /* No audio on this device; food still works. */ }
  }
  get state() { return this.context ? this.context.state : 'not-started'; }
  press() { const now = performance.now(); if (now - this.lastPress < 28) return; this.lastPress = now; this.play('press', .13, 0); }
  impact(id) {
    if (id === 'lasagna') id = 'patty';
    if (!FOOD.includes(id)) id = 'soft';
    const variant = this.variants[id] || 0; this.variants[id] = (variant + 1) % (WET.has(id) ? 3 : 1);
    this.play(id + ':' + variant, .82, 3);
  }
  undo() { this.play('undo', .42, 2); }
  clear() { this.play('clear', .3, 2); }
  cap() { this.play('cap', .55, 2); }
  error() { this.play('soft', .25, 1); }
  bell() { this.play('bell', .48, 1); }
  celebrate() { this.play('celebrate', .6, 1); }
  chop() { this.play('chop', .5, 2); }
  sizzle() { this.play('sizzle', .22, 0); }
  flip() { this.play('flip', .35, 2); }
  /** Summer Quest: one "bla" syllable of a customer's chatter, in that customer's voice. */
  blip(hz, wave = 'triangle') {
    const ctx = this.context;
    if (!ctx || !this.master || ctx.state !== 'running' || this.isMuted() || this.voices.size >= 12) return;
    try {
      const osc = ctx.createOscillator(), node = ctx.createGain(), t = ctx.currentTime;
      const pitch = hz * (.86 + Math.random() * .32), length = .055 + Math.random() * .03;
      osc.type = wave; osc.frequency.setValueAtTime(pitch, t); osc.frequency.exponentialRampToValueAtTime(pitch * (Math.random() < .5 ? .8 : 1.18), t + length);
      node.gain.setValueAtTime(0, t); node.gain.linearRampToValueAtTime(wave === 'square' ? .07 : .16, t + .006); node.gain.exponentialRampToValueAtTime(.001, t + length);
      osc.connect(node); node.connect(this.master);
      const cleanup = () => { this.voices.delete(osc); osc.disconnect(); node.disconnect(); };
      this.voices.set(osc, { priority: 0, cleanup }); osc.onended = cleanup;
      osc.start(t); osc.stop(t + length + .01);
    } catch (e) { /* Chatter is decoration; never let it break the kitchen. */ }
  }
  stop() { for (const [source, voice] of [...this.voices]) { try { source.stop(); } catch (e) { /* Already stopped. */ } voice.cleanup(); } }
  close() { this.stop(); if (this.context && this.context.close) this.context.close().catch(() => {}); this.context = null; }
  buffer(key) {
    let buffer = this.buffers.get(key);
    if (!buffer) {
      const samples = synthesize(key, this.context.sampleRate);
      buffer = this.context.createBuffer(1, samples.length, this.context.sampleRate); buffer.getChannelData(0).set(samples);
      this.buffers.set(key, buffer);
    }
    return buffer;
  }
  play(key, gain, priority) {
    const ctx = this.context;
    if (!ctx || !this.master || ctx.state !== 'running' || this.isMuted()) return;
    if (this.voices.size >= 12) {
      const victim = [...this.voices.entries()].sort((a, b) => a[1].priority - b[1].priority)[0];
      if (victim[1].priority > priority) return;
      try { victim[0].stop(); } catch (e) { /* Already stopped. */ } victim[1].cleanup();
    }
    try {
      const source = ctx.createBufferSource(), node = ctx.createGain(); source.buffer = this.buffer(key); node.gain.value = clamp(gain, 0, 1);
      source.connect(node); node.connect(this.master);
      const cleanup = () => { this.voices.delete(source); source.disconnect(); node.disconnect(); };
      this.voices.set(source, { priority, cleanup }); source.onended = cleanup;
      source.start();
    } catch (e) { /* Audio failure never rejects a food command. */ }
  }
}
