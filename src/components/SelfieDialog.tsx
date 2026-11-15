'use client';

// 仲間になった七賢人と記念撮影（セルフィー）。
// 前のカメラの映像に、パーティーの七賢人（最大7人）とえびすさんを並べて 1 枚の写真にする。
// ・指でドラッグして動かす。選んだ人は「小さく／大きく」。左右にいる人はまん中を向く
// ・写真の下に題名・日付・一緒に写った人の帯
// ・写真は端末の中だけで作り、どこにも送らない。保存・共有は本人が押したときだけ。はじめての撮影は +20pt
// ・カメラが使えないときは、背景だけで撮る
// 移植元：試作 selfie.js と walk.html の #selfie-dialog（七賢人の絵は lib/sage-figure.ts、えびすさんは AR の素材の正面の絵）

/* eslint-disable @next/next/no-img-element -- 撮った写真（端末の中の blob URL）を出すため */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as progress from '@/lib/progress';
import { toast } from '@/lib/ui-store';
import { sages, type Sage } from '@/lib/catalog';
import { drawSage, SAGE_UNITS } from '@/lib/sage-figure';

const FIRST_BONUS = 20;
// 並べる位置（画面に対する割合）。x・y は足元、h は背の高さ
// パーティーの順（新しく仲間になった人から）に、前の列の両端 → 後ろの列 → いちばん奥の順で埋める
const SLOTS = [
  { x: 0.22, y: 1.0, h: 0.66 },
  { x: 0.78, y: 1.0, h: 0.66 },
  { x: 0.36, y: 0.9, h: 0.54 },
  { x: 0.64, y: 0.9, h: 0.54 },
  { x: 0.08, y: 0.86, h: 0.5 },
  { x: 0.92, y: 0.86, h: 0.5 },
  { x: 0.5, y: 0.8, h: 0.46 },
];
const EBISU_SLOT = { x: 0.5, y: 0.99, h: 0.34 };
const EBISU_SRC = '/figures/ebisu/front.png';

type Item = { x: number; y: number; h: number; label: string; sage?: Sage; ebisu?: boolean };
type Box = { it: Item; x0: number; x1: number; y0: number; y1: number };

