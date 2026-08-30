#!/usr/bin/env node
/**
 * Convert a word bucket markdown table into JSON used to seed the app database.
 *
 * Input:  data/<name>.md  — a markdown table with columns: # | word | ipa | meaning | forms
 * Output: data/<name>.json — { name, words: [{ position, word, ipa, meaning, forms }] }
 *
 * Usage: node scripts/convert-bucket.mjs [data/2050.md ...]
 *        (no arguments converts every .md file in data/)
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const dataDir = join(process.cwd(), 'data');

const files =
  process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : readdirSync(dataDir)
        .filter((f) => f.endsWith('.md'))
        .map((f) => join(dataDir, f));

let failed = false;

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const words = [];
  const errors = [];

  for (const [index, raw] of lines.entries()) {
    const line = raw.trim();
    if (line.length === 0 || !line.startsWith('|')) continue;

    const cells = line.split('|').map((c) => c.trim());
    // A well-formed row is: '' | # | word | ipa | meaning | forms | ''
    if (cells.length !== 7) {
      errors.push(`line ${index + 1}: expected 5 columns, got ${cells.length - 2}: ${line}`);
      continue;
    }

    const [, num, word, ipa, meaning, forms] = cells;
    if (num === '#' || /^-+$/.test(num)) continue; // header / separator rows

    if (word.length === 0) {
      errors.push(`line ${index + 1}: empty word`);
      continue;
    }
    if (Number.parseInt(num, 10) !== words.length + 1) {
      errors.push(`line ${index + 1}: expected position ${words.length + 1}, got "${num}"`);
      continue;
    }

    words.push({
      position: words.length + 1,
      word,
      ipa,
      meaning,
      forms: forms.length > 0 ? forms.split(',').map((f) => f.trim()).filter((f) => f.length > 0) : [],
    });
  }

  const name = basename(file).replace(/\.md$/, '');
  if (errors.length > 0) {
    failed = true;
    console.error(`${name}: ${errors.length} problem(s)`);
    for (const e of errors.slice(0, 10)) console.error(`  ${e}`);
    continue;
  }

  const out = join(dataDir, `${name}.json`);
  writeFileSync(out, JSON.stringify({ name, words }, null, 2) + '\n');
  console.log(`${name}: ${words.length} words -> ${out}`);
}

process.exit(failed ? 1 : 0);
