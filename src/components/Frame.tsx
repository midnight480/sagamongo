'use client';

// アプリの枠（フレーム側）。上のボタン、3D の差し込み場所、HUD、お知らせ、各ダイアログを並べる。
// 記録は端末の localStorage から読むので、サーバーでは描かず、ブラウザで開いてから描く。

import { useEffect, useState } from 'react';
import { useToast } from '@/lib/ui-store';
import { Hud } from './Hud';
import { GachaDialog } from './GachaDialog';
import { BookDialog } from './BookDialog';
import { JoinDialog } from './JoinDialog';
import { StageSlot } from './StageSlot';
import { MiniMap } from './MiniMap';

type Open = null | 'book' | 'gacha';

export function Frame() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState<Open>(null);
  const toastText = useToast();

  // eslint-disable-next-line react-hooks/set-state-in-effect -- 記録はブラウザでしか読めないので、開いてから描く
  useEffect(() => setMounted(true), []);
  if (!mounted) return <main className="walk" aria-busy="true" />;

  return (
    <main className="walk">
      <div className="walk-top">
        <div className="walk-bar">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen('book')}>図鑑・ランキング</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen('gacha')}>ガチャ</button>
        </div>
      </div>

      <StageSlot />
      <Hud />
      <MiniMap />
      {toastText && <div className="toast walk-toast" role="status">{toastText}</div>}

      <BookDialog open={open === 'book'} onClose={() => setOpen(null)} />
      <GachaDialog open={open === 'gacha'} onClose={() => setOpen(null)} />
      <JoinDialog />
    </main>
  );
}
