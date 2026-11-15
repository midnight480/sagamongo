import type { FigureFace } from "@/lib/ar/objects";
import type { LatLng } from "@/lib/ar/geo";

export type HeadingSource = "ios-compass" | "absolute" | "none";

/**
 * ユーザー（カメラ）の現実空間での状態。UserLocomotion / OrientationCamera が毎フレーム更新し、
 * 他のコンポーネントは読むだけ。
 * 移植元: ar-ebisu-sample/components/ar/types.ts（デバッグ値を複数オブジェクト対応にした）
 * ワールド座標は +X = 東、-Z = 北、原点 = 最初に採用した測位地点。
 */
export type UserState = {
  /** 描画に使う位置（= 滑らかにした GPS 位置 + 仮想移動量, m） */
  x: number;
  z: number;
  /** GPS 位置へ滑らかに寄せた位置（m） */
  smoothX: number;
  smoothZ: number;
  /** ワールド座標の原点に対応する緯度経度。最初の測位で決まり、ページを開き直すまで変えない */
  origin: LatLng | null;
  /** 最新の測位をそのままローカル座標にした位置（m）。精度での間引き・平滑化はしない */
  gpsX: number;
  gpsZ: number;
  /** 測位を 1 回でも受け取ったか */
  hasFix: boolean;
  /** キー操作で動かした量（GPS 位置に加算, m） */
  virtualX: number;
  virtualZ: number;
  /** 最後に処理した測位の通し番号 */
  lastFixCount: number;
  /** 相対姿勢を真北基準にそろえる角度（rad）と、その取得元 */
  headingOffset: number;
  headingSource: HeadingSource;
};

export const createUserState = (): UserState => ({
  x: 0,
  z: 0,
  smoothX: 0,
  smoothZ: 0,
  origin: null,
  gpsX: 0,
  gpsZ: 0,
  hasFix: false,
  virtualX: 0,
  virtualZ: 0,
  lastFixCount: 0,
  headingOffset: 0,
  headingSource: "none",
});

/** オブジェクト 1 体分のデバッグ値。SceneObject が毎フレーム書く */
export type ObjectDebug = {
  label: string;
  /** 出現済みか（geo で原点が未定のあいだなどは false） */
  spawned: boolean;
  x: number;
  z: number;
  headingDeg: number;
  homeX: number;
  homeZ: number;
  /** 地面に描く活動範囲の半径（m）。無ければ null */
  guideRadiusM: number | null;
  /** ユーザーからの水平距離（m） */
  distance: number;
  /** 目の高さから胴体の中心を見下ろす角度（見下ろしが正） */
  lookDownDeg: number;
  thetaDeg: number;
  face: FigureFace;
  /** 側面の画像を左右反転して見せているか */
  flipped: boolean;
  /** 動き方ごとの状態の一言 */
  status: string;
};

/** 3D シーン側（useFrame）から書き込み、DebugPanel が定期的に読む値 */
export type DebugInfo = {
  cameraYawDeg: number;
  /** カメラの上下の向き（上向きが正） */
  cameraPitchDeg: number;
  userX: number;
  userZ: number;
  /** オブジェクトの id → 値 */
  objects: Record<string, ObjectDebug>;
};

export const createDebugInfo = (): DebugInfo => ({
  cameraYawDeg: 0,
  cameraPitchDeg: 0,
  userX: 0,
  userZ: 0,
  objects: {},
});

/** PC でのドラッグ視点操作用 */
export type DragLook = { yaw: number; pitch: number };
