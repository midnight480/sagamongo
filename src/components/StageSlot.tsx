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
// 案内人に出会ったら lib/guide-quiz.ts の meetGuide()（佐賀の歴史クイズを出す）。
// ポイントの値は lib/rarity.ts の GRADES[grade].statuePoints など。お知らせは lib/ui-store.ts の toast(text)。

import { arriveRandom } from '@/lib/demo';
import * as guideQuiz from '@/lib/guide-quiz';

export function StageSlot() {
  // デモ用：3D がまだないので、ランダムなえびす像に「着いた」ことにするボタンを置く
  return (
    <section className="stage-slot" aria-label="AR の画面（3D 担当が作る場所）">
      <p className="stage-slot-title">ここに「えびすさんが歩く」AR 画面が入ります</p>
      <p className="walk-demo-note">3D 部分は別の担当が作っています。フレーム側の確認用に、着いたことにできます。</p>
      <button type="button" className="btn btn-secondary btn-sm" onClick={arriveRandom}>
        どこかのえびす像に着いたことにする（デモ）
      </button>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => guideQuiz.meetGuide()}>
        案内人に出会ったことにする（デモ）
      </button>
    </section>
  );
}
