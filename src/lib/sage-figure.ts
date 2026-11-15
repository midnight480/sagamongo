// 七賢人の絵（記念撮影で使う）。描いた体に、肖像写真の顔をだ円に切り抜いてはめる。
// 移植元：試作 walk.js の drawSage / drawPortraitHead / drawFace（歩く動きは外して、立ち姿にした）
// 座標：足元が原点、上がマイナス。背の高さはおよそ 112（頭のてっぺんまで）。体は右を向いている。

import type { Sage } from './catalog';

// 絵の色（試作 walk.css の --walk-* と同じ。UI の色ではないので、ここで決める）
const C = { hat: '#1f2328', face: '#f6d7b0', hakamaGray: '#4b5563', collar: '#f9fafb' };

export const SAGE_UNITS = { height: 112, halfWidth: 20 };

const HEAD = { x: 2, y: -94, rx: 15, ry: 18 };

function legs(g: CanvasRenderingContext2D, color: string, hipY: number, width: number) {
  g.fillStyle = color;
  for (const sx of [-3, 3]) {
    g.beginPath();
    g.moveTo(-width + sx * 0.4, hipY);
    g.lineTo(width + sx * 0.4, hipY);
    g.lineTo(width + 1 + sx, 0);
    g.lineTo(-width - 1 + sx, 0);
    g.closePath(); g.fill();
  }
}

function plainFace(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.fillStyle = C.face;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = C.hat;
  g.beginPath(); g.arc(x - 3, y - 1, 1.5, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(x + 6, y - 1, 1.5, 0, Math.PI * 2); g.fill();
  g.strokeStyle = C.hat; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(x - 1, y + 6); g.lineTo(x + 5, y + 6); g.stroke();
}

// 写真の顔をだ円に切り抜いて頭の位置に置く（p.flip は写真の顔が左向きのとき）
function portraitHead(g: CanvasRenderingContext2D, img: HTMLImageElement, p: NonNullable<Sage['portrait']>) {
  const W = img.naturalWidth; const H = img.naturalHeight;
  const sh = p.ry * H * 2;
  const sw = sh * (HEAD.rx / HEAD.ry);
  const sx = p.cx * W - sw / 2; const sy = p.cy * H - sh / 2;
  g.save();
  g.beginPath(); g.ellipse(HEAD.x, HEAD.y, HEAD.rx, HEAD.ry, 0, 0, Math.PI * 2); g.clip();
  g.translate(HEAD.x, HEAD.y);
  if (p.flip) g.scale(-1, 1);
  g.drawImage(img, sx, sy, sw, sh, -HEAD.rx, -HEAD.ry, HEAD.rx * 2, HEAD.ry * 2);
  g.restore();
  g.strokeStyle = C.hat; g.lineWidth = 1.2;
  g.beginPath(); g.ellipse(HEAD.x, HEAD.y, HEAD.rx, HEAD.ry, 0, 0, Math.PI * 2); g.stroke();
}

// 立ち姿を描く。img は肖像写真（読み込めていなければ null で、描いた顔にする）
export function drawSage(g: CanvasRenderingContext2D, sage: Sage, img: HTMLImageElement | null) {
  const wa = sage.style === 'wa';
  legs(g, wa ? C.hakamaGray : sage.color, -44, 5);
  // 胴
  g.fillStyle = sage.color;
  g.beginPath();
  g.moveTo(-11, -80); g.lineTo(11, -80); g.lineTo(wa ? 15 : 12, -42); g.lineTo(wa ? -15 : -12, -42);
  g.closePath(); g.fill();
  if (wa) {
    g.strokeStyle = C.collar; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-6, -80); g.lineTo(2, -64); g.lineTo(8, -80); g.stroke();
  } else {
    g.fillStyle = C.collar;
    g.beginPath(); g.moveTo(-4, -80); g.lineTo(6, -80); g.lineTo(1, -66); g.closePath(); g.fill();
    g.fillStyle = C.hat; g.fillRect(0, -78, 2, 10);
  }
  // 腕（体の横に下ろす）
  g.fillStyle = sage.color; g.fillRect(-1, -76, 6, 28);
  g.fillStyle = C.face; g.beginPath(); g.arc(2, -46, 3, 0, Math.PI * 2); g.fill();

  if (img && sage.portrait) { portraitHead(g, img, sage.portrait); return; }
  plainFace(g, 2, -89, 10);
  g.fillStyle = C.hat;
  if (wa) {
    g.beginPath(); g.arc(2, -95, 9, Math.PI, Math.PI * 1.75); g.lineTo(2, -95); g.fill();
    g.fillRect(-4, -103, 10, 3); g.fillRect(0, -106, 3, 4);
  } else {
    g.beginPath(); g.arc(2, -92, 10.5, Math.PI * 1.05, Math.PI * 1.95); g.fill();
  }
}
