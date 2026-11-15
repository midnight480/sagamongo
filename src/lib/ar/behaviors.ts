// AR に置くものの「出方（spawn）」と「動き方（motion）」。React / three 非依存の純粋関数。
// 種類を足すときは、型（SpawnRule / MotionRule）に 1 行足し、下の表（SPAWNS / MOTIONS）に実装を 1 つ足す。
// 座標は three.js の XZ 平面（m）。+X = 東、-Z = 北。heading の方向ベクトルは (cos h, sin h)。
// 移植元: ar-ebisu-sample/lib/wander.ts（設定を定義ごとに持てるようにし、種類で切り替える形にした）

import { angleDiff, DEG, headingToDir, smoothing, TAU } from './angle';
import { toLocal, type LatLng } from './geo';

type Random = () => number;
type Point = { x: number; z: number };

/** 毎フレーム渡す周りの状況 */
export type BehaviorContext = {
  /** 経過時間（s）。R3F の clock.elapsedTime */
  now: number;
  /** ユーザー（カメラ）の位置 */
  user: Point;
  /** 視線の方位（rad）。北 = 0、東 = +π/2 */
  cameraYaw: number;
  /** ワールド原点の緯度経度。最初の測位までは null */
  origin: LatLng | null;
  rand: Random;
};

/** 描画側が読む、オブジェクトの体の状態 */
export type Body = {
  x: number;
  z: number;
  /** 進行方向（rad） */
  heading: number;
  /** 歩いているか（歩行アニメの on/off） */
  walking: boolean;
  /** 累積の歩行距離（m）。歩行アニメの位相 */
  distance: number;
  /** 出現地点（m）。活動範囲の中心 */
  homeX: number;
  homeZ: number;
};

// ---------------------------------------------------------------- 出方

export type SpawnRule =
  /** 視線の前方 distanceM 先、±spreadDeg の範囲に出る */
  | { type: 'ahead'; distanceM: [number, number]; spreadDeg: number }
  /** 緯度経度で決めた場所に出る。最初の測位（原点）が決まるまでは出ない */
  | { type: 'geo'; lat: number; lng: number };

type SpawnImpl<R> = (rule: R, ctx: BehaviorContext) => Point | null;

const randRange = (rand: Random, [min, max]: [number, number]) => min + rand() * (max - min);

const SPAWNS: { [K in SpawnRule['type']]: SpawnImpl<Extract<SpawnRule, { type: K }>> } = {
  ahead: (rule, { user, cameraYaw, rand }) => {
    const a = cameraYaw + randRange(rand, [-rule.spreadDeg * DEG, rule.spreadDeg * DEG]);
    const r = randRange(rand, rule.distanceM);
    return { x: user.x + Math.sin(a) * r, z: user.z - Math.cos(a) * r };
  },
  geo: (rule, { origin }) => (origin ? toLocal(origin, rule) : null),
};

// ---------------------------------------------------------------- 動き方

export type WanderRule = {
  type: 'wander';
  /** 出現地点からの活動半径（m） */
  radiusM: number;
  /** 歩く速さ（m/s） */
  speedMps: number;
  /** 向きを変える間隔（s） */
  turnIntervalS: number;
  /** 向きを変えるときに立ち止まる確率と時間（s） */
  pauseProbability?: number;
  pauseS?: [number, number];
  /** ユーザーにこれ以上近づかない距離（m） */
  minDistanceM?: number;
  /** 回頭の時定数（s）。小さいほど素早く向きを変える */
  turnTimeConstantS?: number;
};

export type MotionRule =
  /** 出現地点の周りを、ときどき向きを変えながら歩き回る */
  | WanderRule
  /** 出現した場所に立ち止まり、出現したときのユーザーの方を向く（像など） */
  | { type: 'stay' };

/**
 * 動き方 1 種類の実装。M はその動き方だけが持つ内部状態。
 * 表（MOTIONS）に内部状態の違う実装を並べられるよう、メソッド記法で書く（引数の型が双変になる）
 */
type MotionImpl<R, M> = {
  init(rule: R, body: Body, ctx: BehaviorContext): M;
  step(rule: R, body: Body, m: M, dt: number, ctx: BehaviorContext): void;
  /** デバッグ表示用の一言 */
  describe(rule: R, body: Body, m: M, now: number): string;
  /** 地面に描く活動範囲の半径（m）。無ければ null */
  guideRadiusM(rule: R): number | null;
};

type WanderMemo = { targetHeading: number; nextTurnAt: number; pausedUntil: number };

