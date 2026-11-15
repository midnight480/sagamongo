'use client';

// 案内人と出会ったときの画面：案内人の語り → クイズ（3択） → 正解・不正解
// 不正解でもポイントは減らない。正解するまで選び直せる。
// 移植元の見た目：試作 walk.html の #guide-dialog・#quiz-dialog（walk-talk・walk-quiz-choices）

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import * as guideQuiz from '@/lib/guide-quiz';
import { pointsMultiplier } from '@/lib/events';
import { toast } from '@/lib/ui-store';

const LETTERS = ['A', 'B', 'C', 'D'];

export function GuideQuizDialog() {
  const q = useSyncExternalStore(guideQuiz.subscribe, guideQuiz.getCurrent, () => null);
  const dialog = useRef<HTMLDialogElement>(null);
  // 選んだ答え（間違えたものは消していき、正解したら終わり）
  const [wrong, setWrong] = useState<number[]>([]);
  const [solved, setSolved] = useState(false);
  const [firstTime, setFirstTime] = useState(false);
  const [shownId, setShownId] = useState<string | null>(null);

  // 新しい問題が出たら、答えの状態を戻す
  if (q && q.id !== shownId) {
    setShownId(q.id);
    setWrong([]);
    setSolved(false);
  }

  useEffect(() => {
    const el = dialog.current!;
    if (q && !el.open) el.showModal();
    else if (!q && el.open) el.close();
  }, [q]);

  const choose = (i: number) => {
    if (!q || solved || wrong.includes(i)) return;
    const already = guideQuiz.isSolved(q);
    if (guideQuiz.answer(q, i)) {
      setSolved(true);
      setFirstTime(!already);
      if (!already) toast(`正解！ +${guideQuiz.QUIZ_POINTS * pointsMultiplier()}pt`);
    } else {
      setWrong([...wrong, i]);
    }
  };

  return (
    <dialog ref={dialog} className="modal walk-dialog" aria-labelledby="guide-quiz-title" onClose={guideQuiz.close}>
      {q && (
        <>
          <p className="walk-dialog-kicker">{guideQuiz.GUIDE_NAME}に出会いました</p>
          <h2 className="modal-title" id="guide-quiz-title">{q.title}</h2>
          <p className="walk-talk">「{q.talk}」</p>

          <div className="walk-quest-card">
            <p className="walk-dialog-kicker">佐賀の歴史クイズ</p>
            <p className="walk-quiz-q" id="guide-quiz-q">{q.q}</p>
            <div className="walk-quiz-choices" role="group" aria-labelledby="guide-quiz-q">
              {q.choices.map((c, i) => {
                const isWrong = wrong.includes(i);
                const isRight = solved && i === q.answer;
                return (
                  <button
                    key={c}
                    type="button"
                    className={`btn btn-secondary${isWrong ? ' is-wrong' : ''}${isRight ? ' is-correct' : ''}`}
                    disabled={isWrong || (solved && !isRight)}
                    aria-pressed={isRight}
                    onClick={() => choose(i)}
                  >
                    {LETTERS[i]}. {c}
                  </button>
                );
              })}
            </div>
            <p role="status">
              {solved
                ? (firstTime
                  ? `正解！ +${guideQuiz.QUIZ_POINTS * pointsMultiplier()}pt`
                  : '正解！（この問題のポイントは、もうもらっています）')
                : wrong.length ? 'ちがうみたい。もう一度選んでみて' : ''}
            </p>
          </div>

          <p className="walk-demo-note">
            歴史クイズ {guideQuiz.solvedCount()} / {guideQuiz.QUESTIONS.length} 問 正解
          </p>
          <div className="modal-actions">
            <button type="button" className={`btn ${solved ? 'btn-primary' : 'btn-secondary'}`} onClick={guideQuiz.close}>
              {solved ? 'ありがとう' : 'あとで'}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
