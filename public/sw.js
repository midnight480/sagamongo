// Service Worker（PWA）。会場の Wi-Fi が不安定でも開けるよう、アプリの画面と静的ファイルを端末に置いておく。
// ・ページ：まずネットから取り、取れなければ端末に置いたそのページ（なければトップ）を出す
// ・/_next/static/（ファイル名にハッシュが付いていて変わらない）・アイコン・七賢人の肖像・AR の素材：端末にあればそれを使う
// ・ほかのサイト（公式サイトのえびす像の写真など）：ここでは扱わない（ブラウザに任せる）
// 中身を変えたら VERSION を上げる。古い置き場は次に開いたときに消える。

const VERSION = 'v2';
const CACHE = `sagamongo-${VERSION}`;
const PRECACHE = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('sagamongo-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const cacheFirst = async (req) => {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
  return res;
};

const networkFirstPage = async (req) => {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
    return res;
  } catch {
    return (await caches.match(req)) ?? (await caches.match('/')) ?? Response.error();
  }
};

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(networkFirstPage(req));
    return;
  }
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/img/') || url.pathname.startsWith('/figures/')) {
    event.respondWith(cacheFirst(req));
  }
});