const wander: MotionImpl<WanderRule, WanderMemo> = {
  init: (rule, body, { now }) => ({ targetHeading: body.heading, nextTurnAt: now + rule.turnIntervalS, pausedUntil: 0 }),
  step: (rule, body, m, dt, { now, user, rand }) => {
    if (now >= m.nextTurnAt) {
      m.targetHeading = rand() * TAU;
      m.nextTurnAt = now + rule.turnIntervalS;
      m.pausedUntil = rand() < (rule.pauseProbability ?? 0.3) ? now + randRange(rand, rule.pauseS ?? [1.5, 3]) : 0;
    }

    // 境界：活動範囲の外へ向かっていればホームへ、ユーザーに近づきすぎていれば反対へ
    const dir = headingToDir(body.heading);
    const hx = body.x - body.homeX;
    const hz = body.z - body.homeZ;
    const ux = body.x - user.x;
    const uz = body.z - user.z;
    if (Math.hypot(hx, hz) > rule.radiusM - 0.1 && dir.x * hx + dir.z * hz > 0) m.targetHeading = Math.atan2(-hz, -hx);
    else if (Math.hypot(ux, uz) < (rule.minDistanceM ?? 0.8) && dir.x * ux + dir.z * uz < 0) m.targetHeading = Math.atan2(uz, ux);

    body.heading += angleDiff(body.heading, m.targetHeading) * smoothing(dt, rule.turnTimeConstantS ?? 0.6);
    body.walking = now >= m.pausedUntil;
    if (body.walking) {
      const next = headingToDir(body.heading);
      const d = rule.speedMps * dt;
      body.x += next.x * d;
      body.z += next.z * d;
      body.distance += d;
    }
  },
  describe: (_rule, body, m, now) =>
    `${body.walking ? '歩行中' : '停止中'} / 次の方向転換まで ${Math.max(0, m.nextTurnAt - now).toFixed(1)}s`,
  guideRadiusM: (rule) => rule.radiusM,
};

const stay: MotionImpl<{ type: 'stay' }, null> = {
  init: (_rule, body, { user }) => {
    body.heading = Math.atan2(user.z - body.z, user.x - body.x);
    return null;
  },
  step: (_rule, body) => {
    body.walking = false;
  },
  describe: () => '立ち止まっている',
  guideRadiusM: () => null,
};

// ---------------------------------------------------------------- まとめ

const MOTIONS: { [K in MotionRule['type']]: MotionImpl<Extract<MotionRule, { type: K }>, unknown> } = { wander, stay };

/** 定義ファイルの typo などで知らない種類が来たら例外にする（気づけるように） */
function motionImpl(rule: MotionRule): MotionImpl<MotionRule, unknown> {
  const impl = MOTIONS[rule.type] as MotionImpl<MotionRule, unknown> | undefined;
  if (!impl) throw new Error(`知らない motion の種類です: ${rule.type}`);
  return impl;
}

/** 動いているオブジェクト 1 体。内部状態の型は外に見せない */
export type Actor = {
  body: Body;
  step: (dt: number, ctx: BehaviorContext) => void;
  describe: (now: number) => string;
};

/** 出方に従って出現させ、動き方の Actor を作る。まだ出られない（geo で原点が未定など）ときは null */
export function spawnActor(spawn: SpawnRule, motion: MotionRule, ctx: BehaviorContext): Actor | null {
  const spawnImpl = SPAWNS[spawn.type] as SpawnImpl<SpawnRule> | undefined;
  if (!spawnImpl) throw new Error(`知らない spawn の種類です: ${spawn.type}`);
  const impl = motionImpl(motion);

  const at = spawnImpl(spawn, ctx);
  if (!at) return null;
  const body: Body = { x: at.x, z: at.z, homeX: at.x, homeZ: at.z, heading: ctx.rand() * TAU, walking: false, distance: 0 };
  const m = impl.init(motion, body, ctx);
  return {
    body,
    step: (dt, c) => impl.step(motion, body, m, dt, c),
    describe: (now) => impl.describe(motion, body, m, now),
  };
}

/** 地面に描く活動範囲の半径（m）。動き方に範囲が無ければ null */
export function guideRadiusOf(motion: MotionRule): number | null {
  return motionImpl(motion).guideRadiusM(motion);
}

/** 画面の説明文用：出方の距離の目安（m） */
export function describeSpawn(spawn: SpawnRule): string {
  return spawn.type === 'ahead' ? `${spawn.distanceM[0]}〜${spawn.distanceM[1]}m 先` : '決まった場所';
}
