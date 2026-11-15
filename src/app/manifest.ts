// PWA のマニフェスト（/manifest.webmanifest として配られる）。ホーム画面に追加すると、アプリのように全画面で開く。
// アイコンは scripts/icon.svg から scripts/make-icons.mjs で作る。

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'さがもん！Go！',
    short_name: 'さがもんGo',
    description: '佐賀の町を歩くと、えびすさんと佐賀の七賢人が道を歩いている。像の前まで行って写真を撮ると、その像も動き出す。',
    lang: 'ja',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#16181d',
    theme_color: '#16181d',
    categories: ['games', 'travel', 'entertainment'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
