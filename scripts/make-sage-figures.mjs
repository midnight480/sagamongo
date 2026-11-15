// 七賢人の AR 素材の元画像を作る（手動実行: npm run make:sages → そのあと npm run prepare:figure）
// - 描いた体に、肖像写真（public/img/sages/）の顔をだ円に切り抜いてはめる。写真そのものは加工しない（切り抜きと明るさだけ）
// - 1 枚に「正面・横（左向き）・背面」を等幅で並べた白背景の PNG を assets/figures/sage-<id>.png に書く
//   横の板は裏表に同じ絵を貼るので、右から見ると右向きになる（左右の両方をこれ 1 面でまかなう）
// - 横から撮った写真は残っていないので、横の面も正面の顔写真を使う（左右反転するだけ。横顔を作り出さない）
// 絵の形と色は src/lib/sage-figure.ts（記念撮影の絵）に合わせる
import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const CHARACTERS = "src/data/characters.json";
const OUT_DIR = "assets/figures";
/** 1 単位あたりの px。絵の高さはおよそ 112 単位 */
const S = 9;
/** 1 面の大きさ（単位）。足元が y = 0、上がマイナス */
const PANEL = { w: 64, top: -118, bottom: 4 };
const C = { hair: "#1f2328", face: "#f6d7b0", hakamaGray: "#4b5563", collar: "#e5e7eb", line: "#1f2328" };
const HEAD = { y: -94, rx: 15, ry: 18 };

