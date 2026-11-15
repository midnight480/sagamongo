// アプリを開いているあいだ流す BGM（自作）
// 音声ファイルは使わず、Web Audio でその場で鳴らす（著作権の心配がなく、通信もいらない）。
// 曲：「えびす囃子」。民謡の音階（D の陽音階：レ・ミ・ソ・ラ・シ）で、琴っぽい旋律・低音・太鼓・鉦の 8 小節を繰り返す。
//
// ブラウザは、人が画面に触れるまで音を出せない。最初に触れたとき（または BGM ボタンを押したとき）に鳴り始める。
// オン／オフはこの端末に覚える。画面を閉じている（裏に回した）あいだは止める。

const PREF_KEY = 'sagamongo-bgm-v1';

const BPM = 100;
const EIGHTH = 60 / BPM / 2; // 8分音符の長さ（秒）
const BAR = 8; // 1小節 = 8分音符 8つ
const LOOP = 8 * BAR; // 8小節で1周
const VOLUME = 0.14; // 全体の音量（ガチャの効果音より小さく）
const DUCK = 0.25; // ガチャの演出中は、この割合まで下げる

// 旋律：[小節の中の位置（8分）, MIDI ノート番号, 長さ（8分いくつ分）]
// D4=62 E4=64 G4=67 A4=69 B4=71 D5=74 E5=76 G5=79
const MELODY: [number, number, number][][] = [
  [[0, 74, 2], [2, 71, 1], [3, 69, 1], [4, 67, 2], [6, 64, 2]],
  [[0, 67, 1], [1, 69, 1], [2, 71, 2], [4, 69, 4]],
  [[0, 74, 2], [2, 76, 1], [3, 74, 1], [4, 71, 2], [6, 69, 2]],
  [[0, 67, 1], [1, 64, 1], [2, 62, 2], [4, 64, 4]],
  [[0, 67, 2], [2, 69, 2], [4, 71, 1], [5, 74, 1], [6, 76, 2]],
  [[0, 79, 2], [2, 76, 1], [3, 74, 1], [4, 76, 4]],
  [[0, 74, 1], [1, 71, 1], [2, 69, 2], [4, 71, 1], [5, 69, 1], [6, 67, 2]],
  [[0, 64, 2], [2, 67, 2], [4, 62, 4]],
];
// 低音：小節ごとの根音（1拍目に根音、3拍目に5度上）
const BASS = [50, 43, 50, 45, 43, 52, 45, 50];
// 太鼓：小節の中の位置（8分）と強さ
const TAIKO: [number, number][] = [[0, 1], [3, 0.45], [4, 0.8], [7, 0.35]];

const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

type State = {
  ctx: AudioContext | null;
  master: GainNode | null;
  out: GainNode | null; // 音量と下げる（ダック）用
  noise: AudioBuffer | null;
  timer: ReturnType<typeof setInterval> | null;
  step: number; // 次に鳴らす 8分の番号（0〜LOOP-1）
  nextAt: number; // 次の 8分を鳴らす時刻（AudioContext の時計）
  enabled: boolean;
  playing: boolean;
  ducked: boolean;
};

const s: State = {
  ctx: null, master: null, out: null, noise: null, timer: null,
  step: 0, nextAt: 0, enabled: readPref(), playing: false, ducked: false,
};

// ---------- 画面に知らせる ----------

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
export const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};
export const isEnabled = () => s.enabled;
export const isPlaying = () => s.playing;

function readPref() {
  if (typeof window === 'undefined') return true;
  try { return localStorage.getItem(PREF_KEY) !== 'off'; } catch { return true; }
}
function writePref(on: boolean) {
  try { localStorage.setItem(PREF_KEY, on ? 'on' : 'off'); } catch { /* 覚えられなくてもよい */ }
}

// ---------- 音の部品 ----------

function setup() {
  if (s.ctx) return true;
  let ctx: AudioContext;
  try { ctx = new AudioContext(); } catch { return false; }
  s.ctx = ctx;
  s.out = ctx.createGain();
  s.out.gain.value = VOLUME;
  s.out.connect(ctx.destination);
  // 少しだけ響き（やまびこ）を足す
  s.master = ctx.createGain();
  const delay = ctx.createDelay(1);
  delay.delayTime.value = EIGHTH * 1.5;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.25;
  const wet = ctx.createGain();
  wet.gain.value = 0.22;
  s.master.connect(s.out);
  s.master.connect(delay);
  delay.connect(feedback).connect(delay);
  delay.connect(wet).connect(s.out);
  // 太鼓のかすれと鈴に使う雑音
  const len = Math.floor(ctx.sampleRate * 0.5);
  s.noise = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = s.noise.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return true;
}

