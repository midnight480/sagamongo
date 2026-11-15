"use client";

// AR に置くもの 1 体。定義の spawn で出現し、motion で動き、見る向きで面を切り替える。
// 移植元: ar-ebisu-sample/components/ar/WanderingFigure.tsx（歩き方・出方を lib/ar/behaviors.ts の種類で切り替える形にした）

import { useFrame } from "@react-three/fiber";
import { useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { angleDiff, smoothing } from "@/lib/ar/angle";
import { guideRadiusOf, spawnActor, type Actor } from "@/lib/ar/behaviors";
import { resolveFacing, type FacingThresholds } from "@/lib/ar/facing";
import type { ARObjectDefinition, FigureFace } from "@/lib/ar/objects";
import { FigureBoard, type FigureBoardApi } from "./FigureBoard";
import type { DebugInfo, UserState } from "./types";

/** 起動直後はセンサー値が安定するまで待ってから出現させる（s） */
const SPAWN_DELAY = 0.5;
/** 1 歩の長さ（m）と歩行アニメの振幅。ゆっくり落ち着いた歩き方にする */
const STEP_LENGTH = 0.45;
const BOB_HEIGHT = 0.02;
const SWAY_ANGLE = 2 * THREE.MathUtils.DEG2RAD;
/** 看板が向きを切り替えるときの回転の時定数（s） */
const PIVOT_TIME_CONSTANT = 0.08;

const forward = new THREE.Vector3();

type Props = {
  object: ARObjectDefinition;
  thresholds: FacingThresholds;
  /** 値が変わると出方に従って出し直す */
  spawnKey: number;
  /** 活動範囲（ホーム中心の円）を地面に表示する */
  showGuide: boolean;
  userRef: RefObject<UserState>;
  debugRef: RefObject<DebugInfo>;
};

export function SceneObject({ object, thresholds, spawnKey, showGuide, userRef, debugRef }: Props) {
  const { figure } = object;
  const boardRef = useRef<FigureBoardApi>(null);
  const guideRef = useRef<THREE.Mesh>(null);
  const actorRef = useRef<Actor | null>(null);
  const spawnedKeyRef = useRef<number | null>(null);
  const faceRef = useRef<FigureFace>("front");
  const [spawned, setSpawned] = useState(false);
  const guideRadius = guideRadiusOf(object.motion);

  useFrame(({ camera, clock }, delta) => {
    const board = boardRef.current;
    if (!board) return;
    const now = clock.elapsedTime;
    const dt = Math.min(delta, 0.1);

    camera.getWorldDirection(forward);
    const ctx = {
      now,
      user: { x: camera.position.x, z: camera.position.z },
      cameraYaw: Math.atan2(forward.x, -forward.z),
      origin: userRef.current.origin,
      rand: Math.random,
    };

    if (spawnedKeyRef.current !== spawnKey && now >= SPAWN_DELAY) {
      const actor = spawnActor(object.spawn, object.motion, ctx);
      if (actor) {
        actorRef.current = actor;
        spawnedKeyRef.current = spawnKey;
        if (!spawned) setSpawned(true);
      }
    }
    const actor = actorRef.current;
    board.root.visible = actor !== null;
    if (!actor) return;

    actor.step(dt, ctx);
    const s = actor.body;
    guideRef.current?.position.set(s.homeX, 0.001, s.homeZ);

    const facing = resolveFacing(s, camera.position, figure.views, thresholds, faceRef.current);
    faceRef.current = facing.face;

    // 看板は進行方向を向く（カメラの方は向かない）
    board.root.position.set(s.x, 0, s.z);
    board.root.rotation.y = facing.headingYaw;

    // 正面/背面は進行方向に正対した表裏の看板、側面（三面の素材だけ）はカメラ側へ 90° 回した看板
    const isSide = facing.face === "side" && board.side !== null;
    board.frontBack.visible = !isSide;
    if (board.side) {
      board.side.visible = isSide;
      // 元の側面画像は左向き。左手側から見るときは反転して進行方向を向かせる
      board.side.scale.x = facing.cameraOnRight ? 1 : -1;
    }
    const pivotTarget = isSide ? (facing.cameraOnRight ? Math.PI / 2 : -Math.PI / 2) : 0;
    board.pivot.rotation.y += angleDiff(board.pivot.rotation.y, pivotTarget) * smoothing(dt, PIVOT_TIME_CONSTANT);

    // 歩行アニメ：歩数に合わせた小さな上下動と左右の揺れ。停止中は徐々に戻す
    const phase = (s.distance / STEP_LENGTH) * Math.PI;
    const k = smoothing(dt, 0.15);
    const targetY = s.walking ? Math.abs(Math.sin(phase)) * BOB_HEIGHT : 0;
    const targetSway = s.walking ? Math.sin(phase) * SWAY_ANGLE : 0;
    board.body.position.y += (targetY - board.body.position.y) * k;
    board.body.rotation.z += (targetSway - board.body.rotation.z) * k;

    const horizontal = Math.hypot(s.x - camera.position.x, s.z - camera.position.z);
    debugRef.current.objects[object.id] = {
      label: object.label,
      spawned: true,
      x: s.x,
      z: s.z,
      headingDeg: THREE.MathUtils.radToDeg(s.heading),
      homeX: s.homeX,
      homeZ: s.homeZ,
      guideRadiusM: guideRadius,
      distance: horizontal,
      lookDownDeg: THREE.MathUtils.radToDeg(Math.atan2(camera.position.y - figure.heightM / 2, horizontal)),
      thetaDeg: THREE.MathUtils.radToDeg(facing.theta),
      face: facing.face,
      flipped: isSide && !facing.cameraOnRight,
      status: actor.describe(now),
    };
  });


  return (
    <>
      <FigureBoard ref={boardRef} figure={figure} label={object.label} showLabel={spawned} />
      {/* 活動範囲（ホーム中心の円）。位置は毎フレーム更新 */}
      {guideRadius !== null && (
        <mesh ref={guideRef} rotation-x={-Math.PI / 2} visible={showGuide && spawned}>
          <ringGeometry args={[guideRadius - 0.03, guideRadius + 0.03, 96]} />
          <meshBasicMaterial color="#ffd54a" transparent opacity={0.7} />
        </mesh>
      )}
    </>
  );
}
