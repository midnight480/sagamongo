"use client";

import { useEffect, useRef } from "react";

/** カメラ映像を全画面背景として表示する */
export function CameraBackground({ stream }: { stream: MediaStream | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    if (stream) video.play().catch(() => {});
  }, [stream]);

  if (!stream) {
    return <div className="ar-fallback-bg" />;
  }
  return (
    <video
      ref={videoRef}
      className="ar-video"
      autoPlay
      muted
      playsInline
    />
  );
}
