// 集めたもの・ポイント・クエストの記録（デモ版）
// 記録はこの端末のブラウザ（localStorage）にだけ保存する。書き換えられるので、本番では Vercel Functions + DB に置く。
// localStorage が使えない環境（プライベートモードなど）でも動くよう、読み書きの失敗は無視してメモリに持つ。
// 画面（React）からは subscribe / version で変化を受け取る（useProgress フック）。
// 3D 側（えびすさんが歩く）も、着いた・出会ったときはここの関数を呼ぶ。
// 移植元：smart-hackathon-20261115/prototype/sanpo/progress.js

import { pointsMultiplier, currentEvent } from './events';

const KEY = 'sagamongo-progress-v1';

// ポイントの配り方
export const POINTS = {
  ebisu: 10, // えびす像に着いた
  sage: 30, // 七賢人に出会った
  sageRare: 50, // すごくレアな七賢人
  guide: 20, // 案内人から話を聞いた
};

// 累積ポイントの段位（使っても累積は減らない）
export const RANKS = [
  { min: 0, name: 'えびす見習い' },
  { min: 100, name: 'えびす通' },
  { min: 300, name: 'えびす名人' },
];

// パーティーに入れる人数
export const PARTY_MAX = 3;

// クエストの中身は、案内人のクエストを移すときに決める（試作の quests.js）
export type QuestDef = {
  id: string;
  guide?: string;
  type?: string;
  title: string;
  points: number;
  limitMin?: number;
  [k: string]: unknown;
};
export type QuestRecord = {
  status: 'active' | 'done' | 'failed';
  at: string;
  doneAt?: string;
  doneCount?: number;
  def?: QuestDef;
  step?: number;
  startWalk?: number;
  deadline?: number | null;
};
export type LapClear = { lap: number; ms: number; walkM: number; points: number; first: boolean; at: string };
export type Lap = { lap: number; got: Record<string, number>; start: number | null; walkM: number; clears: LapClear[] };
export type Chapter = { id: string; title: string; statues: string[]; clearPoints?: number; lapPoints?: number; note?: string };
export type LogEntry = { at: string; text: string; points: number };
export type Prefs = { likes: string[]; pace: string };

export type ProgressData = {
  collected: Record<string, string>; // { 'ebisu:mojitai': 日時, 'sage:naomasa': 日時, 'cat:754': 日時 ... }
  visited: Record<string, string>; // 現地に行った像
  awake: Record<string, string>; // 写真を撮って動き出させた像
  guides: Record<string, string>; // { yanagimachi: 日時 }
  quests: Record<string, QuestRecord>;
  walkM: number; // これまでに歩いた距離（m）
  // ガチャを回した回数と、払った金額（デモ）。pointDraws・spentPoints は、貯まったポイントで回した分
  gacha: { draws: number; spentYen: number; pointDraws?: number; spentPoints?: number };
  laps: Record<string, Lap>; // 弾ごとの周回
  party: string[]; // パーティーにいる七賢人の ID（新しい順、最大 PARTY_MAX 人）
  balance: number; // 使えるポイント
  total: number; // 累積ポイント
  selfies: number;
  prefs: Prefs | null;
  log: LogEntry[];
};

const empty = (): ProgressData => ({
  collected: {},
  visited: {},
  awake: {},
  guides: {},
  quests: {},
  walkM: 0,
  gacha: { draws: 0, spentYen: 0 },
  laps: {},
  party: [],
  balance: 0,
  total: 0,
  selfies: 0,
  prefs: null,
  log: [],
});

// サーバーで描くときは空の記録。ブラウザでは最初に触ったときに localStorage から読む
let data: ProgressData | null = null;
const d = (): ProgressData => {
  if (!data) data = load();
  return data;
};

function load(): ProgressData {
  if (typeof window === 'undefined') return empty();
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  } catch {
    return empty();
  }
}

// ---------- 変化の通知（React の useSyncExternalStore 用） ----------

let version = 0;
const listeners = new Set<() => void>();
export const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};
export const getVersion = () => version;

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(d())); } catch { /* 保存できなくても続ける */ }
  version++;
  listeners.forEach((fn) => fn());
}

// 歩いたり話したりして貯まるポイント。イベント期間中は倍になる（boost: false なら倍にしない）。足した分を返す
function addPoints(points: number, text: string, { boost = true } = {}) {
  const m = boost ? pointsMultiplier() : 1;
  const got = points * m;
  d().balance += got;
  d().total += got;
  log(m > 1 ? `${text}（${currentEvent()?.name} ${m}倍）` : text, got);
  return got;
}

function log(text: string, points: number) {
  d().log.unshift({ at: new Date().toISOString(), text, points });
  d().log = d().log.slice(0, 50);
}

// 使えるポイントを減らす（累積は減らさない）。残高より多くは引かない。実際に引いた分を返す
export function takePoints(points: number, text: string) {
  const taken = Math.min(points, d().balance);
  d().balance -= taken;
  log(text, -taken);
  save();
  return taken;
}

