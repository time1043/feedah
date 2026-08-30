#!/usr/bin/env node
/**
 * Generates every image asset for the app icon, adaptive icons, splash, and
 * favicon from the SVG sources below. Rerun after changing the design:
 *
 *   node scripts/generate-assets.mjs
 */

import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const images = join(root, 'assets', 'images');

/** Brand palette. */
const GRADIENT_TOP = '#4EA5F5';
const GRADIENT_BOTTOM = '#1B7CE0';
const BACKGROUND = '#1B7CE0';

/**
 * The glyph: an upward chevron over a rounded card holding three feed lines.
 * Drawn on a 1024x1024 canvas, centered around (512, 512).
 */
function glyphSvg({ scale = 1, lines = true } = {}) {
  const inner = `
    <g fill="none" stroke="#FFFFFF" stroke-width="84" stroke-linecap="round" stroke-linejoin="round">
      <path d="M 392 372 L 512 252 L 632 372" />
      <line x1="512" y1="292" x2="512" y2="435" />
    </g>
    <rect x="312" y="500" width="400" height="300" rx="76" fill="#FFFFFF" />
    ${
      lines
        ? `
    <g stroke="${BACKGROUND}" stroke-width="40" stroke-linecap="round">
      <line x1="372" y1="585" x2="652" y2="585" />
      <line x1="372" y1="655" x2="562" y2="655" />
      <line x1="372" y1="725" x2="612" y2="725" />
    </g>`
        : ''
    }`;

  return scale === 1
    ? inner
    : `<g transform="translate(512 512) scale(${scale}) translate(-512 -512)">${inner}</g>`;
}

function iconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${GRADIENT_TOP}" />
        <stop offset="1" stop-color="${GRADIENT_BOTTOM}" />
      </linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg)" />
    ${glyphSvg()}
  </svg>`;
}

/** Rounded-corner variant for the browser favicon. */
function faviconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${GRADIENT_TOP}" />
        <stop offset="1" stop-color="${GRADIENT_BOTTOM}" />
      </linearGradient>
    </defs>
    <rect width="1024" height="1024" rx="180" fill="url(#bg)" />
    ${glyphSvg()}
  </svg>`;
}

/** Transparent background; the launcher composites it over the background layer. */
function adaptiveForegroundSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    ${glyphSvg({ scale: 0.88 })}
  </svg>`;
}

/** Silhouette without interior detail for Android themed (monochrome) icons. */
function monochromeSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    ${glyphSvg({ scale: 0.88, lines: false })}
  </svg>`;
}

function adaptiveBackgroundSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${GRADIENT_TOP}" />
        <stop offset="1" stop-color="${GRADIENT_BOTTOM}" />
      </linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg)" />
  </svg>`;
}

/** White glyph on transparency, shown over the splash background color. */
function splashSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    ${glyphSvg({ scale: 0.9 })}
  </svg>`;
}

async function render(svg, sizes, file) {
  for (const size of sizes) {
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(size === sizes[0] ? file : file.replace(/\.png$/, `@${size}.png`));
  }
  console.log(`${file} (${sizes.join(', ')}px)`);
}

await rm(images, { recursive: true, force: true });
await mkdir(images, { recursive: true });

await render(iconSvg(), [1024], join(images, 'icon.png'));
await render(adaptiveForegroundSvg(), [1024], join(images, 'android-icon-foreground.png'));
await render(monochromeSvg(), [1024], join(images, 'android-icon-monochrome.png'));
await render(adaptiveBackgroundSvg(), [1024], join(images, 'android-icon-background.png'));
await render(splashSvg(), [1024], join(images, 'splash-icon.png'));
await render(faviconSvg(), [48], join(images, 'favicon.png'));
