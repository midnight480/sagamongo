// 会場で歩かずに見せるためのデモ操作（フレーム側）

import * as progress from './progress';
import { toast } from './ui-store';
import { gradeOf } from './rarity';
import { catalogEntries } from './catalog';

// まだ図鑑にない、場所の分かるえびす像のどれかに「着いた」ことにする
export function arriveRandom() {
  const located = catalogEntries.filter((e) => e.located && !progress.has(e.key));
  const e = located[Math.floor(Math.random() * located.length)];
  if (!e) return;
  const pts = gradeOf(e.grade).statuePoints;
  progress.collect(e.key, e.name, pts);
  progress.visit(e.key, e.name, 20);
  toast(`【${e.grade}】${e.name}に着きました！（デモ）`);
}
