"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type OrientationSample = {
  alpha: number;
  beta: number;
  gamma: number;
};

type PermissionState = "unknown" | "granted" | "denied" | "unsupported";

type IOSDeviceOrientationEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

/** iOS Safari は deviceorientation にコンパス方位（北から時計回りの度）を載せる */
type IOSOrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };

const toSample = (e: DeviceOrientationEvent): OrientationSample | null =>
  e.alpha === null || e.beta === null || e.gamma === null ? null : { alpha: e.alpha, beta: e.beta, gamma: e.gamma };

/**
 * DeviceOrientationEvent を購読し、最新値を ref で返す（毎フレーム読むため state にしない）。
 * - sampleRef: 相対的な姿勢（カメラの回転に使う）
 * - compassHeadingRef: iOS のコンパス方位（度, 北=0 時計回り）
 * - absoluteSampleRef: Android の絶対姿勢（alpha が北基準）。方位はここから計算する
 * iOS では requestPermission() をユーザー操作の中で呼ぶ必要がある。
 */
export function useDeviceOrientation() {
  const sampleRef = useRef<OrientationSample | null>(null);
  const compassHeadingRef = useRef<number | null>(null);
  const absoluteSampleRef = useRef<OrientationSample | null>(null);
  const [permission, setPermission] = useState<PermissionState>("unknown");
  const [hasSensor, setHasSensor] = useState(false);

  /** ユーザー操作（タップ）のハンドラ内から呼ぶこと */
  const requestPermission = useCallback(async (): Promise<PermissionState> => {
    if (typeof window === "undefined" || typeof DeviceOrientationEvent === "undefined") {
      setPermission("unsupported");
      return "unsupported";
    }
    const Ctor = DeviceOrientationEvent as IOSDeviceOrientationEvent;
    if (typeof Ctor.requestPermission !== "function") {
      setPermission("granted");
      return "granted";
    }
    try {
      const result = await Ctor.requestPermission();
      setPermission(result);
      return result;
    } catch {
      setPermission("denied");
      return "denied";
    }
  }, []);

  useEffect(() => {
    if (permission !== "granted") return;
    const onOrientation = (e: DeviceOrientationEvent) => {
      const sample = toSample(e);
      if (!sample) return;
      sampleRef.current = sample;
      const heading = (e as IOSOrientationEvent).webkitCompassHeading;
      if (typeof heading === "number" && heading >= 0) compassHeadingRef.current = heading;
      setHasSensor(true);
    };
    const onAbsolute = (e: DeviceOrientationEvent) => {
      const sample = toSample(e);
      if (sample) absoluteSampleRef.current = sample;
    };
    window.addEventListener("deviceorientation", onOrientation);
    window.addEventListener("deviceorientationabsolute", onAbsolute);
    return () => {
      window.removeEventListener("deviceorientation", onOrientation);
      window.removeEventListener("deviceorientationabsolute", onAbsolute);
    };
  }, [permission]);

  return { sampleRef, compassHeadingRef, absoluteSampleRef, permission, hasSensor, requestPermission };
}
