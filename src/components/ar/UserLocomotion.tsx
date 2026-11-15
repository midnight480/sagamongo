"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { GEO_CONFIG, toLocal, updatePositionEstimate, type GeoFix } from "@/lib/ar/geo";
import type { UserState } from "./types";

/** 仮想移動に使うキー → [前, 右] */
const KEY_MOVES: Record<string, [number, number]> = {
  KeyW: [1, 0],
  ArrowUp: [1, 0],
  KeyS: [-1, 0],
  ArrowDown: [-1, 0],
  KeyA: [0, -1],
  ArrowLeft: [0, -1],
  KeyD: [0, 1],
  ArrowRight: [0, 1],
};

const forward = new THREE.Vector3();

type Props = {
  fixRef: RefObject<GeoFix | null>;
  fixCountRef: RefObject<number>;
  userRef: RefObject<UserState>;
};

/**
 * ユーザーの現実空間での位置を毎フレーム更新する。
 * GPS の測位 → ローカル座標 → 精度重み付きで平滑化 → 描画位置へ滑らかに寄せる。
 * PC などでは WASD / 矢印キーで仮想的に歩ける（GPS 位置に加算される）。
 */
export function UserLocomotion({ fixRef, fixCountRef, userRef }: Props) {
  const pressedRef = useRef(new Set<string>());

  useEffect(() => {
    const pressed = pressedRef.current;
    const onDown = (e: KeyboardEvent) => {
      if (e.code in KEY_MOVES) pressed.add(e.code);
    };
    const onUp = (e: KeyboardEvent) => pressed.delete(e.code);
    const onBlur = () => pressed.clear();
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  useFrame(({ camera }, delta) => {
    const user = userRef.current;
    const dt = Math.min(delta, 0.1);

    // 新しい測位があれば推定位置を更新（最初に採用した測位がワールドの原点になる）
    const fix = fixRef.current;
    if (fix && fixCountRef.current !== user.lastFixCount) {
      user.lastFixCount = fixCountRef.current;
      if (!user.origin && fix.accuracy <= GEO_CONFIG.maxAccuracyM) user.origin = { lat: fix.lat, lng: fix.lng };
      if (user.origin) {
        user.estimate = updatePositionEstimate(user.estimate, toLocal(user.origin, fix), fix.accuracy, fix.timestamp);
      }
    }

    // キー操作による仮想移動（視線の水平方向を前とする）
    let moveForward = 0;
    let moveRight = 0;
    for (const code of pressedRef.current) {
      moveForward += KEY_MOVES[code][0];
      moveRight += KEY_MOVES[code][1];
    }
    camera.getWorldDirection(forward);
    forward.y = 0;
    if ((moveForward || moveRight) && forward.lengthSq() > 1e-6) {
      forward.normalize();
      const len = Math.hypot(moveForward, moveRight);
      const step = (GEO_CONFIG.virtualSpeed * dt) / len;
      // 右方向 = 前方を時計回りに 90°: (-f.z, f.x)
      user.virtualX += (forward.x * moveForward - forward.z * moveRight) * step;
      user.virtualZ += (forward.z * moveForward + forward.x * moveRight) * step;
    }

    // GPS の更新だけを滑らかにし（ジャンプを見せない）、キー操作の移動量はそのまま足す
    if (user.estimate) {
      const k = 1 - Math.exp(-dt / GEO_CONFIG.positionTimeConstant);
      user.smoothX += (user.estimate.x - user.smoothX) * k;
      user.smoothZ += (user.estimate.z - user.smoothZ) * k;
    }
    user.x = user.smoothX + user.virtualX;
    user.z = user.smoothZ + user.virtualZ;
  });

  return null;
}
