'use client';

// three.js とブラウザ API を使うので、AR 画面はクライアントだけで描画する。
// dynamic(..., { ssr: false }) はクライアントコンポーネントの中でしか使えないため、この薄いラッパーを挟む。

import dynamic from 'next/dynamic';
import { AR_OBJECTS } from '@/lib/ar/objects';
import { Frame } from '@/components/Frame';

const ARView = dynamic(() => import('@/components/ar/ARView'), {
  ssr: false,
  loading: () => <div className="ar-view" />,
});

export default function ARClient() {
  // トップと同じ枠（図鑑・ガチャ・HUD・ミニマップなど）を AR 画面の上に重ねる
  return <Frame stage={<ARView objects={AR_OBJECTS} title="えびすさんを探そう（デモ）" />} />;
}
