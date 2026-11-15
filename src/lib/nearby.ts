// 今いる場所からいちばん近いえびす像。1.0m 以内なら「話しかける」を押せる。
// 今いる場所とえびす像の距離は、位置が変わるたびに計算し直している。
// 話しかけると図鑑に登録し、ポイントがもらえる（ebisu-walk.md では「30m 以内」だが、話しかけるのは 1.0m まで近づいたとき）
//   図鑑に登録：レア度に応じたポイント（ガチャで持っていた像はなし）／現地ボーナス：はじめて行ったとき +20pt
// 今いる場所は lib/position.ts（GPS か、デモの位置）。

import * as position from './position';
import * as progress from './progress';
import { gradeOf } from './rarity';
import { mapStatues, type Entry } from './catalog';

export const TALK_M = 1.0;
export const VISIT_BONUS = 20;

// 距離の表示。近いほど細かく（10m 未満は 0.1m 刻み）
export const formatDist = (m: number) =>
  m >= 1000 ? `${(m / 1000).toFixed(1)}km` : m >= 10 ? `${Math.round(m)}m` : `${m.toFixed(1)}m`;

export type Nearest = { entry: Entry; distM: number; inRange: boolean } | null;

let cache: Nearest = null;
let cacheKey = '';
const listeners = new Set<() => void>();

function compute(): Nearest {
  const p = position.getPosition();
  if (!p) return null;
  let best: Entry | null = null;
  let bestD = Infinity;
  for (const e of mapStatues) {
    const dist = position.distanceM(p, { lat: e.lat!, lng: e.lng! });
    if (dist < bestD) { bestD = dist; best = e; }
  }
  return best ? { entry: best, distM: bestD, inRange: bestD <= TALK_M } : null;
}

// 位置が変わったら計算し直す。表示が変わる（像・範囲の内外・距離の表示）ときだけ知らせる
function update() {
  const n = compute();
  const key = n ? `${n.entry.key}|${n.inRange}|${formatDist(n.distM)}` : '';
  if (key === cacheKey) return;
  cacheKey = key;
  cache = n;
  listeners.forEach((fn) => fn());
}

let unsubscribePosition: (() => void) | null = null;
export function subscribe(fn: () => void) {
  listeners.add(fn);
  if (!unsubscribePosition) { unsubscribePosition = position.subscribe(update); update(); }
  return () => {
    listeners.delete(fn);
    if (!listeners.size && unsubscribePosition) { unsubscribePosition(); unsubscribePosition = null; }
  };
}
export const getNearest = () => cache;

export type TalkResult = { entry: Entry; line: string; collected: boolean; visitedFirst: boolean; points: number };

// えびすさんのひとこと（佐賀ことば）。押すたびにどれか
const LINES = [
  'よう来んしゃったね。ゆっくりしていかんね。',
  'ここで町ば、ずっと見守っとるとよ。',
  '今日もよか日になるごと、福ば分けてやろうかね。',
  'あんたの顔ば見たら、こっちまでにこにこしてくるばい。',
  'この道は昔から、いろんな人の通りよったとよ。',
  '歩き疲れたら、ひと休みしていかんね。',
  'また会いに来てくれたら、うれしかばい。',
  '佐賀には、わしの仲間がまだまだおるけんね。',
];

// 話しかける。30m 以内なら図鑑に登録・現地ボーナス（はじめてのときだけ）
export function talk(n: NonNullable<Nearest>): TalkResult | null {
  if (!n.inRange) return null;
  const e = n.entry;
  const statuePoints = gradeOf(e.grade).statuePoints;
  const before = progress.get().balance; // イベント中の倍率も込みで、増えた分を出すため
  const collected = progress.collect(e.key, e.name, statuePoints);
  const visitedFirst = progress.visit(e.key, e.name, VISIT_BONUS);
  const line = LINES[Math.floor(Math.random() * LINES.length)];
  return { entry: e, line, collected, visitedFirst, points: progress.get().balance - before };
}
