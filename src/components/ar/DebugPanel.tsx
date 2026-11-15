"use client";

// 状態表示と調整用の折りたたみパネル。3D 側が debugRef に毎フレーム書き、ここは開いている間だけ 200ms ごとに読む。
// 移植元: ar-ebisu-sample/components/ar/DebugPanel.tsx（オブジェクトを選んで詳しく見る形にした）

import { useEffect, useState, type ReactNode, type RefObject } from "react";
import type { GeoStatus } from "@/hooks/useGeolocation";
import type { FacingThresholds } from "@/lib/ar/facing";
import type { GeoFix, LatLng } from "@/lib/ar/geo";
import { MiniMap, type MiniMapData } from "./MiniMap";
import { createDebugInfo, createUserState, type DebugInfo, type HeadingSource, type ObjectDebug, type UserState } from "./types";

const FACE_LABEL: Record<ObjectDebug["face"], string> = { front: "正面", side: "側面", back: "背面" };
const HEADING_LABEL: Record<HeadingSource, string> = {
  "ios-compass": "コンパス（iOS）",
  absolute: "絶対方位（Android）",
  none: "なし（北が不明）",
};
const GEO_STATUS_LABEL: Record<GeoStatus, string> = {
  idle: "未開始",
  watching: "取得中",
  denied: "拒否",
  unsupported: "非対応",
  error: "エラー",
};

/** パネルが 200ms ごとに読み出す表示用スナップショット */
type Snapshot = {
  info: DebugInfo;
  fix: GeoFix | null;
  /** 最新の測位から何秒経ったか */
  fixAgeSec: number;
  fixCount: number;
  headingSource: HeadingSource;
  headingOffsetDeg: number;
  virtual: { x: number; z: number };
  /** ワールド座標の原点（最初の測位） */
  origin: LatLng | null;
  /** 最新の測位をそのままローカル座標にした位置（キー移動は含まない） */
  gps: { x: number; z: number } | null;
  map: MiniMapData;
};

function takeSnapshot(info: DebugInfo, user: UserState, fix: GeoFix | null, fixCount: number, selectedId: string): Snapshot {
  const gps = user.hasFix ? { x: user.gpsX, z: user.gpsZ } : null;
  const objects = Object.fromEntries(Object.entries(info.objects).map(([id, o]) => [id, { ...o }]));
  return {
    info: { ...info, objects },
    fix: fix ? { ...fix } : null,
    fixAgeSec: fix ? (Date.now() - fix.timestamp) / 1000 : 0,
    fixCount,
    headingSource: user.headingSource,
    headingOffsetDeg: (user.headingOffset * 180) / Math.PI,
    virtual: { x: user.virtualX, z: user.virtualZ },
    origin: user.origin ? { ...user.origin } : null,
    gps,
    map: {
      user: { x: info.userX, z: info.userZ, yawDeg: info.cameraYawDeg },
      objects: Object.entries(objects).map(([id, o]) => ({
        id,
        x: o.x,
        z: o.z,
        headingDeg: o.headingDeg,
        homeX: o.homeX,
        homeZ: o.homeZ,
        guideRadiusM: o.guideRadiusM,
        selected: id === selectedId,
      })),
      gps: gps && fix ? { x: gps.x + user.virtualX, z: gps.z + user.virtualZ, accuracy: fix.accuracy } : null,
    },
  };
}

type Props = {
  /** 選べるオブジェクト（id と名前） */
  objects: { id: string; label: string }[];
  /** 三面の素材があるときだけ、面切り替えのしきい値を調整できるようにする */
  showThresholds: boolean;
  debugRef: RefObject<DebugInfo>;
  userRef: RefObject<UserState>;
  geoFixRef: RefObject<GeoFix | null>;
  geoFixCountRef: RefObject<number>;
  geoStatus: GeoStatus;
  geoError: string | null;
  sensorLabel: string;
  eyeHeight: number;
  onEyeHeightChange: (v: number) => void;
  fov: number;
  onFovChange: (v: number) => void;
  thresholds: FacingThresholds;
  onThresholdsChange: (v: FacingThresholds) => void;
  showGuide: boolean;
  onShowGuideChange: (v: boolean) => void;
  onRespawn: () => void;
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ar-debug-row">
      <span className="ar-debug-key">{label}</span>
      <span className="ar-debug-value">{children}</span>
    </div>
  );
}

