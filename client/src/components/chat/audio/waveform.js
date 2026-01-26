// Deterministic waveform generation for audio messages.
// Uses a seeded PRNG so the same fileId always renders the same bars.

export const hashStringToInt = (str) => {
  const s = String(str || "");
  // FNV-1a 32-bit hash
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Ensure unsigned 32-bit
  return h >>> 0;
};

export const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const generateBarsFromSeed = (seed, count, min, max) => {
  const total = Math.max(1, Number(count) || 1);
  const minH = Math.max(1, Number(min) || 1);
  const maxH = Math.max(minH + 1, Number(max) || minH + 1);
  const rng = mulberry32(seed);
  const bars = new Array(total);
  const span = maxH - minH;
  for (let i = 0; i < total; i += 1) {
    bars[i] = minH + Math.floor(rng() * span);
  }
  return bars;
};

export const generateWaveformBars = (
  fileId,
  count = 48,
  minHeight = 4,
  maxHeight = 20
) => {
  const seed = hashStringToInt(fileId || "");
  return generateBarsFromSeed(seed, count, minHeight, maxHeight);
};
