// えびすガチャ（デモ決済）の決まり
// 図鑑がそろわない人向け。払った金額と同じだけ「お店で使えるポイント」が付き、ガチャを1回引ける。
// 1回の値段は回すほど安くなる（PRICES の順、最後の値段が下限）。すでに持っているキャラも出る（かぶり）。
// 決済はデモで、実際の支払いは発生しない。本番は決済代行（Stripe など）を Vercel Functions 経由でつなぐ。
// 画面と演出は components/GachaDialog.tsx と lib/gacha-fx.ts。
// 移植元：smart-hackathon-20261115/prototype/sanpo/gacha.js

import * as progress from './progress';
import { rareMultiplier } from './events';
import { ORDER, isHigh, type Grade } from './rarity';
import { param } from './params';
import { gachaPool, type Entry } from './catalog';

// n 回目の値段（円）。これより後は最後の値段のまま
export const PRICES = [300, 250, 200, 150];
// まずレア度を RATE の割合で決め、そのレア度の中から1体を同じ確率で選ぶ
// （えびす像が 828体あるので、1体ずつの重みにすると N ばかりになるため）
export const RATE: Record<Grade, number> = { N: 60, R: 25, SR: 12, SSR: 3 };
// かぶったときのおまけ（pt）
export const DUP_BONUS = 10;
// 貯まったポイントで回すときの値段（pt）。えびす像を図鑑に入れると N 10pt〜SSR 30pt、現地ボーナス 20pt なので、
// 像を 3〜4 体集めると 1 回回せるくらい
export const POINT_PRICE = 100;

export const priceOf = (n: number) => PRICES[Math.min(n, PRICES.length - 1)];
export const countOf = (g: Grade) => gachaPool.filter((e) => e.grade === g).length;

// イベント期間中は SR・SSR が出やすい
export function gradeRates(): Record<Grade, number> {
  const w = Object.fromEntries(ORDER.map((gr) => [gr, RATE[gr] * (isHigh(gr) ? rareMultiplier() : 1)])) as Record<Grade, number>;
  const sum = Object.values(w).reduce((a, b) => a + b, 0);
  return Object.fromEntries(ORDER.map((gr) => [gr, w[gr] / sum])) as Record<Grade, number>;
}

const sample = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

export function pick(): Entry {
  // 発表用：?gacha=SSR などで、そのレア度を必ず出す
  const force = param('gacha');
  const forced = gachaPool.filter((e) => e.grade === force);
  if (forced.length) return sample(forced);
  const rates = gradeRates();
  let r = Math.random();
  let grade: Grade = 'N';
  for (const gr of ORDER) { r -= rates[gr]; if (r <= 0) { grade = gr; break; } }
  return sample(gachaPool.filter((e) => e.grade === grade));
}

export type DrawResult = { entry: Entry; isNew: boolean; price: number; paidWith: 'yen' | 'points' };

// 1体引いて図鑑に入れる。かぶったらおまけ
function drawOne() {
  const entry = pick();
  const isNew = progress.collect(entry.key, entry.name, 0);
  if (!isNew) progress.bonus(DUP_BONUS, `ガチャで${entry.name}がかぶった`);
  return { entry, isNew };
}

// デモ決済で払って1回引く（記録に残す）。演出は呼んだ側で行う
export function payAndDraw(): DrawResult {
  const price = priceOf(progress.gachaInfo().draws);
  progress.buyGacha(price);
  return { ...drawOne(), price, paidWith: 'yen' };
}

// 貯まったポイントで1回引く。ポイントが足りなければ null
export function drawWithPoints(): DrawResult | null {
  if (!progress.spendPointsForGacha(POINT_PRICE)) return null;
  return { ...drawOne(), price: POINT_PRICE, paidWith: 'points' };
}