function Slider(props: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  return (
    <label className="ar-debug-slider">
      <span className="ar-debug-row">
        <span className="ar-debug-key">{props.label}</span>
        <span className="ar-debug-value">
          {props.value}
          {props.unit}
        </span>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function DebugPanel(props: Props) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(props.objects[0]?.id ?? "");
  const [snap, setSnap] = useState<Snapshot>(() => takeSnapshot(createDebugInfo(), createUserState(), null, 0, ""));
  const { debugRef, userRef, geoFixRef, geoFixCountRef } = props;

  useEffect(() => {
    if (!open) return;
    const read = () => setSnap(takeSnapshot(debugRef.current, userRef.current, geoFixRef.current, geoFixCountRef.current, selectedId));
    read();
    const id = setInterval(read, 200);
    return () => clearInterval(id);
  }, [open, selectedId, debugRef, userRef, geoFixRef, geoFixCountRef]);

  const { thresholds, onThresholdsChange } = props;
  const { info, fix } = snap;
  const o = info.objects[selectedId];

  return (
    <div className="ar-debug">
      <div className="ar-debug-actions">
        <button type="button" className="btn btn-secondary" onClick={props.onRespawn}>
          出し直す
        </button>
        <button type="button" className="btn btn-ghost ar-debug-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? "閉じる" : "デバッグ"}
        </button>
      </div>
      {open && (
        <div className="ar-debug-body">
          <div className="ar-debug-map">
            <MiniMap {...snap.map} />
          </div>
          <Row label="センサー">{props.sensorLabel}</Row>
          <Row label="方位の基準">
            {HEADING_LABEL[snap.headingSource]}
            {snap.headingSource !== "none" ? `（補正 ${snap.headingOffsetDeg.toFixed(0)}°）` : ""}
          </Row>
          <Row label="位置情報">
            {GEO_STATUS_LABEL[props.geoStatus]}
            {fix ? ` / ±${fix.accuracy.toFixed(0)}m / ${snap.fixCount}回` : ""}
          </Row>
          {fix && (
            <Row label="緯度経度">
              {fix.lat.toFixed(6)}, {fix.lng.toFixed(6)}（{snap.fixAgeSec.toFixed(0)}秒前）
            </Row>
          )}
          {props.geoError && <Row label="位置情報エラー">{props.geoError}</Row>}
          {snap.origin && (
            <Row label="原点">
              {snap.origin.lat.toFixed(6)}, {snap.origin.lng.toFixed(6)}
            </Row>
          )}
          {snap.gps && (
            <Row label="GPS の座標">
              ({snap.gps.x.toFixed(1)}, {snap.gps.z.toFixed(1)})
            </Row>
          )}
          <Row label="自分の座標">
            ({info.userX.toFixed(1)}, {info.userZ.toFixed(1)})
            {snap.virtual.x || snap.virtual.z ? " ※キー移動込み" : ""}
          </Row>
          <Row label="視線 yaw / pitch">
            {info.cameraYawDeg.toFixed(0)}° / {info.cameraPitchDeg.toFixed(0)}°
          </Row>

          <label className="ar-debug-row">
            <span className="ar-debug-key">詳しく見る</span>
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {props.objects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          {o ? (
            <>
              <Row label="見下ろす角度">{o.lookDownDeg.toFixed(0)}°</Row>
              <Row label="座標 / ホーム">
                ({o.x.toFixed(1)}, {o.z.toFixed(1)}) / ({o.homeX.toFixed(1)}, {o.homeZ.toFixed(1)})
              </Row>
              <Row label="距離">{o.distance.toFixed(2)} m</Row>
              <Row label="θ / 面">
                {o.thetaDeg.toFixed(0)}° / {FACE_LABEL[o.face]}
                {o.flipped ? "（反転）" : ""}
              </Row>
              <Row label="状態">{o.status}</Row>
            </>
          ) : (
            <Row label="状態">まだ出ていない</Row>
          )}

          <Slider label="スマホの高さ（床から）" value={props.eyeHeight} min={0.5} max={2} step={0.05} unit=" m" onChange={props.onEyeHeightChange} />
          <Slider label="画角 (FOV)" value={props.fov} min={40} max={90} step={1} unit="°" onChange={props.onFovChange} />
          {props.showThresholds && (
            <>
              <Slider
                label="正面になる角度 θ <"
                value={thresholds.frontDeg}
                min={10}
                max={Math.min(89, thresholds.backDeg - 10)}
                step={1}
                unit="°"
                onChange={(v) => onThresholdsChange({ ...thresholds, frontDeg: v })}
              />
              <Slider
                label="背面になる角度 θ >"
                value={thresholds.backDeg}
                min={Math.max(91, thresholds.frontDeg + 10)}
                max={170}
                step={1}
                unit="°"
                onChange={(v) => onThresholdsChange({ ...thresholds, backDeg: v })}
              />
            </>
          )}
          <label className="ar-debug-check">
            <input type="checkbox" checked={props.showGuide} onChange={(e) => props.onShowGuideChange(e.target.checked)} />
            <span>活動範囲を地面に表示</span>
          </label>
          <p className="ar-debug-note">PC: WASD / 矢印キーで歩く、ドラッグで見回す</p>
        </div>
      )}
    </div>
  );
}
