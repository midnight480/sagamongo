'use client';

// 「話しかける」ボタン。いつも出しておき、ふだんは押せない。
// AR の画面に出ているえびすさんまで 1.0m 以内になると押せるようになる（距離は AR 画面が知らせる。lib/nearby.ts）。
// 押すと、えびすさんのひとことを出し、はじめてなら図鑑に登録してポイント。

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import * as nearby from '@/lib/nearby';
import * as progress from '@/lib/progress';
import { toast, useProgress } from '@/lib/ui-store';
import { GRADES } from '@/lib/rarity';
import { CREDIT } from '@/lib/catalog';
import { Thumb } from './Thumb';


export function TalkButton() {
  const n = useSyncExternalStore(nearby.subscribe, nearby.getNearest, () => null);
  const ar = useSyncExternalStore(nearby.subscribe, nearby.isArActive, () => false);
  useProgress(); // 図鑑に入ったかどうかで表示を変えるため
  const dialog = useRef<HTMLDialogElement>(null);
  const [result, setResult] = useState<nearby.TalkResult | null>(null);
  const announced = useRef<string | null>(null);

  // 近くに入ったら一度だけ知らせる
  useEffect(() => {
    if (!n?.inRange) { announced.current = null; return; }
    if (announced.current === n.figure.id) return;
    announced.current = n.figure.id;
    toast(`${n.figure.label}がすぐそこにいます。話しかけてみよう`);
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

  const near = `${nearby.TALK_M.toFixed(1)}m まで近づくと話しかけられます`;
  const label = !ar
    ? `話しかける（AR の画面で、えびすさんの ${nearby.TALK_M.toFixed(1)}m 以内に近づくと押せます）`
    : !n
      ? 'えびすさんを探しています…'
      : n.inRange
        ? `話しかける：${n.figure.label}`
        : `${n.figure.label}まで ${nearby.formatDist(n.distM)}（${near}）`;

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
      <span id="walk-talk-help" hidden>AR の画面のえびすさんまで {nearby.TALK_M.toFixed(1)}m 以内に近づくと、話しかけられます</span>

      <dialog ref={dialog} className="modal walk-dialog" aria-labelledby="talk-title" onClose={() => setResult(null)}>
        {result && (
          <>
            {result.entry && <p className="walk-dialog-kicker">{result.entry.grade}（{GRADES[result.entry.grade].name}）</p>}
            <h2 className="modal-title" id="talk-title">{result.name}</h2>
            {result.entry && (
              <div className="walk-talk-photo">
                <Thumb entry={result.entry} has={progress.has(result.entry.key)} size={160} />
              </div>
            )}
            <blockquote className="walk-talk">「{result.line}」</blockquote>
            <p>
              {result.collected ? '図鑑に登録しました。' : ''}
              {!result.entry ? '' : result.points ? `+${result.points}pt` : 'もう会ったことのあるえびすさんです（ポイントははじめてのときだけ）'}
            </p>
            {result.entry?.photo && (
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