const loadImage = (src: string) => new Promise<HTMLImageElement | null>((resolve) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

function layout(withEbisu: boolean): Item[] {
  const party = progress.get().party.map((id) => sages.find((s) => s.id === id)).filter((s): s is Sage => Boolean(s));
  const items: Item[] = party.map((s, i) => ({ ...SLOTS[i % SLOTS.length], sage: s, label: `【${s.grade}】${s.name}` }));
  if (withEbisu) items.push({ ...EBISU_SLOT, ebisu: true, label: 'えびすさん' });
  return items.sort((a, b) => a.y - b.y || a.h - b.h); // 奥（足元が上にある人）から描く
}

// 開いているあいだだけ置く（Frame で {open && <SelfieDialog />}）。閉じるとカメラを止め、写真も捨てる
export function SelfieDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  const items = useRef<Item[]>([]);
  const boxes = useRef<Box[]>([]);
  const selectedRef = useRef<Item | null>(null);
  const drag = useRef<{ id: number; dx: number; dy: number } | null>(null);
  const images = useRef<{ ebisu: HTMLImageElement | null; portraits: Map<string, HTMLImageElement | null> }>({ ebisu: null, portraits: new Map() });
  const cameraOk = useRef(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [withEbisu, setWithEbisu] = useState(true);
  const [photo, setPhoto] = useState<{ url: string; blob: Blob; name: string } | null>(null);
  const [hasParty] = useState(() => progress.get().party.length > 0);
  const paused = useRef(false); // 撮ったあとは描くのを止める
  const photoUrl = useRef<string | null>(null);

  const select = (it: Item | null) => { selectedRef.current = it; setSelected(it?.label ?? null); };

  // 描く（live のときは選んだ人に枠）
  const draw = useCallback((live: boolean) => {
    const c = canvas.current; if (!c) return;
    const g = c.getContext('2d')!;
    const W = c.width; const H = c.height;
    const v = video.current;
    if (cameraOk.current && v && v.videoWidth) {
      // 前のカメラは鏡のように左右反転（撮った写真も同じ向き）
      const s = Math.max(W / v.videoWidth, H / v.videoHeight);
      const vw = v.videoWidth * s; const vh = v.videoHeight * s;
      g.save(); g.translate(W, 0); g.scale(-1, 1);
      g.drawImage(v, (W - vw) / 2, (H - vh) / 2, vw, vh);
      g.restore();
    } else {
      const grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#93c5fd'); grad.addColorStop(0.65, '#fde68a'); grad.addColorStop(1, '#a3a3a3');
      g.fillStyle = grad; g.fillRect(0, 0, W, H);
    }
    const out: Box[] = [];
    for (const it of items.current) {
      const hPx = it.h * H;
      const fx = it.x * W; const fy = it.y * H;
      const mirror = it.x > 0.5; // 右にいる人は左（まん中）を向く
      let halfW: number;
      g.save();
      g.translate(fx, fy);
      if (mirror) g.scale(-1, 1);
      g.shadowColor = 'rgba(0, 0, 0, 0.35)'; g.shadowBlur = 8 * (W / 400); g.shadowOffsetY = 2 * (W / 400);
      if (it.ebisu) {
        const img = images.current.ebisu;
        const w = img ? (img.naturalWidth / img.naturalHeight) * hPx : hPx * 0.6;
        halfW = w / 2;
        if (img) g.drawImage(img, -w / 2, -hPx, w, hPx);
      } else {
        const k = hPx / SAGE_UNITS.height;
        halfW = SAGE_UNITS.halfWidth * k;
        g.scale(k, k);
        drawSage(g, it.sage!, images.current.portraits.get(it.sage!.id) ?? null);
      }
      g.restore();
      const box = { it, x0: fx - halfW, x1: fx + halfW, y0: fy - hPx, y1: fy };
      out.push(box);
      if (live && selectedRef.current === it) {
        g.strokeStyle = '#60a5fa'; g.lineWidth = 3 * (W / 400); g.setLineDash([10, 6]);
        g.strokeRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0); g.setLineDash([]);
      }
    }
    boxes.current = out;
    band(g, W, H, items.current);
  }, []);

  // 開いたら：絵を読み込み、カメラを開き、描き続ける。閉じたらカメラを止め、写真を捨てる
  useEffect(() => {
    const el = dialog.current!;
    if (!el.open) el.showModal();
    let stopped = false;
    let raf = 0;
    let stream: MediaStream | null = null;
    items.current = layout(true);

    (async () => {
      const c = canvas.current!;
      const r = c.getBoundingClientRect();
      const dpr = Math.min(2, devicePixelRatio || 1);
      c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
      images.current.ebisu ??= await loadImage(EBISU_SRC);
      for (const s of sages) {
        if (s.portrait && !images.current.portraits.has(s.id)) images.current.portraits.set(s.id, await loadImage(s.portrait.src));
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        video.current!.srcObject = stream;
        await video.current!.play().catch(() => {});
        cameraOk.current = true;
      } catch {
        if (stopped) return;
        cameraOk.current = false;
        toast('カメラが使えないので、背景だけで撮ります');
      }
      const loop = () => {
        if (stopped) return;
        if (!paused.current) draw(true);
        raf = requestAnimationFrame(loop);
      };
      loop();
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      cameraOk.current = false;
      if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
      // ここで el.close() は呼ばない（close イベントで onClose が走り、開き直せなくなる）。外すときに DOM ごと消える
    };
  }, [draw]);

  // 「えびすさんも一緒に」を切り替えたら並べ直す
  const toggleEbisu = (on: boolean) => {
    setWithEbisu(on);
    items.current = layout(on);
    select(null);
  };

  const at = (e: React.PointerEvent) => {
    const c = canvas.current!; const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = at(e);
    const hit = [...boxes.current].reverse().find((b) => p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1);
    select(hit?.it ?? null);
    if (!hit) return;
    const c = canvas.current!;
    drag.current = { id: e.pointerId, dx: p.x / c.width - hit.it.x, dy: p.y / c.height - hit.it.y };
    c.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const it = selectedRef.current;
    if (!drag.current || drag.current.id !== e.pointerId || !it) return;
    const c = canvas.current!; const p = at(e);
    it.x = Math.min(1, Math.max(0, p.x / c.width - drag.current.dx));
    it.y = Math.min(1.3, Math.max(0.2, p.y / c.height - drag.current.dy));
  };
  const up = () => { drag.current = null; };
  const resize = (k: number) => {
    const it = selectedRef.current; if (!it) return;
    it.h = Math.min(1.4, Math.max(0.15, it.h * k));
  };

  const shoot = async () => {
    select(null);
    const f = flash.current!;
    f.classList.remove('is-on'); void f.offsetWidth; f.classList.add('is-on');
    shutter();
    draw(false);
    const blob = await new Promise<Blob | null>((r) => canvas.current!.toBlob(r, 'image/jpeg', 0.92));
    if (!blob) return;
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const name = `sagamongo-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.jpg`;
    paused.current = true;
    if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
    photoUrl.current = URL.createObjectURL(blob);
    setPhoto({ url: photoUrl.current, blob, name });
    if (progress.addSelfie()) {
      progress.bonus(FIRST_BONUS, 'はじめての記念撮影');
      toast(`はじめての記念撮影！ +${FIRST_BONUS}pt`);
    }
  };
  const retake = () => {
    if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
    photoUrl.current = null;
    setPhoto(null);
    paused.current = false;
  };
  const canShare = (() => {
    try {
      return Boolean(photo && navigator.canShare?.({ files: [new File([photo.blob], photo.name, { type: 'image/jpeg' })] }));
    } catch { return false; }
  })();
  const share = async () => {
    if (!photo) return;
    try {
      await navigator.share({ files: [new File([photo.blob], photo.name, { type: 'image/jpeg' })], title: 'さがもん！Go！', text: '佐賀の七賢人と記念撮影しました' });
    } catch { /* やめたときは何もしない */ }
  };

  return (
    <dialog ref={dialog} className="modal walk-dialog selfie-dialog" aria-labelledby="selfie-title" onClose={onClose}>
      <h2 className="modal-title" id="selfie-title">七賢人と記念撮影</h2>
      <div hidden={Boolean(photo)}>
        <div className="selfie-frame">
          <canvas
            ref={canvas}
            className="selfie-canvas"
            role="img"
            aria-label="カメラの映像と七賢人"
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
          />
          <div ref={flash} className="selfie-flash" aria-hidden="true" />
        </div>
        <p className="walk-demo-note">
          {hasParty
            ? '七賢人を指で動かして、いい位置に。選んだ人は「小さく／大きく」で大きさを変えられます'
            : `まだ仲間の七賢人がいません。えびす像を集めると仲間になり、一緒に写れます（今はえびすさんだけ）`}
        </p>
        <div className="selfie-tools">
          <span className="walk-demo-note">{selected ? `選択中：${selected}` : '人を押すと選べます'}</span>
          <button type="button" className="btn btn-secondary btn-sm" disabled={!selected} onClick={() => resize(1 / 1.12)}>小さく</button>
          <button type="button" className="btn btn-secondary btn-sm" disabled={!selected} onClick={() => resize(1.12)}>大きく</button>
        </div>
        <label className="check selfie-check">
          <input type="checkbox" checked={withEbisu} onChange={(e) => toggleEbisu(e.target.checked)} /> えびすさんも一緒に写る
        </label>
        <button type="button" className="btn btn-primary selfie-shoot" onClick={shoot}>撮る</button>
      </div>
      {photo && (
        <div>
          <img className="selfie-photo" src={photo.url} alt="撮った記念写真" />
          <p className="walk-demo-note">写真はこの端末の中だけで作りました。どこにも送っていません。</p>
          <div className="selfie-tools">
            <a className="btn btn-primary" href={photo.url} download={photo.name}>保存する</a>
            {canShare && <button type="button" className="btn btn-secondary" onClick={share}>共有する</button>}
            <button type="button" className="btn btn-ghost" onClick={retake}>撮り直す</button>
          </div>
        </div>
      )}
      <video ref={video} playsInline muted hidden />
      <p className="walk-demo-note">七賢人の顔：国立国会図書館「近代日本人の肖像」、島義勇は北海道大学附属図書館 北方資料室所蔵（パブリックドメイン）</p>
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>閉じる</button>
      </div>
    </dialog>
  );
}

// 写真の下の帯（題名・日付・一緒に写った人）
function band(g: CanvasRenderingContext2D, W: number, H: number, items: Item[]) {
  const u = W / 400;
  const h = 54 * u;
  const font = getComputedStyle(document.documentElement).getPropertyValue('--font-family').trim() || 'sans-serif';
  g.fillStyle = 'rgba(17, 24, 39, 0.72)';
  g.fillRect(0, H - h, W, h);
  g.textBaseline = 'middle';
  g.fillStyle = '#fbbf24';
  g.font = `900 ${17 * u}px ${font}`;
  g.fillText('さがもん！Go！', 12 * u, H - h + 18 * u);
  const d = new Date();
  g.fillStyle = '#ffffff';
  g.font = `${11 * u}px ${font}`;
  g.textAlign = 'right';
  g.fillText(`佐賀市 ${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`, W - 12 * u, H - h + 18 * u);
  g.textAlign = 'left';
  const names = items.filter((it) => it.sage).map((it) => it.sage!.name.replace(/（.*）/, ''));
  g.fillText(names.length ? `with ${names.join('・')}` : 'with えびすさん', 12 * u, H - h + 40 * u);
  g.textBaseline = 'alphabetic';
}

// シャッター音（Web Audio でその場で作る）
function shutter() {
  try {
    const a = new AudioContext();
    const buf = a.createBuffer(1, Math.floor(a.sampleRate * 0.08), a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
    const s = a.createBufferSource(); s.buffer = buf;
    const gain = a.createGain(); gain.gain.value = 0.4;
    s.connect(gain).connect(a.destination); s.start();
    s.onended = () => { a.close(); };
  } catch { /* 音が出せなくても撮る */ }
}
