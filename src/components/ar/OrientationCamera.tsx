"use client";

import { useFrame } from "@react-three/fiber";
import type { RefObject } from "react";
import * as THREE from "three";
import type { OrientationSample } from "@/hooks/useDeviceOrientation";
import { lowPassAngle } from "@/lib/ar/angle";
import { GEO_CONFIG } from "@/lib/ar/geo";
import type { DebugInfo, DragLook, HeadingSource, UserState } from "./types";

const DEG = THREE.MathUtils.DEG2RAD;
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
/** 端末を「画面が上を向いた状態」から「背面カメラが前を向いた状態」へ補正する -90° X 回転 */
const Q_DEVICE_TO_CAMERA = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));

const NEAR = 0.05;
const FAR = 200;

const euler = new THREE.Euler();
const qScreen = new THREE.Quaternion();
const qRelative = new THREE.Quaternion();
const qAbsolute = new THREE.Quaternion();
const qOffset = new THREE.Quaternion();
const qTarget = new THREE.Quaternion();
const forward = new THREE.Vector3();

function screenAngle(): number {
  if (typeof window === "undefined") return 0;
  return window.screen?.orientation?.angle ?? 0;
}

/** DeviceOrientation（度）からカメラの quaternion を求める（three.js 旧 DeviceOrientationControls と同等） */
function orientationToQuaternion(s: OrientationSample, out: THREE.Quaternion): THREE.Quaternion {
  euler.set(s.beta * DEG, s.alpha * DEG, -s.gamma * DEG, "YXZ");
  out.setFromEuler(euler);
  out.multiply(Q_DEVICE_TO_CAMERA);
  out.multiply(qScreen.setFromAxisAngle(Z_AXIS, -screenAngle() * DEG));
  return out;
}

/** カメラの水平方位（rad）。北(-Z) = 0、東(+X) = +π/2 の時計回り */
export function yawOf(q: THREE.Quaternion): number {
  forward.set(0, 0, -1).applyQuaternion(q);
  return Math.atan2(forward.x, -forward.z);
}

type Props = {
  sampleRef: RefObject<OrientationSample | null>;
  compassHeadingRef: RefObject<number | null>;
  absoluteSampleRef: RefObject<OrientationSample | null>;
  hasSensor: boolean;
  dragRef: RefObject<DragLook>;
  userRef: RefObject<UserState>;
  eyeHeight: number;
  fov: number;
  debugRef: RefObject<DebugInfo>;
};

/** 真の方位（rad）とその取得元。コンパスが使えなければ null */
function trueHeading(
  compassHeading: number | null,
  absolute: OrientationSample | null,
): { yaw: number; source: HeadingSource } | null {
  if (compassHeading !== null) return { yaw: compassHeading * DEG, source: "ios-compass" };
  if (absolute) return { yaw: yawOf(orientationToQuaternion(absolute, qAbsolute)), source: "absolute" };
  return null;
}

/** 端末の姿勢 + コンパス補正をカメラに反映する */
function followSensor(
  camera: THREE.Camera,
  sample: OrientationSample,
  compassHeading: number | null,
  absolute: OrientationSample | null,
  user: UserState,
  delta: number,
) {
  orientationToQuaternion(sample, qRelative);
  const heading = trueHeading(compassHeading, absolute);
  if (heading) {
    // 相対姿勢の方位を真の方位に合わせるずれ。初回はそのまま採用し、以降は滑らかに追従
    const target = heading.yaw - yawOf(qRelative);
    user.headingOffset =
      user.headingSource === "none" ? target : lowPassAngle(user.headingOffset, target, delta, GEO_CONFIG.headingTimeConstant);
    user.headingSource = heading.source;
  }
  // Y 軸の正回転は方位を減らす向きなので、方位を offset 増やすには -offset 回す
  qOffset.setFromAxisAngle(Y_AXIS, -user.headingOffset);
  qTarget.copy(qOffset).multiply(qRelative);
  // センサーの細かい揺れを軽く平滑化
  camera.quaternion.slerp(qTarget, 0.5);
}

/**
 * カメラをユーザー位置（目の高さ）に置き、回転を端末姿勢（無ければドラッグ）に追従させる。
 * コンパスが使える場合は、ワールドの -Z が真北になるよう相対姿勢に方位補正を掛ける。
 * 移植元: ar-ebisu-sample/components/ar/OrientationCamera.tsx
 */
export function OrientationCamera(props: Props) {
  const { sampleRef, compassHeadingRef, absoluteSampleRef, hasSensor, dragRef, userRef, eyeHeight, fov, debugRef } = props;

  useFrame((state, delta) => {
    const camera = state.camera as THREE.PerspectiveCamera;
    const user = userRef.current;
    camera.position.set(user.x, eyeHeight, user.z);
    if (camera.fov !== fov || camera.far !== FAR) {
      camera.fov = fov;
      camera.near = NEAR;
      camera.far = FAR;
      camera.updateProjectionMatrix();
    }

    const sample = sampleRef.current;
    if (!hasSensor || !sample) {
      const { yaw, pitch } = dragRef.current;
      camera.quaternion.setFromEuler(euler.set(pitch, yaw, 0, "YXZ"));
      user.headingSource = "none";
    } else {
      followSensor(camera, sample, compassHeadingRef.current, absoluteSampleRef.current, user, delta);
    }

    // デバッグ表示用（オブジェクトごとの値は SceneObject が書く）
    const d = debugRef.current;
    camera.getWorldDirection(forward);
    d.cameraYawDeg = THREE.MathUtils.radToDeg(Math.atan2(forward.x, -forward.z));
    d.cameraPitchDeg = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1)));
    d.userX = user.x;
    d.userZ = user.z;
  });

  return null;
}
