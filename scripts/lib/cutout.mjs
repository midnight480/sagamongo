// 素材画像の白背景を透過する処理
/** これ以上明るく、外周と連結している画素を背景とみなす */
const BG_THRESHOLD = 232;
/** 外周と繋がっていない閉領域（脚の間など）を背景とみなす明度と最小面積 */
const ENCLOSED_THRESHOLD = 245;
const ENCLOSED_MIN_AREA = 150;

/**
 * 背景マスクを作る（1 = 背景）
 * 1. 外周から明るい画素をフラッドフィル（像内部のハイライトは抜かない）
 * 2. 外周と繋がらない純白の閉領域（脚の間など）も、一定面積以上なら背景にする
 */
export function backgroundMask(data, width, height, channels) {
  const brightAt = (threshold) => (i) => {
    const o = i * channels;
    return data[o] >= threshold && data[o + 1] >= threshold && data[o + 2] >= threshold;
  };
  const mask = new Uint8Array(width * height);

  /** seeds から条件を満たす画素を塗り、塗った画素の index 一覧を返す */
  const fill = (seeds, isTarget, marker) => {
    const filled = [];
    const stack = [];
    const push = (i) => {
      if (!mask[i] && isTarget(i)) {
        mask[i] = marker;
        stack.push(i);
        filled.push(i);
      }
    };
    seeds.forEach(push);
    while (stack.length) {
      const i = stack.pop();
      const x = i % width;
      if (x > 0) push(i - 1);
      if (x < width - 1) push(i + 1);
      if (i >= width) push(i - width);
      if (i + width < mask.length) push(i + width);
    }
    return filled;
  };

  const edgeSeeds = [];
  for (let x = 0; x < width; x++) edgeSeeds.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y++) edgeSeeds.push(y * width, y * width + width - 1);
  fill(edgeSeeds, brightAt(BG_THRESHOLD), 1);

  const isEnclosedWhite = brightAt(ENCLOSED_THRESHOLD);
  const TEMP = 2;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] || !isEnclosedWhite(i)) continue;
    const region = fill([i], isEnclosedWhite, TEMP);
    const value = region.length >= ENCLOSED_MIN_AREA ? 1 : 3; // 3 = 小さいハイライト（前景のまま）
    for (const j of region) mask[j] = value;
  }
  for (let i = 0; i < mask.length; i++) if (mask[i] === 3) mask[i] = 0;
  return mask;
}

/** RGBA バッファを生成し、境界 1px は明度に応じて半透明にする */
export function toRgba(data, mask, width, height, channels) {
  const out = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const o = i * channels;
    out[i * 4] = data[o];
    out[i * 4 + 1] = data[o + 1];
    out[i * 4 + 2] = data[o + 2];
    if (mask[i]) {
      out[i * 4 + 3] = 0;
      continue;
    }
    const x = i % width;
    const nearBg =
      (x > 0 && mask[i - 1]) ||
      (x < width - 1 && mask[i + 1]) ||
      (i >= width && mask[i - width]) ||
      (i + width < mask.length && mask[i + width]);
    if (nearBg) {
      const lum = (data[o] + data[o + 1] + data[o + 2]) / 3;
      // 白に近いほど透明に（白フチ対策）
      out[i * 4 + 3] = Math.max(0, Math.min(255, Math.round(((255 - lum) / (255 - 120)) * 255)));
    } else {
      out[i * 4 + 3] = 255;
    }
  }
  return out;
}