// 七賢人をパーティーに入れる（すでにいれば先頭へ）。あふれた人は抜ける
export function joinParty(id: string): string | null {
  const before = [...d().party];
  d().party = [id, ...d().party.filter((p) => p !== id)].slice(0, PARTY_MAX);
  save();
  return before.find((p) => !d().party.includes(p)) ?? null; // 抜けた人
}

// 知恵くらべに勝った（クエスト達成として数える）
export function winChallenge(id: string, title: string, points: number) {
  if (d().quests[id]?.status === 'done') return false;
  const now = new Date().toISOString();
  d().quests[id] = { status: 'done', at: now, doneAt: now };
  addPoints(points, `${title}に勝った`);
  save();
  return true;
}

export const challengeWon = (id: string) => d().quests[id]?.status === 'done';

// ---------- 弾（エリア）と周回 ----------

const lapOf = (chId: string): Lap => {
  d().laps[chId] ??= { lap: 1, got: {}, start: null, walkM: 0, clears: [] };
  return d().laps[chId];
};

// 日本時間の日付（「1日1回まで」の判定に使う）
const jstDay = (ms: number) => new Date(ms + 9 * 3600 * 1000).toISOString().slice(0, 10);

// 歩いた距離を足す。計測中の周回にも足す
export function addWalk(m: number) {
  d().walkM += m;
  for (const l of Object.values(d().laps)) if (l.start) l.walkM = (l.walkM ?? 0) + m;
  save();
}

export const lapInfo = (chId: string) => lapOf(chId);
export const clearCount = (chId: string) => lapOf(chId).clears.length;
export const bestMs = (chId: string) => {
  const c = lapOf(chId).clears;
  return c.length ? Math.min(...c.map((x) => x.ms)) : null;
};
// 開いている弾：最初の弾と、前の弾を一度コンプリートした弾
export function unlocked(chapters: Chapter[], i: number) {
  return i === 0 || clearCount(chapters[i - 1].id) > 0;
}

export type LapResult =
  | null
  | { cleared: false }
  | { cleared: true; lap: number; ms: number; walkM: number; points: number; first: boolean; capped: boolean };

// この周回で像に着いた。最初の像に着いた時刻から計り始め、全部そろったらコンプリート。
export function lapArrive(chapter: Chapter, statueId: string): LapResult {
  const l = lapOf(chapter.id);
  if (l.got[statueId]) return null;
  const now = Date.now();
  l.got[statueId] = now;
  l.start ??= now;
  if (!chapter.statues.every((id) => l.got[id])) { save(); return { cleared: false }; }
  const ms = now - l.start;
  const walkM = Math.round(l.walkM ?? 0);
  const first = l.clears.length === 0;
  // 周回のポイントは 1日1回まで（同じ日に何周しても、2回目からはタイムと距離だけ残る）
  const today = jstDay(now);
  const lapToday = l.clears.some((c) => jstDay(Date.parse(c.at)) === today && c.points > 0 && !c.first);
  const points = first ? chapter.clearPoints ?? 0 : (lapToday ? 0 : chapter.lapPoints ?? 0);
  l.clears.push({ lap: l.lap, ms, walkM, points, first, at: new Date(now).toISOString() });
  if (points) addPoints(points, `${chapter.title}を${first ? 'コンプリート' : `${l.lap}周目でコンプリート`}`);
  const result = { cleared: true as const, lap: l.lap, ms, walkM, points, first, capped: !first && lapToday };
  // 次の周回へ
  l.lap += 1;
  l.got = {};
  l.start = null;
  l.walkM = 0;
  save();
  return result;
}

// ---------- ガチャ（デモ決済） ----------

export const gachaInfo = () => { d().gacha ??= { draws: 0, spentYen: 0 }; return d().gacha; };

// 払った金額と同じだけ、お店で使えるポイントを足す。
// 累積（段位・ランキング）には入れない。お金で順位が上がらないようにする
export function buyGacha(yen: number) {
  const g = gachaInfo();
  g.draws += 1;
  g.spentYen += yen;
  d().balance += yen;
  log(`ガチャ ${g.draws}回目（¥${yen} デモ決済。累積には入らない）`, yen);
  save();
}

// 貯まった「使えるポイント」で1回回す。足りなければ何もせず false。
// 使えるポイントだけ減らし、累積（段位・ランキング）は減らさない
export function spendPointsForGacha(points: number) {
  if (d().balance < points) return false;
  const g = gachaInfo();
  g.pointDraws = (g.pointDraws ?? 0) + 1;
  g.spentPoints = (g.spentPoints ?? 0) + points;
  d().balance -= points;
  log(`ポイントでガチャ ${g.pointDraws}回目`, -points);
  save();
  return true;
}

// 記念撮影をした。はじめてなら true
export function addSelfie() {
  d().selfies = (d().selfies ?? 0) + 1;
  save();
  return d().selfies === 1;
}

