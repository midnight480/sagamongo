'use client';

// えびすガチャ（デモ決済）の画面
// 移植元：試作 gacha.js の open / render / payAndDraw / showResult と、walk.html の #gacha-dialog

/* eslint-disable @next/next/no-img-element -- 公式サイトの写真を外から直接表示するため */

import { useEffect, useRef, useState } from 'react';
import * as progress from '@/lib/progress';
import { useProgress, toast } from '@/lib/ui-store';
import { currentEvent } from '@/lib/events';
import { GRADES, ORDER } from '@/lib/rarity';
import { PRICES, DUP_BONUS, POINT_PRICE, priceOf, gradeRates, countOf, payAndDraw, drawWithPoints, type DrawResult } from '@/lib/gacha';
import { CREDIT } from '@/lib/catalog';
import { initGachaFx, playGacha, resetStage } from '@/lib/gacha-fx';
import { Thumb } from './Thumb';

export function GachaDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const d = useProgress();
  const dialog = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLCanvasElement>(null);
  const fx = useRef<HTMLCanvasElement>(null);
  const tap = useRef<HTMLButtonElement>(null);
  const resultBox = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<'idle' | 'paying' | 'playing'>('idle');
  const [result, setResult] = useState<DrawResult | null>(null);
  const [shownAt, setShownAt] = useState(0);

  useEffect(() => initGachaFx({
    stage: stage.current!, fx: fx.current!, tap: tap.current!, result: resultBox.current!,
    isOpen: () => Boolean(dialog.current?.open),
  }), []);

  useEffect(() => {
    const el = dialog.current!;
    if (open && !el.open) {
      resetStage();
      setResult(null);
      el.showModal();
    } else if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    if (result) resultBox.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [shownAt, result]);

  const g = progress.gachaInfo();
  const price = priceOf(g.draws);
  const next = priceOf(g.draws + 1);
  const rates = gradeRates();
  const ev = currentEvent();

  const play = async (r: DrawResult) => {
    setBusy('playing');
    await playGacha(r.entry.grade);
    setResult(r);
    setShownAt(Date.now());
    setBusy('idle');
  };

  const pay = () => {
    setBusy('paying');
    setResult(null);
    resetStage();
    // 決済の待ち時間をまねる
    setTimeout(async () => {
      const r = payAndDraw();
      await play(r);
      toast(`¥${r.price} をデモ決済。お店で使える ${r.price}pt が付きました`);
    }, 500);
  };

  // 貯まったポイントで回す（決済の待ちはない）
  const payWithPoints = async () => {
    setResult(null);
    resetStage();
    const r = drawWithPoints();
    if (!r) { toast(`ポイントが足りません（あと ${POINT_PRICE - d.balance}pt）`); return; }
    await play(r);
    toast(`${POINT_PRICE}pt を使いました。残り ${progress.get().balance}pt`);
  };
  const canUsePoints = d.balance >= POINT_PRICE;

  return (
    <dialog ref={dialog} className="modal walk-dialog" aria-labelledby="gacha-title" onClose={onClose}>
      <h2 className="modal-title" id="gacha-title">えびすガチャ</h2>
      <p>えびす像を図鑑に入れて貯まったポイントで回せます。図鑑がなかなかそろわない人は、デモ決済でも回せます。</p>
      <div className="gacha-stage-wrap">
        <canvas ref={stage} className="gacha-stage" role="img" aria-label="ガチャの機械" />
      </div>
      <button ref={tap} type="button" className="btn btn-primary gacha-tap" hidden>タップしてあける！</button>

      {/* 外側は演出（きらきらの位置）用に固定。内側は結果ごとに作り直して、アニメーションをやり直す */}
      <div ref={resultBox} role="status">
        {result && (
          <div key={shownAt} className="gacha-result is-shown" data-grade={result.entry.grade}>
          <div className="gacha-result-inner">
            {result.entry.photo
              ? <img className="gacha-photo" src={result.entry.photo} alt={result.entry.name} />
              : <Thumb entry={result.entry} has size={160} />}
            <p className="walk-dialog-kicker" id="gacha-rarity">{result.entry.grade}（{GRADES[result.entry.grade].name}）</p>
            <p className="walk-quiz-q">{result.entry.name}</p>
            <p>{result.isNew ? '新しく図鑑に登録しました' : `持っていたのでかぶり。おまけ +${DUP_BONUS}pt`}</p>
            {result.entry.photo && (
              <a className="walk-demo-note" href={result.entry.url} target="_blank" rel="noopener">写真：{CREDIT}</a>
            )}
          </div>
          </div>
        )}
      </div>

      <button
        type="button"
        className="btn btn-primary gacha-pay-points"
        onClick={payWithPoints}
        disabled={busy !== 'idle' || !canUsePoints}
      >
        {busy === 'playing' ? 'ガチャガチャ…' : `ポイントで回す（${POINT_PRICE}pt）`}
      </button>
      <p className="walk-demo-note">
        使えるポイント {d.balance}pt{canUsePoints ? '' : `。あと ${POINT_PRICE - d.balance}pt で回せます（えびす像を図鑑に入れると貯まります）`}
      </p>
      <button type="button" className="btn btn-secondary" id="gacha-pay" onClick={pay} disabled={busy !== 'idle'}>
        {busy === 'paying' ? '決済中…（デモ）' : `デモ決済で ¥${price} 払って回す（+${price}pt）`}
      </button>
      <p className="walk-demo-note">
        {next < price ? `その次は ¥${next}。回すほど安くなります（最低 ¥${PRICES[PRICES.length - 1]}）` : 'いちばん安い値段です'}
      </p>
      <p className="walk-demo-note">デモ決済です。実際の支払いは発生しません。払った金額と同じだけ、お店で使えるポイントが付きます（累積・段位・ランキングには入りません）。</p>
      {ev && ev.rareMultiplier > 1 && (
        <p className="walk-dialog-kicker">{ev.name}の期間中：SR・SSR が{ev.rareMultiplier}倍出やすい</p>
      )}
      <p className="walk-demo-note">
        出る確率：{ORDER.map((gr) => `${gr} ${Math.round(rates[gr] * 1000) / 10}%（${countOf(gr)}体）`).join('／')}。持っているものも出ます
      </p>
      <p className="walk-demo-note">
        {g.draws || g.pointDraws
          ? `これまで ポイントで ${g.pointDraws ?? 0}回（${g.spentPoints ?? 0}pt）・デモ決済で ${g.draws}回（¥${g.spentYen}）`
          : 'まだ回していません'}
      </p>
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>閉じる</button>
      </div>
      {/* 紙吹雪ときらきら（画面いっぱい。押せない） */}
      <canvas ref={fx} className="gacha-fx" aria-hidden="true" />
    </dialog>
  );
}
