import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // 案内人に渡す QR コードの行き先。印刷した QR を作り直さずに済むよう、行き先はここで変える
  //   /guide        → まだ正解していない問題から1つ
  //   /guide/<id>   → その問題（data/history-quiz.json の id）
  async redirects() {
    return [
      { source: '/guide', destination: '/?quiz=1', permanent: false },
      { source: '/guide/:id', destination: '/?quiz=:id', permanent: false },
    ];
  },
  // PWA：Service Worker は古いものが残らないよう、毎回取り直させる
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
