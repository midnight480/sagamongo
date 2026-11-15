// アイコンの PNG を scripts/icon.svg から作る。アイコンを描き直したら `node scripts/make-icons.mjs` を流す。
// next/og（Satori + resvg）で SVG を PNG にする。
import { readFile, writeFile } from 'node:fs/promises';
import { createElement } from 'react';
import { ImageResponse } from 'next/og.js';

const svg = await readFile(new URL('./icon.svg', import.meta.url));
const src = `data:image/svg+xml;base64,${svg.toString('base64')}`;

// maskable は端末が丸や角丸に切り抜くので、絵を内側 80% に収める（地の赤は外まで塗る）
const targets = [
  { file: 'public/icons/icon-192.png', size: 192, pad: 0 },
  { file: 'public/icons/icon-512.png', size: 512, pad: 0 },
  { file: 'public/icons/maskable-512.png', size: 512, pad: 0.1 },
  { file: 'public/icons/apple-touch-icon.png', size: 180, pad: 0 },
];

for (const { file, size, pad } of targets) {
  const inner = Math.round(size * (1 - pad * 2));
  const res = new ImageResponse(
    createElement('div', {
      style: { width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#b91c1c' },
    }, createElement('img', { src, width: inner, height: inner })),
    { width: size, height: size },
  );
  await writeFile(new URL(`../${file}`, import.meta.url), Buffer.from(await res.arrayBuffer()));
  console.log('wrote', file);
}
