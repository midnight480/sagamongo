// 町の案内人（おばあちゃん）に渡す QR コードの決まり。
// QR の中身は GUIDE_URL（/guide）。外のカメラで読めば next.config.ts の redirects でクイズへ、
// アプリの中の読み取り（components/QrScanDialog.tsx）なら、その場でクイズを出す。

// 印刷物に載せるので、本番の URL に固定する
export const GUIDE_URL = 'https://sagamongo.vercel.app/guide';

const HOSTS = new Set(['sagamongo.vercel.app']);

// 読み取った文字が案内人の QR なら { id }（id は問題の指定。なければ undefined）、違えば null
export function parseGuideQr(text: string): { id?: string } | null {
  let url: URL;
  try { url = new URL(text.trim()); } catch { return null; }
  const sameOrigin = typeof location !== 'undefined' && url.origin === location.origin;
  if (!HOSTS.has(url.host) && !sameOrigin) return null;
  const m = url.pathname.match(/^\/guide(?:\/([\w-]+))?\/?$/);
  return m ? { id: m[1] } : null;
}
