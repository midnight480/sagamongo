// 人物の向きとカメラの位置から、見せる面を決める（React / three 非依存）。
// 素材の面の数（views）で決め方が変わる。
//   二面（front / back）: θ < 90° なら正面、それ以上は背面。真横でも板は進行方向を向いたまま
//   三面（front / side / back）: θ < frontDeg で正面、θ > backDeg で背面、間は側面
// 移植元: ar-ebisu-sample/lib/facing.ts（views による分岐を足した）

import { DEG, headingToDir } from './angle';
import type { FigureFace } from './objects';

/** 三面のときの面切り替えの角度しきい値（度） */
export type FacingThresholds = {
  /** θ がこれ未満なら正面 */
  frontDeg: number;
  /** θ がこれより大きければ背面 */
  backDeg: number;
};

export const DEFAULT_THRESHOLDS: FacingThresholds = { frontDeg: 45, backDeg: 135 };

/** 二面のときは 90° で正面と背面を分ける */
const TWO_VIEW_LIMIT_DEG = 90;

/** 境界でのチラつき防止幅（度） */
const HYSTERESIS_DEG = 8;

export type FacingResult = {
  face: FigureFace;
  /** 進行方向と「人物→カメラ」方向のなす角（rad, 0〜π） */
  theta: number;
  /** カメラが人物の右手側（ローカル +X 側）にいるか。side 看板の向きに使う */
  cameraOnRight: boolean;
  /** 人物の進行方向をローカル +Z に合わせる Y 回転（rad） */
  headingYaw: number;
};

/**
 * 人物の位置・進行方向とカメラ位置から、表示する面を決める。
 * prev を渡すと境界付近でのチラつきを防ぐヒステリシスが効く。
 */
export function resolveFacing(
  figure: { x: number; z: number; heading: number },
  camera: { x: number; z: number },
  views: readonly FigureFace[],
  thresholds: FacingThresholds = DEFAULT_THRESHOLDS,
  prev?: FigureFace,
): FacingResult {
  const tx = camera.x - figure.x;
  const tz = camera.z - figure.z;
  const len = Math.hypot(tx, tz) || 1;
  const nx = tx / len;
  const nz = tz / len;
  const dir = headingToDir(figure.heading);

  const theta = Math.acos(Math.max(-1, Math.min(1, dir.x * nx + dir.z * nz)));

  // rotation.y = atan2(dir.x, dir.z) のとき、ローカル +X 軸はワールドで (dir.z, -dir.x)
  const cameraOnRight = nx * dir.z - nz * dir.x > 0;

  const h = HYSTERESIS_DEG * DEG;
  let face: FigureFace;
  if (views.includes('side')) {
    const front = thresholds.frontDeg * DEG + (prev === 'front' ? h : prev === 'side' ? -h : 0);
    const back = thresholds.backDeg * DEG + (prev === 'back' ? -h : prev === 'side' ? h : 0);
    face = theta < front ? 'front' : theta > back ? 'back' : 'side';
  } else {
    const limit = TWO_VIEW_LIMIT_DEG * DEG + (prev === 'front' ? h : prev === 'back' ? -h : 0);
    face = theta < limit ? 'front' : 'back';
  }
  // 背面の画像が無い素材は、裏にも正面を貼っている
  if (face === 'back' && !views.includes('back')) face = 'front';

  return { face, theta, cameraOnRight, headingYaw: Math.atan2(dir.x, dir.z) };
}
