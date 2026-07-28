/* Generate 12 synthesized drum one-shots as 16-bit 44.1kHz mono WAV.
   Run once: node scripts/synth-drums.mjs
   Outputs to assets/audio/mpc/ */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

var __dirname = dirname(fileURLToPath(import.meta.url));
var outDir = resolve(__dirname, "..", "assets", "audio", "mpc");
mkdirSync(outDir, { recursive: true });

var SR = 44100;

function writeWav(filename, samples) {
  var numChannels = 1;
  var bitsPerSample = 16;
  var byteRate = SR * numChannels * bitsPerSample / 8;
  var blockAlign = numChannels * bitsPerSample / 8;
  var dataSize = samples.length * blockAlign;
  var headerSize = 44;
  var fileSize = headerSize + dataSize;

  var buf = Buffer.alloc(fileSize);
  var pos = 0;
  buf.write("RIFF", pos); pos += 4;
  buf.writeUInt32LE(fileSize - 8, pos); pos += 4;
  buf.write("WAVE", pos); pos += 4;
  buf.write("fmt ", pos); pos += 4;
  buf.writeUInt32LE(16, pos); pos += 4; /* subchunk size */
  buf.writeUInt16LE(1, pos); pos += 2; /* PCM */
  buf.writeUInt16LE(numChannels, pos); pos += 2;
  buf.writeUInt32LE(SR, pos); pos += 4;
  buf.writeUInt32LE(byteRate, pos); pos += 4;
  buf.writeUInt16LE(blockAlign, pos); pos += 2;
  buf.writeUInt16LE(bitsPerSample, pos); pos += 2;
  buf.write("data", pos); pos += 4;
  buf.writeUInt32LE(dataSize, pos); pos += 4;

  for (var i = 0; i < samples.length; i++) {
    var v = Math.max(-1, Math.min(1, samples[i]));
    var intVal = v < 0 ? v * 32768 : v * 32767;
    buf.writeInt16LE(Math.round(intVal), pos);
    pos += 2;
  }

  writeFileSync(resolve(outDir, filename), buf);
  var kb = Math.round(buf.length / 1024);
  console.log("  " + filename + " (" + kb + "KB)");
}

function durToSamples(durSec) { return Math.floor(durSec * SR); }

/* ---- Synthesis helpers ---- */

function noise(n) {
  var arr = new Float32Array(n);
  for (var i = 0; i < n; i++) arr[i] = Math.random() * 2 - 1;
  return arr;
}

function sine(freq, durSec) {
  var n = durToSamples(durSec);
  var arr = new Float32Array(n);
  for (var i = 0; i < n; i++) arr[i] = Math.sin(2 * Math.PI * freq * i / SR);
  return arr;
}

function expDecay(durSec) {
  var n = durToSamples(durSec);
  var arr = new Float32Array(n);
  for (var i = 0; i < n; i++) arr[i] = Math.exp(-i / (SR * 0.1));
  return arr;
}

function linearDecay(durSec) {
  var n = durToSamples(durSec);
  var arr = new Float32Array(n);
  for (var i = 0; i < n; i++) arr[i] = 1 - i / n;
  return arr;
}

function mul(a, b) {
  var n = Math.min(a.length, b.length);
  for (var i = 0; i < n; i++) a[i] *= b[i];
  return a;
}

function add(a, b) {
  var n = Math.max(a.length, b.length);
  var out = new Float32Array(n);
  for (var i = 0; i < n; i++) {
    out[i] = (i < a.length ? a[i] : 0) + (i < b.length ? b[i] : 0);
  }
  return out;
}

function clip(arr) {
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] > 1) arr[i] = 1;
    if (arr[i] < -1) arr[i] = -1;
  }
  return arr;
}

function scale(arr, s) {
  for (var i = 0; i < arr.length; i++) arr[i] *= s;
  return arr;
}

