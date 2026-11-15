// AR に置くものの定義（src/data/ar-objects.json）を型付きで読む。
// 定義は 2 段に分かれている。
//   figures: 素材（見た目）。画像の面の数（views）と身長。scripts/prepare-figure.mjs も同じファイルを読む
//   objects: 置き方。どの素材を、どう出して（spawn）、どう動かすか（motion）
// 同じ素材を、出方・動き方を変えて何体でも置ける。

import config from '@/data/ar-objects.json';
import { gachaPool, type Entry } from '@/lib/catalog';
import { pick } from '@/lib/gacha';
import type { MotionRule, SpawnRule } from './behaviors';

export type FigureFace = 'front' | 'side' | 'back';

export type FigureDefinition = {
  id: string;
  name: string;
  /** 表示上の高さ（m）。写真の高さに対応する */
  heightM: number;
  /** 素材の面。front は必須。side は「左向き」の画像が前提 */
  views: FigureFace[];
  images: Partial<Record<FigureFace, string>>;
  /** ビルド時に生成した看板メッシュ（three.js BufferGeometry JSON） */
  boardUrl: string;
};

export type ARObjectDefinition = {
  id: string;
  /** 名札に出す名前 */
  label: string;
  figure: FigureDefinition;
  spawn: SpawnRule;
  motion: MotionRule;
  /**
   * 図鑑（lib/progress.ts）の key。「話しかける」（lib/nearby.ts）で、この像として図鑑に登録する。
   * 決まった像にしたいとき（実在の像を geo で置くなど）だけ書く。書かなければ、出てくるたびに図鑑のえびす像から抽選する（drawStatues）
   */
  progressKey?: string;
};

type RawObject = {
  id: string;
  figure: string;
  label?: string;
  spawn: unknown;
  motion: unknown;
  progressKey?: string;
};

export const FIGURES: FigureDefinition[] = config.figures.map((f) => {
  const base = `/figures/${f.id}`;
  const views = f.views as FigureFace[];
  return {
    id: f.id,
    name: f.name,
    heightM: f.heightM,
    views,
    images: Object.fromEntries(views.map((v) => [v, `${base}/${v}.png`])),
    boardUrl: `${base}/board.json`,
  };
});

const figureById = new Map(FIGURES.map((f) => [f.id, f]));

export const AR_OBJECTS: ARObjectDefinition[] = (config.objects as RawObject[]).map((o) => {
  const figure = figureById.get(o.figure);
  if (!figure) throw new Error(`ar-objects.json: ${o.id} の figure "${o.figure}" がありません`);
  return {
    id: o.id,
    label: o.label ?? figure.name,
    figure,
    spawn: o.spawn as SpawnRule,
    motion: o.motion as MotionRule,
    progressKey: o.progressKey,
  };
});

/**
 * 動作確認用（?near=0.5）：動き回るえびすさん（motion: wander）を、視線の真正面 nearM 先に出す。
 * 「話しかける」（1.0m 以内）を試せるよう、近づきすぎたら離れる距離（minDistanceM）を nearM まで下げ、
 * 歩き回る範囲（radiusM）を nearM × 0.8 に狭める。歩き回りながら、ユーザーからおよそ nearM × 1.8 以内にいる
 * （0.5m なら 0.9m 以内。「出し直す」でまた目の前に出る）
 */
export function withNearSpawn(objects: ARObjectDefinition[], nearM: number): ARObjectDefinition[] {
  return objects.map((o) =>
    o.motion.type !== "wander"
      ? o
      : {
          ...o,
          spawn: { type: "ahead", distanceM: [nearM, nearM], spreadDeg: 0 },
          motion: {
            ...o.motion,
            minDistanceM: Math.min(o.motion.minDistanceM ?? 0.8, nearM),
            radiusM: Math.min(o.motion.radiusM, nearM * 0.8),
          },
        },
  );
}

const entryByKey = new Map(gachaPool.map((e) => [e.key, e]));
/** 同じ画面に同じ像が重なったときに引き直す回数 */
const REDRAW = 5;

/**
 * 各オブジェクトがどの図鑑の像かを決める。AR の開始時と「出し直す」のときに呼ぶ。
 * progressKey があればその像、無ければガチャと同じ確率（lib/gacha.ts の pick）で 1 体を引く。
 * 同じ画面に同じ像が重ならないよう、重なったら数回引き直す
 */
export function drawStatues(objects: ARObjectDefinition[]): Record<string, Entry> {
  const used = new Set<string>();
  const out: Record<string, Entry> = {};
  for (const o of objects) {
    const fixed = o.progressKey ? entryByKey.get(o.progressKey) : undefined;
    let e = fixed ?? pick();
    for (let i = 0; !fixed && used.has(e.key) && i < REDRAW; i++) e = pick();
    used.add(e.key);
    out[o.id] = e;
  }
  return out;
}
