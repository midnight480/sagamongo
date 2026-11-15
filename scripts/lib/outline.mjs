// 人物シルエット（透過 PNG の不透明部分）を外へ広げ、指定頂点数以下の多角形に簡略化する
import sharp from "sharp";

/** 8 近傍（時計回り, 画像座標で y 下向き）: W, NW, N, NE, E, SE, S, SW */
const DX = [-1, -1, 0, 1, 1, 1, 0, -1];
const DY = [0, -1, -1, -1, 0, 1, 1, 1];

const directionIndex = (dx, dy) => {
  for (let i = 0; i < 8; i++) if (DX[i] === dx && DY[i] === dy) return i;
  return 0;
};

/** マスクを半径 r px の円で膨張させる（境界画素だけを起点に塗る） */
function dilate(mask, w, h, r) {
  const out = new Uint8Array(mask);
  const offsets = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) offsets.push([dx, dy]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      const isEdge = x === 0 || y === 0 || x === w - 1 || y === h - 1 || !mask[i - 1] || !mask[i + 1] || !mask[i - w] || !mask[i + w];
      if (!isEdge) continue;
      for (const [dx, dy] of offsets) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h) out[ny * w + nx] = 1;
      }
    }
  }
  return out;
}

/** Moore 近傍追跡で、最初に見つかった領域の外周をたどる（内側の穴は無視＝埋まる） */
function traceOuterContour(mask, w, h) {
  const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  let start = null;
  for (let y = 0; y < h && !start; y++) {
    for (let x = 0; x < w; x++) {
      if (inside(x, y)) {
        start = { x, y };
        break;
      }
    }
  }
  if (!start) return [];

  const contour = [start];
  let cur = start;
  let backDir = 0; // 開始画素には西（外側）から入ったとみなす
  for (let step = 0, max = w * h * 2; step < max; step++) {
    let next = null;
    for (let i = 1; i <= 8; i++) {
      const d = (backDir + i) % 8;
      const nx = cur.x + DX[d];
      const ny = cur.y + DY[d];
      if (inside(nx, ny)) {
        const pd = (d + 7) % 8; // 直前に調べた（外側の）画素
        next = { x: nx, y: ny };
        backDir = directionIndex(cur.x + DX[pd] - nx, cur.y + DY[pd] - ny);
        break;
      }
    }
    if (!next || (next.x === start.x && next.y === start.y)) break;
    contour.push(next);
    cur = next;
  }
  return contour;
}

/** Douglas–Peucker による間引き（閉路は 2 分割して処理） */
function simplifyClosed(points, epsilon) {
  const dp = (pts) => {
    if (pts.length < 3) return pts;
    const a = pts[0];
    const b = pts[pts.length - 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    let maxDist = 0;
    let index = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i];
      const dist = Math.abs((b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x) / len;
      if (dist > maxDist) {
        maxDist = dist;
        index = i;
      }
    }
    if (maxDist <= epsilon) return [a, b];
    return [...dp(pts.slice(0, index + 1)).slice(0, -1), ...dp(pts.slice(index))];
  };
  const mid = Math.floor(points.length / 2);
  const first = dp(points.slice(0, mid + 1));
  const second = dp([...points.slice(mid), points[0]]);
  return [...first.slice(0, -1), ...second.slice(0, -1)];
}

/** 頂点数が maxVertices 以下になる最小の許容誤差を二分探索で求めて間引く */
function simplifyToCount(points, maxVertices) {
  let lo = 0;
  let hi = 1;
  while (simplifyClosed(points, hi).length > maxVertices) hi *= 2;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (simplifyClosed(points, mid).length > maxVertices) lo = mid;
    else hi = mid;
  }
  return { points: simplifyClosed(points, hi), epsilon: hi };
}

/** 透過 PNG 群（反転指定つき）を中央揃えで重ね、不透明マスクを作る */
async function compositeMask(layers, resolution, pad) {
  const scaled = await Promise.all(
    layers.map(async ({ png, mirror }) => {
      let img = sharp(png).resize({ height: resolution });
      if (mirror) img = img.flop();
      const { data, info } = await img.png().toBuffer({ resolveWithObject: true });
      return { data, width: info.width };
    }),
  );
  const w = Math.max(...scaled.map((s) => s.width)) + pad * 2;
  const h = resolution + pad * 2;
  const { data } = await sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(scaled.map((s) => ({ input: s.data, left: Math.round((w - s.width) / 2), top: pad })))
    .raw()
    .toBuffer({ resolveWithObject: true });
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] > 128 ? 1 : 0;
  return { mask, w, h };
}

/**
 * シルエットの和集合を rimM 広げ、maxVertices 角形以下に簡略化した外周を返す（m 単位, 足元中央が原点, y 上向き）。
 * 間引きで縁が minRimM より細くならないよう、必要なら膨張量を増やして再計算する。
 */
export async function buildSilhouetteOutline(layers, { heightM, rimM, minRimM, maxVertices, resolution = 256 }) {
  const mPerPx = heightM / resolution;
  let dilatePx = Math.max(1, Math.round(rimM / mPerPx));
  const minRimPx = minRimM / mPerPx;

  for (let attempt = 0; attempt < 6; attempt++) {
    const pad = dilatePx + 2;
    const { mask, w, h } = await compositeMask(layers, resolution, pad);
    const groundPx = pad + resolution;
    // 地面より下は平らに切りそろえてから間引く
    const contour = traceOuterContour(dilate(mask, w, h, dilatePx), w, h).map((p) => ({ x: p.x, y: Math.min(p.y, groundPx) }));
    const { points, epsilon } = simplifyToCount(contour, maxVertices);

    if (dilatePx - epsilon >= minRimPx || attempt === 5) {
      return {
        points: points.map((p) => ({ x: (p.x - w / 2) * mPerPx, y: (groundPx - p.y) * mPerPx })),
        rimM: dilatePx * mPerPx,
        maxDeviationM: epsilon * mPerPx,
      };
    }
    dilatePx = Math.ceil(epsilon + minRimPx);
  }
  throw new Error("unreachable");
}
