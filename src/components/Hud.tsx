'use client';

// 画面下のポイント・パーティー・イベントの表示
// 移植元：試作 book.js の updateHud() と walk.js の HUD 部分

import * as progress from '@/lib/progress';
import { useProgress } from '@/lib/ui-store';
import { currentEvent } from '@/lib/events';
import { sages, SAGE_EVERY } from '@/lib/catalog';

export function Hud() {
  const d = useProgress();
  const rank = progress.rankOf(d.total);
  const ev = currentEvent();
  const ebisu = progress.ebisuCount();
  const earned = Math.min(sages.length, Math.floor(ebisu / SAGE_EVERY));
  const left = earned >= sages.length ? null : SAGE_EVERY - (ebisu % SAGE_EVERY);
  const party = d.party.map((id) => sages.find((s) => s.id === id)?.name).filter(Boolean);
  const count = `えびす像 ${ebisu}体` + (left == null ? '・七賢人そろった' : `・次の七賢人まであと${left}体`);

  return (
    <div className="walk-hud">
      {ev && (
        <p className="walk-event">
          {ev.name}ブースト中：ポイント{ev.pointsMultiplier}倍
          {ev.rareMultiplier > 1 ? `・ガチャのレア${ev.rareMultiplier}倍` : ''}（{ev.end.slice(5).replace('-', '/')}まで）
        </p>
      )}
      <p className="walk-points">
        {rank.name}　<strong>{d.balance}</strong> pt（累積 {d.total}）
      </p>
      <p className="walk-party">{party.length ? `パーティー：${party.join('、')}（${count}）` : count}</p>
    </div>
  );
}
