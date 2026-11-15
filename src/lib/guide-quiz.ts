// 案内人と出会ったときに出す「佐賀の歴史クイズ」（data/history-quiz.json）
// ・meetGuide() で、まだ正解していない問題から1つ選んで画面に出す（全部正解したら、どれかをもう一度）
// ・初めて正解した問題だけポイント（使えるポイントと累積）。正解した数はクエスト達成として数える
// ・3D 側は、案内人に出会ったところで meetGuide() を呼ぶ（特定の問題を出すなら meetGuide('okuma') のように id を渡す）

import quiz from '@/data/history-quiz.json';
import * as progress from './progress';

export type Question = (typeof quiz.questions)[number];

export const QUESTIONS: Question[] = quiz.questions;
export const QUIZ_POINTS: number = quiz.points;
export const GUIDE_NAME: string = quiz.guide;

const recordId = (q: Question) => `history-quiz:${q.id}`;
export const isSolved = (q: Question) => progress.challengeWon(recordId(q));
export const solvedCount = () => QUESTIONS.filter(isSolved).length;

// 正解なら true。初めての正解ならポイントを足す
export function answer(q: Question, choice: number) {
  const correct = choice === q.answer;
  if (correct) progress.winChallenge(recordId(q), `歴史クイズ「${q.title}」`, QUIZ_POINTS);
  return correct;
}

// ---------- いま出しているクイズ（画面に知らせる） ----------

let current: Question | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
export const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};
export const getCurrent = () => current;

export function meetGuide(id?: string) {
  const byId = id ? QUESTIONS.find((q) => q.id === id) : undefined;
  const open = QUESTIONS.filter((q) => !isSolved(q));
  const pool = open.length ? open : QUESTIONS;
  current = byId ?? pool[Math.floor(Math.random() * pool.length)];
  emit();
}

export function close() {
  current = null;
  emit();
}
