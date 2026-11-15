'use client';

// 案内人の QR コードを、アプリの中で読み取る画面（AR 画面のバーから開く）。
// ・AR がカメラを使っているときは、その映像（.ar-video）から読む。iPhone ではカメラを二重に開くと
//   AR 側の映像が止まることがあるため、新しくは開かない
// ・AR を始める前なら、ここでカメラ（背面）を開き、閉じたら止める
// 読み取りは jsQR（Apache-2.0）。開いたときに読み込む。

import { useEffect, useRef, useState } from 'react';
import { parseGuideQr } from '@/lib/guide-qr';

type Props = { open: boolean; onClose: () => void; onFound: (id?: string) => void };

// 読み取りに使う画像の幅（px）。大きいほど遠くの QR も読めるが重い
const SCAN_WIDTH = 640;

export function QrScanDialog({ open, onClose, onFound }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const el = dialog.current!;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let stopped = false;
    let raf = 0;
    let own: MediaStream | null = null;
    let lastWrong = '';

    (async () => {
      const { default: jsQR } = await import('jsqr');
      // AR の映像があれば使う。なければ自分でカメラを開く
      let video = document.querySelector<HTMLVideoElement>('.ar-video');
      if (!video || !video.srcObject) {
        try {
          own = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        } catch {
          if (!stopped) setNote('カメラが使えません。カメラの許可を確かめてください');
          return;
        }
        if (stopped) { own.getTracks().forEach((t) => t.stop()); return; }
        video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.srcObject = own;
        await video.play().catch(() => {});
      }
      const src = video;
      const canvas = preview.current!;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

      const tick = () => {
        if (stopped) return;
        raf = requestAnimationFrame(tick);
        if (src.readyState < 2 || !src.videoWidth) return;
        const w = Math.min(SCAN_WIDTH, src.videoWidth);
        const h = Math.round((src.videoHeight / src.videoWidth) * w);
        if (canvas.width !== w) { canvas.width = w; canvas.height = h; }
        ctx.drawImage(src, 0, 0, w, h);
        const img = ctx.getImageData(0, 0, w, h);
        const code = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
        if (!code?.data) return;
        const hit = parseGuideQr(code.data);
        if (hit) { stopped = true; onFound(hit.id); return; }
        if (code.data !== lastWrong) { lastWrong = code.data; setNote('案内人の QR コードではないようです'); }
      };
      tick();
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      own?.getTracks().forEach((t) => t.stop());
      setNote(null);
    };
  }, [open, onFound]);

  return (
    <dialog ref={dialog} className="modal walk-dialog qr-scan" aria-labelledby="qr-scan-title" onClose={onClose}>
      <h2 className="modal-title" id="qr-scan-title">案内人の QR を読む</h2>
      <p>案内人のおばあちゃんが持っている QR コードを、枠の中に写してください。読み取ると歴史クイズが出ます。</p>
      <div className="qr-scan-view">
        <canvas ref={preview} className="qr-scan-canvas" aria-label="カメラの映像" />
        <span className="qr-scan-frame" aria-hidden="true" />
      </div>
      <p className="walk-demo-note" role="status">{note ?? 'さがしています…'}</p>
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={() => onFound()}>読めないとき：出会ったことにする（デモ）</button>
        <button type="button" className="btn btn-secondary" onClick={onClose}>閉じる</button>
      </div>
    </dialog>
  );
}
