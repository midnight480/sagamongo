"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GeoFix } from "@/lib/ar/geo";

export type GeoStatus = "idle" | "watching" | "denied" | "unsupported" | "error";

/**
 * 位置情報を高精度で購読し、最新の測位を ref で返す（毎フレーム読むため state にしない）。
 * fixCountRef は受信した測位の累計（新しい測位が来たかの判定に使う）。
 */
export function useGeolocation() {
  const fixRef = useRef<GeoFix | null>(null);
  const fixCountRef = useRef(0);
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  /** 位置情報の利用を開始する（「開始」ボタンから呼ぶ） */
  const start = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }
    setStatus("watching");
  }, []);

  useEffect(() => {
    if (status !== "watching") return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        fixRef.current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        };
        fixCountRef.current += 1;
        setError(null);
      },
      (e) => {
        if (e.code === e.PERMISSION_DENIED) setStatus("denied");
        setError(e.message);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [status]);

  return { fixRef, fixCountRef, status, error, start };
}