/* Sine with frequency sweep (linear from f0 to f1) */
function sineSweep(f0, f1, durSec) {
  var n = durToSamples(durSec);
  var phase = 0;
  var arr = new Float32Array(n);
  for (var i = 0; i < n; i++) {
    var t = i / n;
    var freq = f0 + (f1 - f0) * t;
    arr[i] = Math.sin(phase * 2 * Math.PI);
    phase += freq / SR;
  }
  return arr;
}

/* ---- Drum sounds ---- */

console.log("Generating drum kit to " + outDir + "...");

/* 1. Kick — pitch-dropping sine, fast decay */
writeWav("kick.wav", clip(mul(sineSweep(150, 40, 0.4), expDecay(0.4))));

/* 2. Snare — mix of tone (200Hz) + noise burst */
var snareTone = mul(sine(200, 0.3), expDecay(0.3));
var snareNoise = mul(noise(durToSamples(0.25)), expDecay(0.25));
writeWav("snare.wav", clip(scale(add(snareTone, snareNoise), 0.6)));

/* 3. Clap — 3 quick noise layers with staggered attacks */
var clapLen = durToSamples(0.25);
var clap = new Float32Array(clapLen);
for (var c = 0; c < 3; c++) {
  var delay = Math.floor(c * SR * 0.008);
  var burst = mul(noise(clapLen - delay), expDecay(0.12));
  for (var j = 0; j < burst.length && delay + j < clapLen; j++) {
    clap[delay + j] += burst[j] * 0.5;
  }
}
writeWav("clap.wav", clip(clap));

/* 4. Rimshot — short high-pitched tone */
writeWav("rimshot.wav", clip(mul(sine(1800, 0.04), expDecay(0.04))));

/* 5. Closed hat — bandpassed noise, very short */
/* Simulate bandpass by ringing noise: multiply filtered noise with decay */
var chLen = durToSamples(0.06);
var chRaw = noise(chLen);
var chFilt = new Float32Array(chLen);
/* Simple one-pole HP at ~6kHz by differencing */
for (var i = 1; i < chLen; i++) chFilt[i] = chRaw[i] - 0.85 * chRaw[i - 1];
var chDecay = expDecay(0.06);
writeWav("hat-closed.wav", clip(scale(mul(chFilt, chDecay), 0.8)));

/* 6. Open hat — same but longer */
var ohLen = durToSamples(0.35);
var ohRaw = noise(ohLen);
var ohFilt = new Float32Array(ohLen);
for (var i = 1; i < ohLen; i++) ohFilt[i] = ohRaw[i] - 0.85 * ohRaw[i - 1];
var ohDecay = expDecay(0.35);
writeWav("hat-open.wav", clip(scale(mul(ohFilt, ohDecay), 0.7)));

/* 7. Low tom — pitch-dropping sine */
writeWav("tom-low.wav", clip(mul(sineSweep(100, 60, 0.35), expDecay(0.35))));

/* 8. High tom — higher pitch-drop */
writeWav("tom-high.wav", clip(mul(sineSweep(200, 120, 0.3), expDecay(0.3))));

/* 9. Crash — wideband noise, short, trimmed to fit size budget */
writeWav("crash.wav", clip(scale(mul(noise(durToSamples(0.45)), expDecay(0.45)), 0.35)));

/* 10. Cowbell — two sine tones */
var cb = add(mul(sine(800, 0.15), expDecay(0.15)), mul(sine(1050, 0.15), expDecay(0.15)));
writeWav("cowbell.wav", clip(scale(cb, 0.7)));

/* 11. Shaker — amplitude-modulated noise */
var shLen = durToSamples(0.15);
var shNoise = noise(shLen);
var shMod = new Float32Array(shLen);
for (var i = 0; i < shLen; i++) {
  var t = i / SR;
  shMod[i] = Math.sin(2 * Math.PI * 30 * t) > 0 ? 1 : 0;
  shNoise[i] *= shMod[i];
}
writeWav("shaker.wav", clip(scale(mul(shNoise, expDecay(0.15)), 0.5)));

/* 12. Zap — descending sine sweep */
writeWav("zap.wav", clip(mul(sineSweep(2000, 150, 0.2), expDecay(0.2))));

console.log("Done — 12 files written.");
