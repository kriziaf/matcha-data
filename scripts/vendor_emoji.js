#!/usr/bin/env node
'use strict';

/*
 * Copies the Twemoji SVGs used in data/*.json into assets/emoji/.
 *
 *   npm pack @twemoji/svg@15.0.0 && tar xzf twemoji-svg-*.tgz   (in a scratch directory)
 *   node scripts/vendor_emoji.js <dir with the extracted package/*.svg>
 *
 * Re-run whenever data/tweets.json changes. Keep EMOJI_RE and toFilename()
 * in sync with app.js.
 */

const fs = require('fs');
const path = require('path');

const EMOJI_RE =
  /\p{Extended_Pictographic}\p{Emoji_Modifier}?(?:️|‍\p{Extended_Pictographic}\p{Emoji_Modifier}?️?)*/gu;

// Twemoji filenames: lowercase hex code points joined by "-", FE0F dropped unless the emoji has a ZWJ.
function toFilename(emoji) {
  const hasZwj = emoji.includes('‍');
  const points = [...emoji].map((c) => c.codePointAt(0)).filter((cp) => hasZwj || cp !== 0xfe0f);
  return points.map((cp) => cp.toString(16)).join('-') + '.svg';
}

const source = process.argv[2];
if (!source || !fs.existsSync(source)) {
  console.error('usage: node scripts/vendor_emoji.js <dir containing Twemoji .svg files>');
  process.exit(1);
}

const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'data');
const outDir = path.join(root, 'assets', 'emoji');
fs.mkdirSync(outDir, { recursive: true });

const used = new Map(); // filename -> emoji
for (const file of fs.readdirSync(dataDir).filter((f) => f.endsWith('.json'))) {
  const json = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
  if (!Array.isArray(json)) continue; // skips tags.json-style non-tweet files
  for (const tweet of json) {
    if (typeof tweet?.text !== 'string') continue;
    for (const emoji of tweet.text.match(EMOJI_RE) ?? []) used.set(toFilename(emoji), emoji);
  }
}

const missing = [];
for (const [filename, emoji] of used) {
  const from = path.join(source, filename);
  if (fs.existsSync(from)) fs.copyFileSync(from, path.join(outDir, filename));
  else missing.push(`${emoji} (${filename})`);
}

console.log(`${used.size - missing.length} of ${used.size} emoji copied to assets/emoji/`);
if (missing.length) {
  console.error('No Twemoji file for: ' + missing.join(', '));
  process.exit(2);
}
