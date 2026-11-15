// 図鑑とガチャに並べるもの（えびす像・七賢人）を、data/ の JSON から組み立てる。
// 試作では 3D 側（walk.js）が作った「板の絵」を図鑑に出していたが、フレーム側は 3D に頼らず、
// えびす像は公式サイトの写真、七賢人は国立国会図書館の肖像写真を出す。
// 移植元：smart-hackathon-20261115/prototype/sanpo/walk.js の main()（bookEntries / catalogEntries）

import catalogData from '@/data/ebisu-catalog.json';
import characters from '@/data/characters.json';
import ebisuDemo from '@/data/ebisu-demo.json';
import chaptersData from '@/data/chapters.json';
import rankingData from '@/data/ranking-demo.json';
import { isGrade, type Grade } from './rarity';
import type { Chapter } from './progress';

// えびす像を SAGE_EVERY 体集めるごとに、七賢人が一人仲間になる。N → R → SR → SSR の順
export const SAGE_EVERY = 10;
const GRADE_ORDER: Grade[] = ['N', 'R', 'SR', 'SSR'];

const toGrade = (g: unknown): Grade => (isGrade(g) ? g : 'N');

export type Portrait = { src: string; cx: number; cy: number; ry: number; flip?: boolean; credit: string; url: string };

export type Sage = {
  id: string;
  name: string;
  years: string;
  bio: string;
  grade: Grade;
  color: string;
  portrait: Portrait | null;
};

export type Entry = {
  key: string; // 'ebisu:mojitai' / 'sage:naomasa' / 'cat:754'
  name: string;
  grade: Grade;
  sub?: string; // 集めたあとに出す説明
  hint?: string; // まだのときに出すヒント
  photo?: string; // えびす像の写真（公式サイトから表示する。リポジトリには置かない）
  url?: string; // 公式サイトのページ
  portrait?: Portrait | null; // 七賢人の肖像
  address?: string;
  fid?: number;
  located?: boolean;
  lat?: number; // 位置（ミニマップに出す）
  lng?: number;
};

export const CREDIT: string = catalogData.credit;

const fidOf = (url?: string) => Number(/fid=(\d+)/.exec(url ?? '')?.[1]) || null;
const catalogByFid = new Map(catalogData.items.map((it) => [it.fid, it]));

export const sages: Sage[] = characters.sages.map((s) => ({
  id: s.id,
  name: s.name,
  years: s.years,
  bio: s.bio,
  grade: toGrade(s.grade),
  color: s.color,
  portrait: s.portrait ? { ...s.portrait, src: `/${s.portrait.src}` } : null,
}));

export const sageOrder = () => [...sages].sort((a, b) => GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade));

// 歩いて行けるデモの像（柳町・材木の3体）
export const demoStatues: Entry[] = ebisuDemo.ebisu.map((st) => {
  const fid = fidOf(st.officialUrl);
  const cat = fid ? catalogByFid.get(fid) : undefined;
  const grades = characters.ebisu.grades as Record<string, string>;
  return {
    key: `ebisu:${st.id}`,
    name: st.name,
    grade: toGrade(grades[st.id]),
    sub: `${st.builtYear}年・${st.area.split('（')[0]}`,
    hint: 'その場所まで行くと集まる',
    photo: cat?.img,
    url: st.officialUrl,
    fid: fid ?? undefined,
    located: true,
    lat: st.lat,
    lng: st.lng,
  };
});

export const sageEntries: Entry[] = sages.map((s) => ({
  key: `sage:${s.id}`,
  name: s.name,
  grade: s.grade,
  sub: s.years,
  hint: `えびす像を${(sageOrder().indexOf(s) + 1) * SAGE_EVERY}体集めると仲間になる`,
  portrait: s.portrait,
}));

// 佐賀のえびす像（828体）。写真は公式サイトから直接読む
export const catalogEntries: Entry[] = catalogData.items.map((it) => ({
  key: `cat:${it.fid}`,
  name: it.name,
  grade: toGrade(it.grade),
  photo: it.img,
  url: it.url,
  address: it.address,
  fid: it.fid,
  located: Boolean(it.lat),
  lat: it.lat ?? undefined,
  lng: it.lng ?? undefined,
}));

// 地図に出すえびす像：デモの3体と、場所の分かる一覧の像（デモの3体と同じ像は一覧から除く）
const demoFids = new Set(demoStatues.map((e) => e.fid));
export const mapStatues: Entry[] = [
  ...demoStatues,
  ...catalogEntries.filter((e) => e.located && !demoFids.has(e.fid)),
];

// 地図の最初の中心（佐賀市柳町付近）
export const MAP_ORIGIN = { lat: ebisuDemo.observer.lat, lng: ebisuDemo.observer.lng };

// ガチャで出るのはえびす像だけ（七賢人は、えびす像を集めると仲間になる）
export const gachaPool: Entry[] = [...demoStatues, ...catalogEntries];

export const chapters: Chapter[] = chaptersData.chapters;

export type Player = {
  name: string;
  collected: number;
  points: number;
  quests: number;
  bestSec: number | null;
  laps: number;
  walkM: number;
  me?: boolean;
};
export const rankingPlayers: Player[] = rankingData.players;
