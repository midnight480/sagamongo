// 角度のユーティリティ（React / three 非依存）
// heading（進行方向）の方向ベクトルは (cos h, sin h)。yaw（視線方位）は (sin y, -cos y)。取り違えに注意。

export const DEG = Math.PI / 180;
export const TAU = Math.PI * 2;

/** a→b の最短角度差（-π〜π） */
export function angleDiff(a: number, b: number): number {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

/** 時定数 tau（s）で角度 current を target へ寄せる */
export function lowPassAngle(current: number, target: number, dt: number, tau: number): number {
  return current + angleDiff(current, target) * smoothing(dt, tau);
}

/** 時定数 tau で target に近づける係数 */
export function smoothing(dt: number, tau: number): number {
  return 1 - Math.exp(-dt / tau);
}

/** heading の方向ベクトル */
export function headingToDir(h: number): { x: number; z: number } {
  return { x: Math.cos(h), z: Math.sin(h) };
}
