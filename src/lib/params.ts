// URL のクエリ（発表用のデモ操作）。?gacha=SSR&reversal=1、?date=2027-01-10 など。
// サーバー側で描くときは window がないので、何も付いていないものとして扱う。

export function param(name: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}
