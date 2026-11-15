'use client';

// BGM のオン／オフ。ブラウザは人が触れるまで音を出せないので、最初に画面に触れたときに鳴り始める。
// 画面を裏に回したら止め、戻ったら続きから鳴らす。

import { useEffect, useSyncExternalStore } from 'react';
import * as bgm from '@/lib/bgm';

export function BgmButton() {
  const enabled = useSyncExternalStore(bgm.subscribe, bgm.isEnabled, () => true);

  useEffect(() => {
    const first = () => bgm.start();
    window.addEventListener('pointerdown', first, { once: true });
    window.addEventListener('keydown', first, { once: true });
    const vis = () => bgm.onVisibility(document.hidden);
    document.addEventListener('visibilitychange', vis);
    return () => {
      window.removeEventListener('pointerdown', first);
      window.removeEventListener('keydown', first);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);

  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      aria-pressed={enabled}
      onClick={() => bgm.setEnabled(!enabled)}
    >
      {enabled ? 'BGM オン' : 'BGM オフ'}
    </button>
  );
}