export function bonus(points: number, text: string) {
  addPoints(points, text);
  save();
}

export const get = () => d();
export const has = (key: string) => Boolean(d().collected[key]);
export const collectedCount = () => Object.keys(d().collected).length;
// クエストを達成した回数（同じクエストをやり直して達成した分も数える）
export const questsDone = () => Object.values(d().quests)
  .reduce((a, q) => a + (q.doneCount ?? (q.status === 'done' ? 1 : 0)), 0);

export function rankOf(total: number) {
  let rank = RANKS[0];
  for (const r of RANKS) if (total >= r.min) rank = r;
  const next = RANKS.find((r) => r.min > total);
  return { ...rank, next };
}

// 図鑑に載せる。初めてならポイントを足して true を返す
export function collect(key: string, label: string, points: number) {
  if (d().collected[key]) return false;
  d().collected[key] = new Date().toISOString();
  addPoints(points, `${label}を図鑑に登録`);
  save();
  collectListeners.forEach((fn) => fn(key));
  return true;
}

// 現地に行った（えびす像の位置まで行った）。はじめてなら true
export function visit(key: string, label: string, points: number) {
  if (d().visited[key]) return false;
  d().visited[key] = new Date().toISOString();
  addPoints(points, `${label}に会いに行った`);
  save();
  return true;
}
export const visited = (key: string) => Boolean(d().visited[key]);

// 写真を撮って動き出させた。はじめてなら true
export function awaken(key: string, label: string, points: number) {
  if (d().awake[key]) return false;
  d().awake[key] = new Date().toISOString();
  addPoints(points, `${label}が動き出した`);
  save();
  return true;
}
export const isAwake = (key: string) => Boolean(d().awake[key]);

// 図鑑に何か増えたときに呼ぶ（七賢人が仲間になる条件を確かめるため）
const collectListeners: ((key: string) => void)[] = [];
export const onCollect = (fn: (key: string) => void) => {
  collectListeners.push(fn);
  return () => { collectListeners.splice(collectListeners.indexOf(fn), 1); };
};

// 集めたえびす像の数（歩いて着いた像と、ガチャで出た像）
export const ebisuCount = () => Object.keys(d().collected).filter((k) => k.startsWith('ebisu:') || k.startsWith('cat:')).length;

// 案内人から話を聞く。make(guide) で、好みに合わせたクエストを1つ作って受ける。
// この案内人のクエストを受けている途中なら、新しくは作らず、それを返す。
export function meetGuide(guide: { id: string; name: string }, make: (g: { id: string; name: string }) => QuestDef) {
  const first = !d().guides[guide.id];
  if (first) {
    d().guides[guide.id] = new Date().toISOString();
    addPoints(POINTS.guide, `${guide.name}から話を聞いた`);
  }
  let rec = Object.values(d().quests).find((q) => q.status === 'active' && q.def?.guide === guide.id);
  if (!rec) {
    const def = make(guide);
    rec = {
      status: 'active',
      at: new Date().toISOString(),
      def,
      step: 0, // tour：いくつ目まで回ったか
      startWalk: d().walkM, // walk：受けたときの歩いた距離
      deadline: def.limitMin ? Date.now() + def.limitMin * 60 * 1000 : null, // timed
    };
    d().quests[def.id] = rec;
  }
  save();
  return { first, quest: rec.def! };
}

// この案内人が前に出した種類（続けて同じ種類にしないため）
export function lastQuestType(guideId: string) {
  const list = Object.values(d().quests).filter((q) => q.def?.guide === guideId);
  return list.sort((a, b) => (a.at < b.at ? 1 : -1))[0]?.def?.type ?? null;
}

// 参加する人の好み { likes: ['history', ...], pace: 'normal' }。まだなら null
export const prefs = () => d().prefs ?? null;
export function setPrefs(p: Prefs) {
  d().prefs = p;
  save();
}

export const questState = (id: string) => d().quests[id] ?? null;

// tour を1つ進める
export function advanceQuest(id: string) {
  const q = d().quests[id];
  if (!q) return;
  q.step = (q.step ?? 0) + 1;
  save();
}

// timed の時間切れなど。ポイントは減らさない
export function failQuest(id: string) {
  const q = d().quests[id];
  if (!q || q.status !== 'active') return false;
  q.status = 'failed';
  save();
  return true;
}

// 受けている途中のクエスト
export function activeQuests() {
  return Object.values(d().quests).filter((q) => q.status === 'active' && q.def);
}

export function completeQuest(quest: QuestDef) {
  const q = d().quests[quest.id];
  if (!q || q.status === 'done') return false;
  q.status = 'done';
  q.doneAt = new Date().toISOString();
  q.doneCount = (q.doneCount ?? 0) + 1;
  addPoints(quest.points, `クエスト「${quest.title}」を達成`);
  save();
  return true;
}

// デモの見せ直し用：記録を消す
export function reset() {
  data = empty();
  save();
}
