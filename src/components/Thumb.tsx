// 図鑑・ガチャに出す絵。えびす像は公式サイトの写真、七賢人は肖像写真。
// 試作では 3D 側の「板の絵」を出していたが、フレーム側は 3D に頼らない。
// まだ集めていないものは、色を抜いて暗くする（どんなものかは、なんとなく分かる）。

/* eslint-disable @next/next/no-img-element -- 公式サイトの写真を外から直接表示するため（next/image の最適化を通さない） */

import type { Entry } from '@/lib/catalog';

export function Thumb({ entry, has, size = 64 }: { entry: Entry; has: boolean; size?: number }) {
  const cls = `thumb${has ? '' : ' is-uncollected'}`;
  const p = entry.portrait;
  if (p) {
    return (
      <span className={cls} style={{ width: size, height: size }}>
        <img
          src={p.src}
          alt=""
          width={size}
          height={size}
          style={{ objectPosition: `${p.cx * 100}% ${p.cy * 100}%`, transform: p.flip ? 'scaleX(-1)' : undefined }}
        />
      </span>
    );
  }
  if (entry.photo) {
    return (
      <span className={cls} style={{ width: size, height: size }}>
        <img src={entry.photo} alt="" width={size} height={size} loading="lazy" />
      </span>
    );
  }
  return <span className={`${cls} thumb-none`} style={{ width: size, height: size }}>絵なし</span>;
}

export function GradeBadge({ grade }: { grade: string }) {
  return <span className="grade-badge" data-grade={grade}>{grade}</span>;
}
