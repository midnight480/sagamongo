"use client";

// 素材を貼った「歩く看板」（人物の形に切り抜いた厚みのある板）。表示面の切替や移動は ref 経由で外から行う。
// 移植元: ar-ebisu-sample/components/ar/FigureBoard.tsx（二面・三面のどちらの素材も描けるようにした）

import { Html, useTexture } from "@react-three/drei";
import { useLoader } from "@react-three/fiber";
import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, type Ref } from "react";
import * as THREE from "three";
import type { FigureDefinition, FigureFace } from "@/lib/ar/objects";

/** 写真を板面から浮かせる量（Z-fighting 防止） */
const PHOTO_OFFSET = 0.002;
/** 名札を頭上どれだけ上に出すか */
const LABEL_GAP = 0.25;

const RIM_COLOR = "#ffffff";
const EDGE_COLOR = "#e6e6e6";

/** SceneObject から毎フレーム操作するためのハンドル */
export type FigureBoardApi = {
  /** 位置と進行方向の向き */
  root: THREE.Group;
  /** 歩行アニメ（上下・左右の揺れ）用 */
  body: THREE.Group;
  /** 看板の向き（正面/背面 = 0、側面 = ±90°）を回す軸 */
  pivot: THREE.Group;
  /** 表に正面、裏に背面を貼った看板 */
  frontBack: THREE.Group;
  /** 側面を貼った看板。素材に側面が無ければ null */
  side: THREE.Group | null;
};

type Props = {
  figure: FigureDefinition;
  label: string;
  /** 名札を出すか。出現する前は原点に名札だけ浮かないよう false にする */
  showLabel: boolean;
  ref?: Ref<FigureBoardApi>;
};

function aspectOf(tex: THREE.Texture): number {
  const image = tex.image as { width: number; height: number };
  return image.width / image.height;
}

function useShadowTexture() {
  const texture = useMemo(() => {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(0,0,0,0.6)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

/** scripts/prepare-figure.mjs が出力する board.json。side は三面の素材だけ */
type BoardAsset = {
  thicknessM: number;
  bevelM: number;
  geometries: { frontBack: object; side?: object };
};

/** ビルド時に生成した看板メッシュを読み込む（実行時の輪郭計算なし） */
function useBoardGeometries(url: string) {
  const asset = useLoader(THREE.FileLoader, url, (loader) => loader.setResponseType("json")) as unknown as BoardAsset;
  const geometries = useMemo(() => {
    const loader = new THREE.BufferGeometryLoader();
    const frontBack = loader.parse(asset.geometries.frontBack);
    frontBack.computeBoundingBox();
    const side = asset.geometries.side ? loader.parse(asset.geometries.side) : null;
    return { frontBack, side };
  }, [asset]);
  useEffect(
    () => () => {
      geometries.frontBack.dispose();
      geometries.side?.dispose();
    },
    [geometries],
  );
  return {
    ...geometries,
    photoZ: asset.thicknessM / 2 + asset.bevelM + PHOTO_OFFSET,
    /** 看板の上端（m）。名札の位置に使う */
    top: geometries.frontBack.boundingBox!.max.y,
  };
}

/** 板面に貼る写真 1 枚。back=true で裏面側（180° 回転）に貼る */
function Photo({ texture, height, z, back = false }: { texture: THREE.Texture; height: number; z: number; back?: boolean }) {
  return (
    <mesh position={[0, height / 2, back ? -z : z]} rotation-y={back ? Math.PI : 0}>
      <planeGeometry args={[height * aspectOf(texture), height]} />
      <meshBasicMaterial map={texture} alphaTest={0.5} />
    </mesh>
  );
}

type SilhouetteBoardProps = {
  geometry: THREE.BufferGeometry;
  front: THREE.Texture;
  back: THREE.Texture;
  photoHeight: number;
  photoZ: number;
};

/** 人物の形 + 縁に切り抜いた、厚みのある看板。表と裏にそれぞれ写真を貼る。下端が地面（y=0） */
function SilhouetteBoard({ geometry, front, back, photoHeight, photoZ }: SilhouetteBoardProps) {
  return (
    <group>
      <mesh geometry={geometry}>
        {/* グループ: 0 = 表裏の面, 1 = 側面 */}
        <meshLambertMaterial attach="material-0" color={RIM_COLOR} />
        <meshLambertMaterial attach="material-1" color={EDGE_COLOR} />
      </mesh>
      <Photo texture={front} height={photoHeight} z={photoZ} />
      <Photo texture={back} height={photoHeight} z={photoZ} back />
    </group>
  );
}

/** 頭上に浮かぶ名札。距離に応じて大きさが変わるので距離感の手がかりにもなる */
// 出現前は hidden で隠すだけにして、マウントは最初からしておく。後からマウントすると、
// drei の Html はカメラか位置が動くまで距離に応じた拡大率を当てない（止まっている像の名札が大きく出る）
function NameLabel({ name, y, hidden }: { name: string; y: number; hidden: boolean }) {
  return (
    <Html position={[0, y, 0]} center distanceFactor={4} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
      <div className="ar-name-label" hidden={hidden}>
        {name}
      </div>
    </Html>
  );
}

export function FigureBoard({ figure, label, showLabel, ref }: Props) {
  const textures = useTexture(figure.images as Record<string, string>) as Partial<Record<FigureFace, THREE.Texture>>;
  const shadowTexture = useShadowTexture();
  const board = useBoardGeometries(figure.boardUrl);

  useLayoutEffect(() => {
    for (const tex of Object.values(textures)) {
      if (!tex) continue;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      tex.needsUpdate = true;
    }
  }, [textures]);

  const rootRef = useRef<THREE.Group>(null!);
  const bodyRef = useRef<THREE.Group>(null!);
  const pivotRef = useRef<THREE.Group>(null!);
  const frontBackRef = useRef<THREE.Group>(null!);
  const sideRef = useRef<THREE.Group>(null);

  useImperativeHandle(
    ref,
    () => ({
      root: rootRef.current,
      body: bodyRef.current,
      pivot: pivotRef.current,
      frontBack: frontBackRef.current,
      side: sideRef.current,
    }),
    [],
  );

  const front = textures.front!;
  // 背面の画像が無い素材は、裏にも正面を貼る（prepare-figure.mjs の輪郭も同じ組み合わせで作っている）
  const back = textures.back ?? front;
  const side = board.side ? textures.side : undefined;
  const photoHeight = figure.heightM;
  const shadowSize = photoHeight * aspectOf(front) * 1.3;

  return (
    <group ref={rootRef} visible={false}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.002}>
        <planeGeometry args={[shadowSize, shadowSize * 0.7]} />
        <meshBasicMaterial map={shadowTexture} transparent depthWrite={false} />
      </mesh>
      <group ref={bodyRef}>
        <group ref={pivotRef}>
          <group ref={frontBackRef}>
            <SilhouetteBoard geometry={board.frontBack} front={front} back={back} photoHeight={photoHeight} photoZ={board.photoZ} />
          </group>
          {board.side && side && (
            <group ref={sideRef} visible={false}>
              <SilhouetteBoard geometry={board.side} front={side} back={side} photoHeight={photoHeight} photoZ={board.photoZ} />
            </group>
          )}
        </group>
        <NameLabel name={label} y={board.top + LABEL_GAP} hidden={!showLabel} />
      </group>
    </group>
  );
}
