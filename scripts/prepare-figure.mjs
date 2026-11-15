// AR に出す人物・オブジェクトの素材を生成する（手動実行: npm run prepare:figure）
// - 元画像（横に views の数だけ並んだ図。白背景）を等分し、透過 PNG を views の数だけ出力
// - シルエット + 縁の形に切り抜いた看板メッシュを three.js BufferGeometry JSON で出力
//   - frontBack: 表に正面、裏に背面（views に back が無ければ正面を裏にも使う）
//   - side: views に side があるときだけ（側面画像は「左向き」が前提）
// 入力: src/data/ar-objects.json の figures / 出力: public/figures/<id>/{<view>.png, board.json}
// 移植元: ar-ebisu-sample/scripts/prepare-figure.mjs（三面固定 → views で可変にした）
import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { backgroundMask, toRgba } from "./lib/cutout.mjs";
import { buildSilhouetteOutline } from "./lib/outline.mjs";
import { buildBoardGeometryJSON } from "./lib/board-geometry.mjs";

const CONFIG_PATH = "src/data/ar-objects.json";
const OUT_ROOT = "public/figures";
const KNOWN_VIEWS = ["front", "side", "back"];
/** 出力画像の高さ（px）。全部の面で揃える */
const OUT_HEIGHT = 1024;
/** 足元下・左右の余白（px） */
const PAD = 4;

/** 元画像を views の数で等分・透過・トリミングし、高さを揃えた PNG バッファを返す */
async function cutViews(source, views) {
  const meta = await sharp(source).metadata();
  const colWidth = Math.floor(meta.width / views.length);
  const out = {};
  for (const [idx, view] of views.entries()) {
    const { data, info } = await sharp(source)
      .extract({ left: idx * colWidth, top: 0, width: colWidth, height: meta.height })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    const rgba = toRgba(data, backgroundMask(data, width, height, channels), width, height, channels);
    const trimmed = await sharp(rgba, { raw: { width, height, channels: 4 } })
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 })
      .png()
      .toBuffer();
    const resized = await sharp(trimmed).resize({ height: OUT_HEIGHT - PAD }).png().toBuffer();
    out[view] = await sharp(resized)
      .extend({ top: 0, bottom: PAD, left: PAD, right: PAD, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
  }
  return out;
}

/** 看板 1 枚分（表と裏の画像）のメッシュを作る。裏の画像は裏から見るので左右反転して輪郭に含める */
async function buildBoard(frontPng, backPng, figure, board) {
  const outline = await buildSilhouetteOutline(
    [
      { png: frontPng, mirror: false },
      { png: backPng, mirror: true },
    ],
    // 面取り(bevel)で外周が広がる分を差し引いておく
    { heightM: figure.heightM, rimM: board.rimM - board.bevelM, minRimM: board.minRimM, maxVertices: board.maxVertices },
  );
  const geometry = buildBoardGeometryJSON(outline.points, board);
  return { outline, ...geometry };
}

function validateViews(figure) {
  const views = figure.views;
  if (!Array.isArray(views) || !views.includes("front") || views.some((v) => !KNOWN_VIEWS.includes(v))) {
    throw new Error(`${figure.id}: views には front を含め、${KNOWN_VIEWS.join(" / ")} だけを並べてください`);
  }
  return views;
}

async function main() {
  const { board, figures } = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  const report = [];
  for (const figure of figures) {
    const views = validateViews(figure);
    const outDir = path.join(OUT_ROOT, figure.id);
    await mkdir(outDir, { recursive: true });

    const images = await cutViews(figure.source, views);
    for (const view of views) await writeFile(path.join(outDir, `${view}.png`), images[view]);

    const boards = { frontBack: await buildBoard(images.front, images.back ?? images.front, figure, board) };
    if (images.side) boards.side = await buildBoard(images.side, images.side, figure, board);

    const out = {
      thicknessM: board.thicknessM,
      bevelM: board.bevelM,
      geometries: Object.fromEntries(Object.entries(boards).map(([k, v]) => [k, v.json])),
    };
    await writeFile(path.join(outDir, "board.json"), JSON.stringify(out));

    for (const [name, b] of Object.entries(boards)) {
      report.push({
        figure: figure.id,
        board: name,
        outlineVertices: b.outline.points.length,
        rimCm: +(b.outline.rimM * 100 + board.bevelM * 100).toFixed(1),
        maxDeviationCm: +(b.outline.maxDeviationM * 100).toFixed(1),
        meshVertices: b.vertexCount,
        triangles: b.triangleCount,
      });
    }
  }
  console.table(report);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
