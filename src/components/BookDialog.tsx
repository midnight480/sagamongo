'use client';

// 図鑑・ランキング・ポイントの画面
// 移植元：試作 book.js の renderZukan / renderCatalog / renderRanking / renderPoints と、walk.html の #book-dialog
// 案内人のデモ操作・好みの変更は、案内人とクエストを移すときに足す。
// 「見に行く」（地図で道案内）は 3D / 地図側の担当なので、onGo で外に渡すだけにしている。

/* eslint-disable @next/next/no-img-element -- 公式サイトの写真を外から直接表示するため */

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import * as progress from '@/lib/progress';
import { useProgress, toast, formatMs, formatKm } from '@/lib/ui-store';
import { CREDIT, catalogEntries, chapters, demoStatues, rankingPlayers, sageEntries, type Entry, type Player } from '@/lib/catalog';
import { GradeBadge, Thumb } from './Thumb';

type Tab = 'zukan' | 'ranking' | 'points';
const TABS: { id: Tab; label: string }[] = [
  { id: 'zukan', label: '図鑑' },
  { id: 'ranking', label: 'ランキング' },
  { id: 'points', label: 'ポイント' },
];

export function BookDialog({ open, onClose, onGo }: { open: boolean; onClose: () => void; onGo?: (fid: number) => void }) {
  useProgress();
  const dialog = useRef<HTMLDialogElement>(null);
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ zukan: null, ranking: null, points: null });
  const [tab, setTab] = useState<Tab>('zukan');

  useEffect(() => {
    const el = dialog.current!;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  const onTabKey = (e: KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length].id;
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <dialog ref={dialog} className="modal walk-dialog walk-book" aria-labelledby="book-title" onClose={onClose}>
      <h2 className="modal-title" id="book-title">図鑑とランキング</h2>
      <p className="walk-demo-note">デモ版：記録はこの端末のブラウザにだけ保存しています。ランキングのほかの参加者は架空です。</p>

      <div role="tablist" aria-label="見るもの" className="tabs">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => { tabRefs.current[t.id] = el; }}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => onTabKey(e, i)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="panel-zukan" aria-labelledby="tab-zukan" hidden={tab !== 'zukan'}>
        <Zukan />
        <Catalog onGo={onGo ? (fid) => { onClose(); onGo(fid); } : undefined} />
      </div>
      <div role="tabpanel" id="panel-ranking" aria-labelledby="tab-ranking" hidden={tab !== 'ranking'}>
        <Ranking />
      </div>
      <div role="tabpanel" id="panel-points" aria-labelledby="tab-points" hidden={tab !== 'points'}>
        <Points />
      </div>

      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>閉じる</button>
      </div>
    </dialog>
  );
}

// ---------- 図鑑（弾ごと。最後に七賢人） ----------

function ZukanItem({ e }: { e: Entry }) {
  const has = progress.has(e.key);
  return (
    <li>
      <Thumb entry={e} has={has} />
      <span className={has ? undefined : 'is-missing'}>{has ? e.name : '？？？'}</span>
      <GradeBadge grade={e.grade} />
      <span className="is-missing">{has ? e.sub : e.hint}</span>
    </li>
  );
}

// 計測中の周回の経過時間（描いた時点のもので足りる）
const elapsed = (start: number) => Date.now() - start;

function Section({ title, sub }: { title: string; sub?: string }) {
  return (
    <li className="zukan-section">
      <strong>{title}</strong>
      {sub && <span>{sub}</span>}
    </li>
  );
}