// 琴っぽい旋律（はじいてすぐ減る音。三角波に1オクターブ上を少し重ねる）
function koto(t: number, midi: number, len: number) {
  const ctx = s.ctx!;
  const f = freq(midi);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.35, len * EIGHTH * 1.2));
  g.connect(s.master!);
  for (const [mul, type, vol] of [[1, 'triangle', 1], [2, 'sine', 0.25]] as const) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f * mul, t);
    const og = ctx.createGain();
    og.gain.value = vol;
    o.connect(og).connect(g);
    o.start(t);
    o.stop(t + len * EIGHTH * 1.3 + 0.1);
  }
}

function bass(t: number, midi: number) {
  const ctx = s.ctx!;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq(midi), t);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.45, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + EIGHTH * 3);
  o.connect(g).connect(s.out!);
  o.start(t);
  o.stop(t + EIGHTH * 3 + 0.05);
}

// 太鼓：低い音が下がっていく「ドン」と、皮のかすれ
function taiko(t: number, vel: number) {
  const ctx = s.ctx!;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(48, t + 0.25);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.9 * vel, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  o.connect(g).connect(s.out!);
  o.start(t);
  o.stop(t + 0.45);
  const n = ctx.createBufferSource();
  n.buffer = s.noise;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 900;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.25 * vel, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  n.connect(f).connect(ng).connect(s.out!);
  n.start(t, Math.random() * 0.3, 0.1);
}

// 鈴（裏拍のシャン）
function suzu(t: number) {
  const ctx = s.ctx!;
  const n = ctx.createBufferSource();
  n.buffer = s.noise;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 7000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  n.connect(f).connect(g).connect(s.out!);
  n.start(t, Math.random() * 0.3, 0.08);
}

// 鉦（2小節ごとのチーン）
function kane(t: number) {
  const ctx = s.ctx!;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  g.connect(s.master!);
  for (const hz of [1568, 2350, 3920]) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = hz;
    o.connect(g);
    o.start(t);
    o.stop(t + 0.95);
  }
}

// ---------- 鳴らす順番（先読みして予約する） ----------

function playStep(step: number, t: number) {
  const bar = Math.floor(step / BAR);
  const pos = step % BAR;
  for (const [at, midi, len] of MELODY[bar]) if (at === pos) koto(t, midi, len);
  if (pos === 0) bass(t, BASS[bar]);
  if (pos === 4) bass(t, BASS[bar] + 7);
  for (const [at, vel] of TAIKO) if (at === pos) taiko(t, vel);
  if (pos % 2 === 1) suzu(t);
  if (pos === 0 && bar % 2 === 0) kane(t);
}

function schedule() {
  const ctx = s.ctx!;
  while (s.nextAt < ctx.currentTime + 0.15) {
    playStep(s.step, s.nextAt);
    s.step = (s.step + 1) % LOOP;
    s.nextAt += EIGHTH;
  }
}

// ---------- 外から呼ぶもの ----------

// 鳴らす（人が画面に触れたあとに呼ぶ）。オフにしてあれば何もしない
export function start() {
  if (!s.enabled || typeof window === 'undefined') return;
  if (!setup()) return;
  const ctx = s.ctx!;
  if (ctx.state === 'suspended') void ctx.resume();
  if (!s.timer) {
    s.step = 0;
    s.nextAt = ctx.currentTime + 0.1;
    s.timer = setInterval(schedule, 25);
  }
  s.playing = true;
  emit();
}

export function stop() {
  if (s.timer) clearInterval(s.timer);
  s.timer = null;
  if (s.ctx?.state === 'running') void s.ctx.suspend();
  s.playing = false;
  emit();
}

export function setEnabled(on: boolean) {
  s.enabled = on;
  writePref(on);
  if (on) start(); else stop();
  emit();
}

// ガチャの演出中など、BGM を小さくする
export function setDuck(on: boolean) {
  s.ducked = on;
  if (!s.ctx || !s.out) return;
  const t = s.ctx.currentTime;
  s.out.gain.cancelScheduledValues(t);
  s.out.gain.setTargetAtTime(VOLUME * (on ? DUCK : 1), t, 0.2);
}

// 裏に回したら止め、戻ってきたら続きから鳴らす
export function onVisibility(hidden: boolean) {
  if (!s.ctx || !s.playing) return;
  if (hidden) void s.ctx.suspend();
  else if (s.enabled) {
    void s.ctx.resume();
    s.nextAt = Math.max(s.nextAt, s.ctx.currentTime + 0.05);
  }
}
