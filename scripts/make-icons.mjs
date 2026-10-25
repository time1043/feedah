// Derives every image referenced by app.json from the AI-generated master
// (assets/images/icon-source.png: 1536x1024 RGBA, transparent background,
// the mark is the only near-opaque region; a faint outline stroke and noise
// speckles live at alpha <= 31 and get dropped).
//
// Usage: node scripts/make-icons.mjs [master.png]

import sharp from 'sharp';

const SRC = process.argv[2] ?? 'assets/images/icon-source.png';
const OUT = 'assets/images';

const { data, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;
const CH = info.channels;
const N = W * H;

// The mark = all components of alpha >= 128 larger than 2000px (the mark is
// two disconnected swooshes; speckles are tiny).
const bin = new Uint8Array(N);
for (let p = 0, q = 3; p < N; p++, q += CH) bin[p] = data[q] >= 128 ? 1 : 0;
const comp = new Int32Array(N).fill(-1);
const stack = [];
const compSizes = new Map();
for (let start = 0; start < N; start++) {
  if (!bin[start] || comp[start] !== -1) continue;
  comp[start] = start;
  stack.push(start);
  let size = 0;
  while (stack.length) {
    const p = stack.pop();
    size++;
    const x = p % W, y = (p / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const np = ny * W + nx;
      if (bin[np] && comp[np] === -1) { comp[np] = start; stack.push(np); }
    }
  }
  compSizes.set(start, size);
}
const MIN_CORE = 2000;
const isCore = (p) => comp[p] >= 0 && compSizes.get(comp[p]) >= MIN_CORE;
let corePx = 0;
for (let p = 0; p < N; p++) if (isCore(p)) corePx++;
console.log(`components >= ${MIN_CORE}px: ${[...compSizes.values()].filter((s) => s >= MIN_CORE).length}, core px: ${corePx}`);

const inBest = (x, y) => x >= 0 && y >= 0 && x < W && y < H && isCore(y * W + x);

// keep = within 2px of the core AND alpha >= 32: covers the anti-aliased
// edge while dropping speckles and the outline stroke (all alpha <= 31).
const keep = new Uint8Array(N);
for (let p = 0, q = 3; p < N; p++, q += CH) {
  if (data[q] < 32) continue;
  const x = p % W, y = (p / W) | 0;
  if (inBest(x, y)) { keep[p] = 1; continue; }
  for (let dy = -2; dy <= 2 && !keep[p]; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (inBest(x + dx, y + dy)) { keep[p] = 1; break; }
    }
  }
}

let minx = W, miny = H, maxx = -1, maxy = -1;
for (let p = 0; p < N; p++) {
  if (!keep[p]) continue;
  const x = p % W, y = (p / W) | 0;
  if (x < minx) minx = x;
  if (x > maxx) maxx = x;
  if (y < miny) miny = y;
  if (y > maxy) maxy = y;
}
console.log(`mark bbox: ${minx},${miny}-${maxx},${maxy} (${maxx - minx + 1}x${maxy - miny + 1})`);

// Cut the mark (straight alpha kept as-is) onto a square transparent canvas.
const PAD = 8;
const side = Math.max(maxx - minx, maxy - miny) + 1 + PAD * 2;
const mark = Buffer.alloc(side * side * 4, 0);
const ox = ((side - (maxx - minx + 1)) >> 1) - minx;
const oy = ((side - (maxy - miny + 1)) >> 1) - miny;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const p = y * W + x;
    if (!keep[p]) continue;
    const q = ((y + oy) * side + (x + ox)) * 4;
    mark[q] = data[p * CH];
    mark[q + 1] = data[p * CH + 1];
    mark[q + 2] = data[p * CH + 2];
    mark[q + 3] = data[p * CH + 3];
  }
}
const markImg = () => sharp(mark, { raw: { width: side, height: side, channels: 4 } });

// Monochrome silhouette: white RGB; alpha comes from the blurred core mask
// alone, because the source alpha wobbles inside the mark and shows as
// stripes in a flat white silhouette.
const monoBuf = async () => {
  const coreA = Buffer.alloc(side * side, 0);
  for (let p = 0; p < N; p++) {
    if (!isCore(p)) continue;
    const x = (p % W) + ox, y = ((p / W) | 0) + oy;
    coreA[y * side + x] = 255;
  }
  // blur promotes the 1-channel input to 3 channels; read per-pixel with
  // the actual channel count
  const { data: grown, info: gi } = await sharp(coreA, { raw: { width: side, height: side, channels: 1 } })
    .blur(1.2)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const d = Buffer.alloc(side * side * 4, 255);
  for (let i = 0; i < side * side; i++) d[i * 4 + 3] = grown[i * gi.channels];
  return sharp(d, { raw: { width: side, height: side, channels: 4 } });
};

// ---------- outputs --------------------------------------------------------
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } })
  .composite([{ input: await markImg().clone().resize(600, 600, { fit: 'inside' }).png().toBuffer() }])
  .png()
  .toFile(`${OUT}/icon.png`);

await markImg()
  .resize(720, 720, { fit: 'inside' })
  .png()
  .toFile(`${OUT}/splash-icon.png`);

// 1024 transparent canvas with the mark sized for the adaptive viewport:
// Android shows only the central 72/108 of the canvas (683px here), so the
// mark is sized against that visible area (~64%), not the full canvas.
const ADAPTIVE_MARK = 440;
const adaptiveMark = async () =>
  sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: await markImg().clone().resize(ADAPTIVE_MARK, ADAPTIVE_MARK, { fit: 'inside' }).png().toBuffer() }]);

await (await adaptiveMark()).png().toFile(`${OUT}/android-icon-foreground.png`);

await (await adaptiveMark())
  .composite([{ input: await (await monoBuf()).resize(ADAPTIVE_MARK, ADAPTIVE_MARK, { fit: 'inside' }).png().toBuffer() }])
  .png()
  .toFile(`${OUT}/android-icon-monochrome.png`);

await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } })
  .png()
  .toFile(`${OUT}/android-icon-background.png`);

await sharp({ create: { width: 48, height: 48, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: await markImg().clone().resize(42, 42, { fit: 'inside' }).png().toBuffer() }])
  .png()
  .toFile(`${OUT}/favicon.png`);

console.log('done');
