import type { Metadata, Viewport } from 'next';
import '@/styles/ar.css';
import ARClient from './ARClient';

// 「えびすさんが歩く」AR のデモページ。実際の道でスマホをかざすと、歩き回るえびすさんを探せる。
// 置くものは src/data/ar-objects.json で決める。

export const metadata: Metadata = {
  title: 'えびすさんを探そう（AR デモ） | さがもん！Go！',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function ARDemoPage() {
  return <ARClient />;
}