/** 写真から顔のまわりをだ円の外接矩形で切り出し、data URI にする。mirror で左右反転 */
async function faceDataUri(src, p, rx, ry, mirror) {
  const img = sharp(src);
  const { width: W, height: H } = await img.metadata();
  const sh = p.ry * H * 2;
  const sw = sh * (rx / ry);
  const left = Math.round(p.cx * W - sw / 2);
  const top = Math.round(p.cy * H - sh / 2);
  // はみ出した分は白で足す
  const padL = Math.max(0, -left), padT = Math.max(0, -top);
  const padR = Math.max(0, left + Math.round(sw) - W), padB = Math.max(0, top + Math.round(sh) - H);
  let face = sharp(src)
    .extend({ left: padL, top: padT, right: padR, bottom: padB, background: "#ffffff" })
    .extract({ left: left + padL, top: top + padT, width: Math.round(sw), height: Math.round(sh) })
    .resize(Math.round(rx * 2 * S), Math.round(ry * 2 * S))
    // 白抜き（scripts/lib/cutout.mjs）で顔の明るいところが抜けないよう、いちばん明るいところを少し落とす
    .linear(0.92, 0);
  // p.flip は写真の顔が左向きのとき。ここでは「右向きにそろえてから」mirror で左向きにする
  if (Boolean(p.flip) !== Boolean(mirror)) face = face.flop();
  const buf = await face.jpeg({ quality: 90 }).toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

const poly = (pts, fill) => `<polygon points="${pts.map((p) => p.join(",")).join(" ")}" fill="${fill}" stroke="${C.line}" stroke-width="0.8" stroke-linejoin="round"/>`;
const rect = (x, y, w, h, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${fill}" stroke="${C.line}" stroke-width="0.8"/>`;
const circle = (x, y, r, fill) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${C.line}" stroke-width="0.6"/>`;

function legs(wa, color, half) {
  if (wa) return poly([[-half, -44], [half, -44], [half + 3, 0], [-half - 3, 0]], C.hakamaGray) + `<line x1="0" y1="-30" x2="0" y2="0" stroke="${C.line}" stroke-width="0.8"/>`;
  return poly([[-half, -44], [-1, -44], [-1.5, 0], [-half - 1, 0]], color) + poly([[1, -44], [half, -44], [half + 1, 0], [1.5, 0]], color);
}

function head(id, x, rx, uri) {
  return `<clipPath id="${id}"><ellipse cx="${x}" cy="${HEAD.y}" rx="${rx}" ry="${HEAD.ry}"/></clipPath>` +
    `<image href="${uri}" x="${x - rx}" y="${HEAD.y - HEAD.ry}" width="${rx * 2}" height="${HEAD.ry * 2}" clip-path="url(#${id})" preserveAspectRatio="none"/>` +
    `<ellipse cx="${x}" cy="${HEAD.y}" rx="${rx}" ry="${HEAD.ry}" fill="none" stroke="${C.line}" stroke-width="1.2"/>`;
}

function front(sage, wa, uri) {
  const c = sage.color;
  return [
    legs(wa, c, 9),
    rect(-2.5, -82, 5, 5, C.face),
    poly([[-12, -80], [12, -80], [wa ? 15 : 12, -42], [wa ? -15 : -12, -42]], c),
    wa
      ? `<polyline points="-6,-80 0,-66 6,-80" fill="none" stroke="${C.collar}" stroke-width="2"/>`
      : poly([[-4, -80], [4, -80], [0, -67]], C.collar) + `<rect x="-0.9" y="-78" width="1.8" height="10" fill="${C.hair}"/>`,
    rect(-18, -78, 6, 32, c), rect(12, -78, 6, 32, c),
    circle(-15, -44, 3, C.face), circle(15, -44, 3, C.face),
    head(`f-${sage.id}`, 0, HEAD.rx, uri),
  ].join("");
}

// 左を向いた横の姿（顔は正面の写真を左右反転したもの）
function side(sage, wa, uri) {
  const c = sage.color;
  return [
    wa ? poly([[-9, -44], [9, -44], [11, 0], [-11, 0]], C.hakamaGray) : poly([[-6, -44], [6, -44], [6.5, 0], [-6.5, 0]], c),
    rect(-2.5, -82, 5, 5, C.face),
    poly([[-8, -80], [9, -80], [wa ? 11 : 9, -42], [wa ? -11 : -9, -42]], c),
    wa
      ? `<polyline points="-8,-80 -4,-68 -1,-80" fill="none" stroke="${C.collar}" stroke-width="2"/>`
      : poly([[-8, -80], [-4, -80], [-7, -68]], C.collar),
    rect(-3, -77, 6, 32, c),
    circle(-1, -43, 3, C.face),
    head(`s-${sage.id}`, -2, 13, uri),
  ].join("");
}

// 後ろ姿（顔は出さない。髪だけ）
function back(sage, wa) {
  const c = sage.color;
  return [
    legs(wa, c, 9),
    rect(-2.5, -82, 5, 5, C.face),
    poly([[-12, -80], [12, -80], [wa ? 15 : 12, -42], [wa ? -15 : -12, -42]], c),
    rect(-18, -78, 6, 32, c), rect(12, -78, 6, 32, c),
    circle(-15, -44, 3, C.face), circle(15, -44, 3, C.face),
    `<ellipse cx="0" cy="${HEAD.y}" rx="${HEAD.rx}" ry="${HEAD.ry}" fill="${C.hair}"/>`,
    wa ? `<rect x="-2" y="${HEAD.y - HEAD.ry - 5}" width="4" height="8" rx="1.5" fill="${C.hair}"/>` : "",
  ].join("");
}

async function main() {
  const { sages } = JSON.parse(await readFile(CHARACTERS, "utf8"));
  await mkdir(OUT_DIR, { recursive: true });
  const h = PANEL.bottom - PANEL.top;
  for (const sage of sages) {
    if (!sage.portrait) throw new Error(`${sage.id}: portrait がありません`);
    const src = `public/${sage.portrait.src}`;
    const wa = sage.style !== "yo";
    const frontUri = await faceDataUri(src, sage.portrait, HEAD.rx, HEAD.ry, false);
    const sideUri = await faceDataUri(src, sage.portrait, 13, HEAD.ry, true);
    const panels = [front(sage, wa, frontUri), side(sage, wa, sideUri), back(sage, wa)];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PANEL.w * 3 * S}" height="${h * S}" viewBox="0 0 ${PANEL.w * 3} ${h}">` +
      `<rect width="100%" height="100%" fill="#ffffff"/>` +
      panels.map((p, i) => `<g transform="translate(${PANEL.w * i + PANEL.w / 2} ${-PANEL.top})">${p}</g>`).join("") +
      `</svg>`;
    const out = `${OUT_DIR}/sage-${sage.id}.png`;
    await writeFile(out, await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer());
    console.log(out);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