function Zukan() {
  let open = 0;
  let got = 0;
  const items: React.ReactNode[] = [];
  chapters.forEach((ch, i) => {
    if (!progress.unlocked(chapters, i)) {
      items.push(<Section key={ch.id} title={`${ch.title}（まだ開いていない）`} sub={`${chapters[i - 1].title}をコンプリートすると開きます`} />);
      return;
    }
    if (!ch.statues.length) { items.push(<Section key={ch.id} title={ch.title} sub={ch.note ?? '準備中'} />); return; }
    const lap = progress.lapInfo(ch.id);
    const best = progress.bestMs(ch.id);
    const done = ch.statues.filter((id) => lap.got[id]).length;
    items.push(
      <Section
        key={ch.id}
        title={ch.title}
        sub={`${lap.lap}周目：${done}/${ch.statues.length}`
          + (lap.start ? `（${formatMs(elapsed(lap.start))} 経過・${formatKm(lap.walkM ?? 0)}）` : '（最初の像に着くと計測開始）')
          + `／コンプリート ${progress.clearCount(ch.id)}回`
          + (best != null ? `／最速 ${formatMs(best)}` : '')}
      />,
    );
    for (const id of ch.statues) {
      const e = demoStatues.find((x) => x.key === `ebisu:${id}`);
      if (!e) continue;
      open++;
      if (progress.has(e.key)) got++;
      items.push(<ZukanItem key={e.key} e={e} />);
    }
  });
  items.push(<Section key="sages" title="佐賀七賢人（えびす像を10体集めるごとに一人仲間になる）" />);
  for (const e of sageEntries) {
    open++;
    if (progress.has(e.key)) got++;
    items.push(<ZukanItem key={e.key} e={e} />);
  }
  return (
    <>
      <p>開いているエリアの {open} のうち {got} を集めました。</p>
      <ul className="zukan">{items}</ul>
    </>
  );
}

// ---------- 佐賀のえびす像（828体） ----------

const CAT_PAGE = 60; // 一度に並べる数（「もっと見る」で増やす）
const FILTERS = [
  { id: 'all', label: 'すべて' },
  { id: 'mine', label: '持っている' },
  { id: 'SSR', label: 'SSR' },
  { id: 'SR', label: 'SR' },
  { id: 'R', label: 'R' },
  { id: 'N', label: 'N' },
];

function Catalog({ onGo }: { onGo?: (fid: number) => void }) {
  const [filter, setFilter] = useState('all');
  const [shown, setShown] = useState(CAT_PAGE);
  const all = catalogEntries;
  const got = all.filter((e) => progress.has(e.key)).length;
  const met = all.filter((e) => progress.visited(e.key)).length;
  const list = all.filter((e) => (filter === 'mine' ? progress.has(e.key) : filter === 'all' ? true : e.grade === filter));

  return (
    <section className="catalog" aria-labelledby="catalog-title">
      <h3 className="card-title" id="catalog-title">佐賀のえびす像</h3>
      <p className="walk-demo-note">
        {all.length}体のうち {got}体を集めました（現地で会えたのは {met}体）。
        {onGo ? '気になった像は「見に行く」で道案内。' : ''}その場所まで行くと集まり、ガチャでも出ます
      </p>
      <div className="walk-segment" role="group" aria-label="絞り込み">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className="btn btn-secondary btn-sm"
            aria-pressed={filter === f.id}
            onClick={() => { setFilter(f.id); setShown(CAT_PAGE); }}
          >
            {f.label}
          </button>
        ))}
      </div>
      <ul className="catalog-grid">
        {list.slice(0, shown).map((e) => <CatalogItem key={e.key} e={e} onGo={onGo} />)}
      </ul>
      {list.length > shown && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShown(shown + CAT_PAGE)}>
          もっと見る（あと {list.length - shown}体）
        </button>
      )}
      <p className="walk-demo-note">写真：{CREDIT}（公式サイト「佐賀恵比須」から表示しています）</p>
    </section>
  );
}

