'use client';

// AR で回っているあいだ、画面の右下に出す小さな地図。今いる場所と、えびす像（場所の分かる 826 体）を出す。
// ・印の色はレア度（N 灰／R 青／SR 金／SSR 紫）。集めた像は濃く、まだの像は薄く。デモの3体は白い縁で大きく
// ・印を押すと名前とレア度。「広げる」で大きくなる。「現在地」で今いる場所に戻る
// ・今いる場所は GPS（許可がなければ柳町付近）。3D 側がデモの位置を lib/position.ts に書けば、それに従う
// 地図：地理院タイル（淡色地図）。Leaflet はブラウザでしか動かないので、開いてから読み込む。

import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as progress from '@/lib/progress';
import * as position from '@/lib/position';
import { mapStatues, MAP_ORIGIN } from '@/lib/catalog';
import { GRADES } from '@/lib/rarity';

// 地図の印の色（絵の色なので、トークンではなくここで決める。試作 statues.js と同じ）
const GRADE_COLOR = { N: '#9ca3af', R: '#60a5fa', SR: '#fbbf24', SSR: '#c084fc' } as const;
const ZOOM = 16;

export function MiniMap() {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [gpsNote, setGpsNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cleanups: (() => void)[] = [];

    (async () => {
      const L = await import('leaflet');
      if (cancelled || !box.current) return;
      const start = position.getPosition() ?? MAP_ORIGIN;
      const m = L.map(box.current, { zoomControl: false, attributionControl: true }).setView([start.lat, start.lng], ZOOM);
      map.current = m;
      L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>',
      }).addTo(m);
      m.attributionControl.setPrefix(false);

      // えびす像の印（数が多いので canvas に描く）
      const renderer = L.canvas({ padding: 0.3 });
      const markers = mapStatues.map((e) => {
        const demo = e.key.startsWith('ebisu:');
        const mk = L.circleMarker([e.lat!, e.lng!], {
          renderer,
          radius: demo ? 9 : e.grade === 'SSR' ? 7 : 5,
          color: demo ? '#ffffff' : '#111827',
          weight: demo ? 2 : 1,
          fillColor: GRADE_COLOR[e.grade],
          fillOpacity: 0.55,
        }).bindTooltip(`【${e.grade}】${e.name}`, { direction: 'top' }).addTo(m);
        return { e, mk };
      });
      const paint = () => {
        for (const { e, mk } of markers) mk.setStyle({ fillOpacity: progress.has(e.key) ? 1 : 0.55 });
      };
      paint();
      cleanups.push(progress.subscribe(paint));

      // 今いる場所（青い点と、GPS の誤差の輪）
      const me = L.circleMarker([start.lat, start.lng], {
        radius: 6, color: '#ffffff', weight: 2, fillColor: '#2563eb', fillOpacity: 1,
      }).bindTooltip('今いる場所').addTo(m);
      const acc = L.circle([start.lat, start.lng], { radius: 0, color: '#2563eb', weight: 1, fillOpacity: 0.1 }).addTo(m);
      me.setStyle({ opacity: position.getPosition() ? 1 : 0, fillOpacity: position.getPosition() ? 1 : 0 });
      let first = true;
      const move = () => {
        const p = position.getPosition();
        if (!p) return;
        me.setLatLng([p.lat, p.lng]).setStyle({ opacity: 1, fillOpacity: 1 });
        acc.setLatLng([p.lat, p.lng]).setRadius(p.accuracy ?? 0);
        if (first) { m.setView([p.lat, p.lng], ZOOM); first = false; } else m.panTo([p.lat, p.lng], { animate: true });
      };
      cleanups.push(position.subscribe(move));
      move();
    })();

    // GPS。許可されなければ柳町付近を出したまま
    let watch: number | null = null;
    if ('geolocation' in navigator) {
      watch = navigator.geolocation.watchPosition(
        (p) => { setGpsNote(null); position.setPosition(p.coords.latitude, p.coords.longitude, 'gps', p.coords.accuracy); },
        () => setGpsNote('位置情報が使えないので、柳町付近を出しています'),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
      );
    }

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
      if (watch != null) navigator.geolocation.clearWatch(watch);
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // 広げたり、たたんだりしたら、地図に大きさを測り直させる
  useEffect(() => {
    const t = setTimeout(() => map.current?.invalidateSize(), 220);
    return () => clearTimeout(t);
  }, [expanded]);

  const recenter = () => {
    const p = position.getPosition() ?? MAP_ORIGIN;
    map.current?.setView([p.lat, p.lng], ZOOM);
  };

  return (
    <section className={`minimap${expanded ? ' is-expanded' : ''}`} aria-label="えびす像の地図">
      <div ref={box} className="minimap-map" />
      <div className="minimap-tools">
        <button type="button" className="btn btn-secondary btn-sm" onClick={recenter}>現在地</button>
        <button type="button" className="btn btn-secondary btn-sm" aria-pressed={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? 'たたむ' : '広げる'}
        </button>
      </div>
      {expanded && (
        <p className="minimap-legend">
          {(Object.keys(GRADE_COLOR) as (keyof typeof GRADE_COLOR)[]).map((g) => (
            <span key={g}><i style={{ background: GRADE_COLOR[g] }} />{g}（{GRADES[g].name}）</span>
          ))}
          <span>濃い印は集めた像。白い縁はデモの3体</span>
        </p>
      )}
      {gpsNote && expanded && <p className="minimap-note">{gpsNote}</p>}
    </section>
  );
}
