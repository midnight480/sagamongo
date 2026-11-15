'use client';

// three.js とブラウザ API を使うので、AR 画面はクライアントだけで描画する。
// dynamic(..., { ssr: false }) はクライアントコンポーネントの中でしか使えないため、この薄いラッパーを挟む。

import dynamic from 'next/dynamic';
import { AR_OBJECTS } from '@/lib/ar/objects';

const ARView = dynamic(() => import('@/components/ar/ARView'), {
  ssr: false,
  loading: () => <div className="ar-view" />,
});

export default function ARClient() {
  return <ARView objects={AR_OBJECTS} title="えびすさんを探そう（デモ）" />;
}
