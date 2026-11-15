"use client";

// 真上から見た配置図（上 = 北）。ユーザーを中心に、オブジェクト全部・活動範囲・GPS の誤差円を描く。
// SVG の座標はワールドの (x, z) をそのまま使う（+X = 東 = 右、+Z = 南 = 下）。
// 移植元: ar-ebisu-sample/components/ar/MiniMap.tsx（複数オブジェクトを描けるようにした）

export type MiniMapObject = {
  id: string;
  x: number;
  z: number;
  headingDeg: number;
  homeX: number;
  homeZ: number;
  guideRadiusM: number | null;
  /** デバッグパネルで選んでいるもの（強調する） */
  selected: boolean;
};

export type MiniMapData = {
  user: { x: number; z: number; yawDeg: number };
  objects: MiniMapObject[];
  /** 最新の測位位置（仮想移動込み）と誤差半径。測位がなければ null */
  gps: { x: number; z: number; accuracy: number } | null;
};

const SIZE = 168;
const DEG = Math.PI / 180;
const OBJECT_COLOR = "#fb923c";
const GUIDE_COLOR = "#ffd54a";
const GPS_COLOR = "#38bdf8";

export function MiniMap({ user, objects, gps }: MiniMapData) {
  // いちばん遠い活動範囲の外側まで入るように縮尺を決める（12〜80m）
  const reach = Math.max(0, ...objects.map((o) => Math.hypot(o.homeX - user.x, o.homeZ - user.z) + (o.guideRadiusM ?? 0)));
  const range = Math.min(80, Math.max(12, reach + 2));
  const s = range / 40; // 線の太さ・点の大きさの基準
  const ray = (yawDeg: number, len: number) => ({ x: Math.sin(yawDeg * DEG) * len, z: -Math.cos(yawDeg * DEG) * len });
  const view = ray(user.yawDeg, range * 0.35);

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`${user.x - range} ${user.z - range} ${range * 2} ${range * 2}`}
      className="ar-minimap"
      role="img"
      aria-label="配置図（上が北）"
    >
      <line x1={user.x} y1={user.z - range} x2={user.x} y2={user.z + range} stroke="white" strokeOpacity={0.15} strokeWidth={s * 0.3} />
      <line x1={user.x - range} y1={user.z} x2={user.x + range} y2={user.z} stroke="white" strokeOpacity={0.15} strokeWidth={s * 0.3} />
      <text x={user.x} y={user.z - range + s * 4} fill="white" fontSize={s * 4} textAnchor="middle">
        N
      </text>

      {objects.map((o) =>
        o.guideRadiusM === null ? null : (
          <circle
            key={`guide-${o.id}`}
            cx={o.homeX}
            cy={o.homeZ}
            r={o.guideRadiusM}
            fill="none"
            stroke={GUIDE_COLOR}
            strokeOpacity={o.selected ? 0.8 : 0.3}
            strokeWidth={s * 0.4}
            strokeDasharray={`${s * 1.5} ${s}`}
          />
        ),
      )}
      {gps && <circle cx={gps.x} cy={gps.z} r={gps.accuracy} fill={GPS_COLOR} fillOpacity={0.15} stroke={GPS_COLOR} strokeWidth={s * 0.3} />}

      {objects.map((o) => {
        const walk = { x: Math.cos(o.headingDeg * DEG) * s * 3, z: Math.sin(o.headingDeg * DEG) * s * 3 };
        return (
          <g key={o.id} opacity={o.selected ? 1 : 0.6}>
            <line x1={o.x} y1={o.z} x2={o.x + walk.x} y2={o.z + walk.z} stroke={OBJECT_COLOR} strokeWidth={s * 0.6} />
            <circle cx={o.x} cy={o.z} r={s * (o.selected ? 1.6 : 1.1)} fill={OBJECT_COLOR} />
          </g>
        );
      })}

      <line x1={user.x} y1={user.z} x2={user.x + view.x} y2={user.z + view.z} stroke="white" strokeWidth={s * 0.5} />
      <circle cx={user.x} cy={user.z} r={s * 1.4} fill="white" />
    </svg>
  );
}
