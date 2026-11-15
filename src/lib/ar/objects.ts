// AR に置くものの定義（src/data/ar-objects.json）を型付きで読む。
// 定義は 2 段に分かれている。
//   figures: 素材（見た目）。画像の面の数（views）と身長。scripts/prepare-figure.mjs も同じファイルを読む
//   objects: 置き方。どの素材を、どう出して（spawn）、どう動かすか（motion）
// 同じ素材を、出方・動き方を変えて何体でも置ける。

import config from '@/data/ar-objects.json';
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
  /** 図鑑（lib/progress.ts）の key。「話しかける」（lib/nearby.ts）で、この像として図鑑に登録する */
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
