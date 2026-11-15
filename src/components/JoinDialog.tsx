'use client';

// えびす像を10体集めるごとに、七賢人が一人仲間になる（N → R → SR → SSR の順）
// 移植元：試作 walk.js の checkSageUnlocks / showSageJoin と、walk.html の #join-dialog

import { useCallback, useEffect, useRef, useState } from 'react';
import * as progress from '@/lib/progress';
import { gradeOf, GRADES } from '@/lib/rarity';
import { pointsMultiplier } from '@/lib/events';
import { sageEntries, sageOrder, sages, SAGE_EVERY, type Sage } from '@/lib/catalog';
import { Thumb } from './Thumb';

type Join = { sage: Sage; points: number; at: number };

export function JoinDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [queue, setQueue] = useState<Join[]>([]);
  const current = queue[0];

  // 集めた数に足りているのに、まだ仲間になっていない七賢人を仲間にする
  const check = useCallback(() => {
    const earned = Math.min(sages.length, Math.floor(progress.ebisuCount() / SAGE_EVERY));
    const have = sages.filter((s) => progress.has(`sage:${s.id}`)).length;
    if (have >= earned) return;
    const next = sageOrder().filter((s) => !progress.has(`sage:${s.id}`)).slice(0, earned - have);
    const joins = next.map((sage, i) => {
      const points = gradeOf(sage.grade).sagePoints;
      progress.collect(`sage:${sage.id}`, sage.name, points);
      progress.joinParty(sage.id);
      return { sage, points: points * pointsMultiplier(), at: (have + i + 1) * SAGE_EVERY };
    });
    setQueue((q) => [...q, ...joins]);
  }, []);

  useEffect(() => {
    const t = setTimeout(check, 0); // 前回までに集めた分
    const off = progress.onCollect((key) => {
      if (key.startsWith('ebisu:') || key.startsWith('cat:')) setTimeout(check, 600);
    });
    return () => { clearTimeout(t); off(); };
  }, [check]);

  useEffect(() => {
    const el = dialog.current!;
    if (current && !el.open) el.showModal();
  }, [current]);

  const entry = current && sageEntries.find((e) => e.key === `sage:${current.sage.id}`);

  return (
    <dialog
      ref={dialog}
      className="modal walk-dialog join-dialog"
      aria-labelledby="join-name"
      onClose={() => setTimeout(() => setQueue((q) => q.slice(1)), 200)}
    >
      {current && entry && (
        <form method="dialog">
          <p className="walk-dialog-kicker">えびす像を{current.at}体集めました</p>
          <Thumb entry={entry} has size={128} />
          <p className="join-grade" data-grade={current.sage.grade}>{current.sage.grade}（{GRADES[current.sage.grade].name}）</p>
          <h2 className="modal-title" id="join-name">{current.sage.name}が仲間になった！</h2>
          <p>{current.sage.bio}</p>
          {current.sage.portrait && (
            <p className="walk-demo-note">
              顔写真：<a href={current.sage.portrait.url} target="_blank" rel="noopener">{current.sage.portrait.credit.replace(/^出典：/, '')}</a>
            </p>
          )}
          <p className="walk-demo-note">+{current.points}pt。パーティーに加わり、後ろに付いてきます</p>
          <div className="modal-actions">
            <button value="ok" className="btn btn-primary" autoFocus>一緒に歩く</button>
          </div>
        </form>
      )}
    </dialog>
  );
}
