'use client';

// 3D 部分（えびすさんが歩く AR 画面）を差し込む場所。中身は 3D 担当が作る。
// フレーム側はここに仮の表示を出すだけ。3D 側は lib/progress.ts の関数で記録を書き、
// 画面（HUD・図鑑・ガチャ）は記録の変化を受けて自動で描き直す。
//
// 3D 側から使う主な関数（lib/progress.ts）:
//   collect(key, name, points)  図鑑に登録（key は 'cat:<fid>' / 'ebisu:<id>'）
//   visit(key, name, points)    現地に行った
//   awaken(key, name, points)   写真を撮って動き出した
//   addWalk(m)                  歩いた距離
//   lapArrive(chapter, id)      周回の像に着いた
// ポイントの値は lib/rarity.ts の GRADES[grade].statuePoints など。お知らせは lib/ui-store.ts の toast(text)。

import * as progress from '@/lib/progress';
import { toast } from '@/lib/ui-store';
import { gradeOf } from '@/lib/rarity';
import { catalogEntries } from '@/lib/catalog';

export function StageSlot() {
  // デモ用：3D がまだないので、ランダムなえびす像に「着いた」ことにするボタンを置く
  const arriveRandom = () => {
    const located = catalogEntries.filter((e) => e.located && !progress.has(e.key));
    const e = located[Math.floor(Math.random() * located.length)];
    if (!e) return;
    const pts = gradeOf(e.grade).statuePoints;
    progress.collect(e.key, e.name, pts);
    progress.visit(e.key, e.name, 20);
    toast(`【${e.grade}】${e.name}に着きました！（デモ）`);
  };

  return (
    <section className="stage-slot" aria-label="AR の画面（3D 担当が作る場所）">
      <p className="stage-slot-title">ここに「えびすさんが歩く」AR 画面が入ります</p>
      <p className="walk-demo-note">3D 部分は別の担当が作っています。フレーム側の確認用に、着いたことにできます。</p>
      <button type="button" className="btn btn-secondary btn-sm" onClick={arriveRandom}>
        どこかのえびす像に着いたことにする（デモ）
      </button>
    </section>
  );
}
