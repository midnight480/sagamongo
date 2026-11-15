/**
 * 位置情報（GPS）と方位を three.js のワールド座標に結びつけるための純粋関数群。
 * 移植元: ar-ebisu-sample/lib/geo.ts
 * ワールド座標: 原点 = AR 開始後に最初に採用した測位地点、+X = 東、-Z = 北、単位 m。
 */

export const GEO_CONFIG = {
  /** これより精度（誤差半径）が悪い測位は捨てる（m） */
  maxAccuracyM: 30,
  /** 歩行で増える位置の不確かさ（m²/s）。大きいほど新しい測位に素早く追従する */
  processNoise: 2,
  /** 描画上のユーザー位置を推定位置へ寄せる時定数（s） */
  positionTimeConstant: 0.8,
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

/** 測位を平滑化した推定位置（簡易カルマンフィルタ。x, z で分散を共有） */
export type PositionEstimate = Local & {
  /** 推定の分散（m²） */
  variance: number;
  /** 最後に更新した測位時刻（ms） */
  timestamp: number;
};

/**
 * 新しい測位で推定位置を更新する。誤差の大きい測位ほど少しだけ動かす。
 * 精度が maxAccuracyM より悪い測位は無視して prev をそのまま返す。
 */
export function updatePositionEstimate(
  prev: PositionEstimate | null,
  measured: Local,
  accuracy: number,
  timestamp: number,
): PositionEstimate | null {
  if (accuracy > GEO_CONFIG.maxAccuracyM) return prev;
  const measurementVariance = accuracy * accuracy;
  if (!prev) return { ...measured, variance: measurementVariance, timestamp };

  const dt = Math.max(0, (timestamp - prev.timestamp) / 1000);
  const predicted = prev.variance + GEO_CONFIG.processNoise * dt;
  const gain = predicted / (predicted + measurementVariance);
  return {
    x: prev.x + gain * (measured.x - prev.x),
    z: prev.z + gain * (measured.z - prev.z),
    variance: (1 - gain) * predicted,
    timestamp,
  };
}
