// 画面の状態をつなぐ小さな仕組み（React から使う）
// ・useProgress：記録（lib/progress.ts）が変わったら描き直す
// ・toast：画面上のお知らせ（4秒で消える）

'use client';

import { useSyncExternalStore } from 'react';
import * as progress from './progress';

export function useProgress() {
  useSyncExternalStore(progress.subscribe, progress.getVersion, () => 0);
  return progress.get();
}

// ---------- お知らせ ----------

let toastText: string | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
const toastListeners = new Set<() => void>();
const emit = () => toastListeners.forEach((fn) => fn());

export function toast(text: string) {
  toastText = text;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastText = null; emit(); }, 4000);
  emit();
}

export function useToast() {
  return useSyncExternalStore(
    (fn) => { toastListeners.add(fn); return () => { toastListeners.delete(fn); }; },
    () => toastText,
    () => null,
  );
}

// 「12分05秒」の形
export function formatMs(ms: number) {
  const sec = Math.round(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h ? `${h}時間` : ''}${m}分${String(s).padStart(2, '0')}秒`;
}

export const formatKm = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(2)}km` : `${Math.round(m)}m`);
