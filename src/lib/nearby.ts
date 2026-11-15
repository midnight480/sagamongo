// 「話しかける」の相手：AR の画面に出ているえびすさん（src/data/ar-objects.json の objects）。
// AR 画面（components/ar/ARView.tsx）が、ユーザーと各えびすさんの水平距離（3D シーンで毎フレーム計算している値）を
// ここに知らせる。いちばん近いえびすさんまで 1.0m 以内なら「話しかける」を押せる。
// 仕様（ebisu-walk.md）：えびすさんのすぐそば（1.0m 以内）まで近づくと「話しかける」を押せ、話しかけると図鑑に登録し、ポイントがもらえる
//   図鑑に登録：レア度に応じたポイント（ガチャで持っていた像はなし）／現地ボーナス：はじめてのとき +20pt
//   どの図鑑の像として数えるかは、AR 画面が知らせる progressKey（出てくるときに lib/ar/objects.ts の drawStatues で抽選）。無ければ、ひとことだけ

import * as progress from './progress';
import { gradeOf } from './rarity';
import { gachaPool, type Entry } from './catalog';

export const TALK_M = 1.0;
export const VISIT_BONUS = 20;

// 距離の表示。近いほど細かく（10m 未満は 0.1m 刻み）
export const formatDist = (m: number) =>
  m >= 1000 ? `${(m / 1000).toFixed(1)}km` : m >= 10 ? `${Math.round(m)}m` : `${m.toFixed(1)}m`;

// AR 画面から知らせてもらう、えびすさん 1 体分
export type ArFigure = { id: string; label: string; progressKey?: string; spawned: boolean; distM: number };

export type Nearest = { figure: ArFigure; entry: Entry | null; distM: number; inRange: boolean } | null;

const entryByKey = new Map(gachaPool.map((e) => [e.key, e]));

let cache: Nearest = null;
let cacheKey = '';
let arActive = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};
export const getNearest = () => cache;
// AR が動いているか（AR を開始して、えびすさんを置いたあと）
export const isArActive = () => arActive;

// AR 画面が定期的に呼ぶ。表示が変わる（相手・範囲の内外・距離の表示）ときだけ知らせる
export function report(figures: ArFigure[]) {
  arActive = true;
  let best: ArFigure | null = null;
  for (const f of figures) if (f.spawned && (!best || f.distM < best.distM)) best = f;
  const n: Nearest = best
    ? { figure: best, entry: best.progressKey ? entryByKey.get(best.progressKey) ?? null : null, distM: best.distM, inRange: best.distM <= TALK_M }
    : null;
  const key = `1|${n ? `${n.figure.id}|${n.inRange}|${formatDist(n.distM)}` : ''}`;
  if (key === cacheKey) return;
  cacheKey = key;
  cache = n;
  emit();
}

// AR 画面を閉じたとき
export function clear() {
  arActive = false;
  cache = null;
  cacheKey = '';
  emit();
}

export type TalkResult = { name: string; entry: Entry | null; line: string; collected: boolean; points: number };

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

// 話しかける。1.0m 以内なら、はじめてのときだけ図鑑に登録・現地ボーナス
export function talk(n: NonNullable<Nearest>): TalkResult | null {
  if (!n.inRange) return null;
  const line = LINES[Math.floor(Math.random() * LINES.length)];
  const e = n.entry;
  if (!e) return { name: n.figure.label, entry: null, line, collected: false, points: 0 };
  const before = progress.get().balance; // イベント中の倍率も込みで、増えた分を出すため
  const collected = progress.collect(e.key, e.name, gradeOf(e.grade).statuePoints);
  progress.visit(e.key, e.name, VISIT_BONUS);
  return { name: e.name, entry: e, line, collected, points: progress.get().balance - before };
}