function CatalogItem({ e, onGo }: { e: Entry; onGo?: (fid: number) => void }) {
  const has = progress.has(e.key);
  const [broken, setBroken] = useState(false);
  return (
    <li>
      {broken || !e.photo
        ? <span className="catalog-noimg">写真なし</span>
        : (
          // 集めていない像も、名前・写真・場所は見せる（気になったら見に行けるように）。写真だけ色を抜く
          <img
            src={e.photo}
            alt={e.name}
            width={96}
            height={96}
            loading="lazy"
            className={has ? undefined : 'is-uncollected'}
            onError={() => setBroken(true)}
          />
        )}
      <GradeBadge grade={e.grade} />
      <a href={e.url} target="_blank" rel="noopener">{e.name}</a>
      {e.address && <span className="is-missing">{e.address}</span>}
      {e.located && onGo && e.fid != null && (
        <button type="button" className="btn btn-secondary btn-sm catalog-go" onClick={() => onGo(e.fid!)}>見に行く</button>
      )}
      {progress.visited(e.key) && <span className="catalog-visited">現地で会えた</span>}
    </li>
  );
}

// ---------- ランキング ----------

type Metric = 'collected' | 'points' | 'quests' | 'bestSec' | 'laps' | 'walkM';
const METRICS: Record<Metric, { name: string; asc?: boolean; label: (v: number | null) => string }> = {
  collected: { name: '集めた数', label: (v) => `${v}体` },
  points: { name: '累積ポイント', label: (v) => `${v}pt` },
  quests: { name: 'クエスト達成', label: (v) => `${v}件` },
  bestSec: { name: '最速コンプリート', asc: true, label: (v) => (v == null ? '記録なし' : formatMs(v * 1000)) },
  laps: { name: '周回数', label: (v) => `${v}周` },
  walkM: { name: '歩いた距離', label: (v) => formatKm(v ?? 0) },
};

function Ranking() {
  const [metric, setMetric] = useState<Metric>('collected');
  const d = progress.get();
  const first = chapters[0];
  const best = progress.bestMs(first.id);
  const me: Player = {
    name: 'あなた', me: true,
    collected: progress.collectedCount(), points: d.total, quests: progress.questsDone(),
    bestSec: best == null ? null : Math.round(best / 1000), laps: progress.clearCount(first.id),
    walkM: Math.round(d.walkM ?? 0),
  };
  const m = METRICS[metric];
  const rows = [...rankingPlayers, me].sort((a, b) => {
    const va = a[metric];
    const vb = b[metric];
    if (va == null || vb == null) return Number(va == null) - Number(vb == null) || (a.me ? -1 : 0);
    return (m.asc ? va - vb : vb - va) || (a.me ? -1 : 0);
  });
  const note = metric === 'bestSec' || metric === 'laps'
    ? `${first.title}。タイムは、その周回で最初の像に着いてから全部そろうまで。コンプリートすると次の周回が始まります`
    : metric === 'walkM' ? '歩いた距離の合計（GPS が大きく飛んだ分は数えない）' : '';

  return (
    <>
      <div className="walk-segment" role="group" aria-label="並べ替え">
        {(Object.keys(METRICS) as Metric[]).map((k) => (
          <button key={k} type="button" className="btn btn-sm" aria-pressed={metric === k} onClick={() => setMetric(k)}>
            {METRICS[k].name}
          </button>
        ))}
      </div>
      {note && <p className="walk-demo-note">{note}</p>}
      <ol className="ranking">
        {rows.map((r) => (
          <li key={r.name} className={r.me ? 'is-me' : undefined}>
            {r.name}
            <span className="ranking-value">{m.label(r[metric])}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

// ---------- ポイント ----------

function Points() {
  const d = progress.get();
  const rank = progress.rankOf(d.total);
  return (
    <>
      <p>
        使えるポイント {d.balance}pt／累積 {d.total}pt。段位は「{rank.name}」
        {rank.next ? `（あと ${rank.next.min - d.total}pt で「${rank.next.name}」）` : '（最高の段位です）'}
      </p>
      <ul className="points-log">
        {d.log.length
          ? d.log.slice(0, 10).map((l) => (
            <li key={l.at + l.text}>{l.text}：{l.points >= 0 ? '+' : '−'}{Math.abs(l.points)}pt</li>
          ))
          : <li>まだポイントはありません</li>}
      </ul>
      <h3 className="card-title">デモ用の操作</h3>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => { progress.reset(); toast('記録を消しました'); }}
      >
        記録を消す
      </button>
    </>
  );
}
