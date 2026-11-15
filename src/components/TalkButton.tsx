'use client';

// 「話しかける」ボタン。いちばん近いえびす像まで 1.0m 以内になると押せるようになる。
// 押すと、えびすさんのひとことを出し、はじめてなら図鑑に登録してポイント（lib/nearby.ts）。
// 今いる場所は GPS（ミニマップが取る）か、デモの位置（ミニマップを押してそこに立ったことにする）。

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import * as nearby from '@/lib/nearby';
import * as progress from '@/lib/progress';
import { toast, useProgress } from '@/lib/ui-store';
import { GRADES } from '@/lib/rarity';
import { CREDIT } from '@/lib/catalog';
import { Thumb } from './Thumb';


export function TalkButton() {
  const n = useSyncExternalStore(nearby.subscribe, nearby.getNearest, () => null);
  useProgress(); // 図鑑に入ったかどうかで表示を変えるため
  const dialog = useRef<HTMLDialogElement>(null);
  const [result, setResult] = useState<nearby.TalkResult | null>(null);
  const announced = useRef<string | null>(null);

  // 近くに入ったら一度だけ知らせる
  useEffect(() => {
    if (!n?.inRange || announced.current === n.entry.key) return;
    announced.current = n.entry.key;
    toast(`${n.entry.name}がすぐそこにいます。話しかけてみよう`);
  }, [n]);

  useEffect(() => {
    const el = dialog.current!;
    if (result && !el.open) el.showModal();
    else if (!result && el.open) el.close();
  }, [result]);

  const onTalk = () => {
    if (!n) return;
    const r = nearby.talk(n);
    if (r) setResult(r);
  };

  const label = !n
    ? '今いる場所を探しています…'
    : n.inRange
      ? `話しかける：${n.entry.name}`
      : `${n.entry.name}まで ${nearby.formatDist(n.distM)}（${nearby.TALK_M.toFixed(1)}m まで近づくと話しかけられます）`;

  return (
    <>
      <button
        type="button"
        className={`btn btn-sm walk-talk-button${n?.inRange ? ' btn-primary is-active' : ' btn-secondary'}`}
        disabled={!n?.inRange}
        onClick={onTalk}
        aria-describedby="walk-talk-help"
      >
        {label}
      </button>
      <span id="walk-talk-help" hidden>えびす像まで {nearby.TALK_M.toFixed(1)}m 以内に近づくと、話しかけられます</span>

      <dialog ref={dialog} className="modal walk-dialog" aria-labelledby="talk-title" onClose={() => setResult(null)}>
        {result && (
          <>
            <p className="walk-dialog-kicker">{result.entry.grade}（{GRADES[result.entry.grade].name}）</p>
            <h2 className="modal-title" id="talk-title">{result.entry.name}</h2>
            <div className="walk-talk-photo">
              <Thumb entry={result.entry} has={progress.has(result.entry.key)} size={160} />
            </div>
            <blockquote className="walk-talk">「{result.line}」</blockquote>
            <p>
              {result.collected ? '図鑑に登録しました。' : ''}
              {result.points ? `+${result.points}pt` : 'もう会ったことのある像です（ポイントははじめてのときだけ）'}
            </p>
            {result.entry.address && <p className="walk-demo-note">{result.entry.address}</p>}
            {result.entry.photo && (
              <a className="walk-demo-note" href={result.entry.url} target="_blank" rel="noopener">写真：{CREDIT}</a>
            )}
            <div className="modal-actions">
              <button type="button" className="btn btn-primary" onClick={() => setResult(null)}>またね</button>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
