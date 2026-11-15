/**
 * 位置情報（GPS）と方位を three.js のワールド座標に結びつけるための純粋関数群。
 * 移植元: ar-ebisu-sample/lib/geo.ts
 * ワールド座標: 原点 = AR 開始後の最初の測位地点（以後は変えない）、+X = 東、-Z = 北、単位 m。
 */

export const GEO_CONFIG = {
  /**
   * 描画上のユーザー位置を最新の測位へ寄せる時定数（s）。測位の飛びを見せないためだけのもので、
   * 歩く速さ（1.4 m/s）でも遅れは 0.3m 程度。0 にすると測位をそのまま使う
   */
  positionTimeConstant: 0.2,
  /** 方位のずれ（コンパス補正）を滑らかにする時定数（s） */
  headingTimeConstant: 1,
  /** キー操作による仮想移動の速さ（m/s） */
  virtualSpeed: 1.4,
} as const;

export type LatLng = { lat: number; lng: number };

export type GeoFix = LatLng & {
  /** 誤差半径（m, 68%） */
  accuracy: number;
  /** 測位時刻（ms） */
  timestamp: number;
};

export type Local = { x: number; z: number };

const EARTH_RADIUS_M = 6378137;
const DEG = Math.PI / 180;

/** 緯度経度 → origin を原点とするローカル座標（正距円筒近似。数 km 以内なら十分な精度） */
export function toLocal(origin: LatLng, p: LatLng): Local {
  const east = (p.lng - origin.lng) * DEG * EARTH_RADIUS_M * Math.cos(origin.lat * DEG);
  const north = (p.lat - origin.lat) * DEG * EARTH_RADIUS_M;
  return { x: east, z: -north };
}
