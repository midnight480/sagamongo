'use client';

// three.js とブラウザ API を使うので、AR 画面はクライアントだけで描画する。
// dynamic(..., { ssr: false }) はクライアントコンポーネントの中でしか使えないため、この薄いラッパーを挟む。

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { AR_OBJECTS, withNearSpawn } from '@/lib/ar/objects';
import { param } from '@/lib/params';
import { Frame } from '@/components/Frame';

const ARView = dynamic(() => import('@/components/ar/ARView'), {
  ssr: false,
  loading: () => <div className="ar-view" />,
});

// 動作確認用：?near=0.5 で、動き回るえびすさんを目の前 0.5m に出す（?near だけなら 0.5m。0.1〜20m）
function nearParam(): number | null {
  const v = param('near');
  if (v == null) return null;
  const m = v === '' ? 0.5 : Number(v);
  return Number.isFinite(m) && m >= 0.1 && m <= 20 ? m : null;
}

export default function ARClient() {
  const objects = useMemo(() => {
    const near = nearParam();
    return near == null ? AR_OBJECTS : withNearSpawn(AR_OBJECTS, near);
  }, []);
  // トップと同じ枠（図鑑・ガチャ・HUD・ミニマップなど）を AR 画面の上に重ねる
  return <Frame stage={<ARView objects={objects} title="えびすさんを探そう（デモ）" />} />;
}
