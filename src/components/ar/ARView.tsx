"use client";

// カメラ映像 + 3D シーン + 操作 UI。権限の要求は「AR を開始」ボタンのタップの中で行う（iOS の制約）。
// 移植元: ar-ebisu-sample/components/ar/ARView.tsx（定義の配列を受け取り、何体でも並べられるようにした）

import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState, type PointerEvent } from "react";
import { useCameraStream } from "@/hooks/useCameraStream";
import { useDeviceOrientation } from "@/hooks/useDeviceOrientation";
import { useGeolocation } from "@/hooks/useGeolocation";
import { describeSpawn } from "@/lib/ar/behaviors";
import { DEFAULT_THRESHOLDS, type FacingThresholds } from "@/lib/ar/facing";
import type { ARObjectDefinition } from "@/lib/ar/objects";
import { CameraBackground } from "./CameraBackground";
import { DebugPanel } from "./DebugPanel";
import { OrientationCamera } from "./OrientationCamera";
import { SceneObject } from "./SceneObject";
import { createDebugInfo, createUserState, type DebugInfo, type DragLook, type UserState } from "./types";
import { UserLocomotion } from "./UserLocomotion";
import * as nearby from "@/lib/nearby";

/** 「話しかける」（フレーム側）に、えびすさんとの距離を知らせる間隔（ms） */
const NEARBY_INTERVAL_MS = 150;

const DRAG_SENSITIVITY = 0.005;
const MAX_PITCH = Math.PI / 2 - 0.05;

type Props = {
  /** 置くもの。lib/ar/objects.ts の AR_OBJECTS など */
  objects: ARObjectDefinition[];
  /** 左上に出す見出し */
  title: string;
};

export default function ARView({ objects, title }: Props) {
  const camera = useCameraStream();
  const orientation = useDeviceOrientation();
  const geo = useGeolocation();

  const [started, setStarted] = useState(false);
  const [thresholds, setThresholds] = useState<FacingThresholds>(DEFAULT_THRESHOLDS);
  const [eyeHeight, setEyeHeight] = useState(1.5);
  const [fov, setFov] = useState(60);
  const [showGuide, setShowGuide] = useState(false);
  const [spawnKey, setSpawnKey] = useState(0);

  const debugRef = useRef<DebugInfo>(createDebugInfo());
  const userRef = useRef<UserState>(createUserState());
  const dragRef = useRef<DragLook>({ yaw: 0, pitch: -0.25 });
  const lastPointer = useRef<{ x: number; y: number } | null>(null);

  // フレーム側の「話しかける」ボタンに、各えびすさんとの水平距離（SceneObject が毎フレーム debugRef に書く値）を知らせる
  useEffect(() => {
    if (!started) return;
    const id = setInterval(() => {
      const info = debugRef.current.objects;
      nearby.report(objects.map((o) => ({
        id: o.id,
        label: o.label,
        progressKey: o.progressKey,
        spawned: Boolean(info[o.id]?.spawned),
        distM: info[o.id]?.distance ?? Infinity,
      })));
    }, NEARBY_INTERVAL_MS);
    return () => {
      clearInterval(id);
      nearby.clear();
    };
  }, [started, objects]);

  const handleStart = async () => {
    // iOS では、タップのハンドラ内で await する前に許可の要求を始める必要がある
    const permission = orientation.requestPermission();
    const stream = camera.start();
    geo.start();
    await Promise.all([permission, stream]);
    setStarted(true);
  };

  const onPointerDown = (e: PointerEvent) => {
    lastPointer.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerMove = (e: PointerEvent) => {
    if (orientation.hasSensor || !lastPointer.current) return;
    const look = dragRef.current;
    look.yaw += (e.clientX - lastPointer.current.x) * DRAG_SENSITIVITY;
    look.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, look.pitch + (e.clientY - lastPointer.current.y) * DRAG_SENSITIVITY));
    lastPointer.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = () => {
    lastPointer.current = null;
  };

  const sensorLabel = orientation.hasSensor
    ? "端末の向き"
    : orientation.permission === "denied"
      ? "拒否（ドラッグ操作）"
      : "なし（ドラッグ操作）";

  const spawnHints = [...new Set(objects.map((o) => describeSpawn(o.spawn)))].join("・");

  return (
    <div className="ar-view">
      <CameraBackground stream={camera.stream} />

      {started && (
        <div className="ar-canvas" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
          <Canvas gl={{ alpha: true, antialias: true }} dpr={[1, 2]}>
            <UserLocomotion fixRef={geo.fixRef} fixCountRef={geo.fixCountRef} userRef={userRef} />
            <OrientationCamera
              sampleRef={orientation.sampleRef}
              compassHeadingRef={orientation.compassHeadingRef}
              absoluteSampleRef={orientation.absoluteSampleRef}
              hasSensor={orientation.hasSensor}
              dragRef={dragRef}
              userRef={userRef}
              eyeHeight={eyeHeight}
              fov={fov}
              debugRef={debugRef}
            />
            {/* 看板の縁・木口に陰影をつけて厚みが分かるようにする（写真は光の影響を受けない） */}
            <ambientLight intensity={1.6} />
            <directionalLight position={[2, 4, 3]} intensity={1.8} />
            {objects.map((o) => (
              <Suspense key={o.id} fallback={null}>
                <SceneObject
                  object={o}
                  thresholds={thresholds}
                  spawnKey={spawnKey}
                  showGuide={showGuide}
                  userRef={userRef}
                  debugRef={debugRef}
                />
              </Suspense>
            ))}
          </Canvas>
        </div>
      )}

      <div className="ar-ui">
        <div className="ar-title">
          <p className="ar-title-name">{title}</p>
          {camera.error && <p className="ar-title-error">カメラ: {camera.error}</p>}
        </div>

        {started ? (
          <DebugPanel
            objects={objects.map((o) => ({ id: o.id, label: o.label }))}
            showThresholds={objects.some((o) => o.figure.views.includes("side"))}
            debugRef={debugRef}
            userRef={userRef}
            geoFixRef={geo.fixRef}
            geoFixCountRef={geo.fixCountRef}
            geoStatus={geo.status}
            geoError={geo.error}
            sensorLabel={sensorLabel}
            eyeHeight={eyeHeight}
            onEyeHeightChange={setEyeHeight}
            fov={fov}
            onFovChange={setFov}
            thresholds={thresholds}
            onThresholdsChange={setThresholds}
            showGuide={showGuide}
            onShowGuideChange={setShowGuide}
            onRespawn={() => setSpawnKey((k) => k + 1)}
          />
        ) : (
          <div className="ar-start">
            <p className="ar-start-title">カメラ・モーションセンサー・位置情報を使います</p>
            <p className="ar-start-text">
              開始すると、{spawnHints}にえびすさんが現れます。歩いて近づいたり、回り込んで後ろ姿を見たりできます。
            </p>
            <button type="button" className="btn btn-primary ar-start-button" onClick={handleStart}>
              AR を開始
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
