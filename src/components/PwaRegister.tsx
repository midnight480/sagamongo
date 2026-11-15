'use client';

// Service Worker（public/sw.js）を登録する。開発中（next dev）は古い画面が残って紛らわしいので、本番のビルドだけで登録する。

import { useEffect } from 'react';

export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
      /* 登録できなくても、ふつうの Web ページとして動く */
    });
  }, []);
  return null;
}
