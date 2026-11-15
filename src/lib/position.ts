// 今いる場所（緯度・経度）。ミニマップが読み、GPS か 3D 側が書く。
// ・GPS：ミニマップが watchPosition で取って、ここに書く（source: 'gps'）
// ・3D 側：会場で歩かずに見せるとき（地図を押してそこに立ったことにする、など）は setPosition(lat, lng, 'demo') を呼ぶ。
//   デモの位置を書いたあとは、GPS の値で上書きしない（clearDemo() で GPS に戻す）

export type Position = { lat: number; lng: number; accuracy?: number; source: 'gps' | 'demo' };

let current: Position | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};
export const getPosition = () => current;

export function setPosition(lat: number, lng: number, source: Position['source'] = 'demo', accuracy?: number) {
  if (source === 'gps' && current?.source === 'demo') return;
  current = { lat, lng, accuracy, source };
  emit();
}

export function clearDemo() {
  if (current?.source === 'demo') current = null;
  emit();
}

// 2点間の距離（m）。近い距離なので平面で近似する
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180 * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  return Math.hypot(dLat, dLng) * R;
}
