# AGENTS.md

このリポジトリで作業する AI エージェント（Claude Code / Kiro / Cursor / Codex など）向けの共通ルールです。
**エージェント設定の正本はこのファイルです。** `CLAUDE.md` などツールごとの設定ファイルはここを読み込むだけにしてあり、ルールを変えるときはこのファイルを直します。

## プロジェクト概要

- 製品名は「さがもん！Go！」。SAGA スマートハッカソン（2026-11-15）で作る。AR で歩く画面は「えびすさんが歩く」と呼ぶ
- **Vercel にデプロイする本番実装のリポジトリ**。企画と試作は別リポジトリにある（下の「関連リポジトリ」）

> **佐賀の町を歩くと、えびすさんと佐賀の七賢人が道を歩いている。像の前まで行って写真を撮ると、その像も動き出す。**

## 基本ポリシー

**仕様の正本は [planning/ebisu-walk.md](https://github.com/midnight480/smart-hackathon-20261115/blob/main/planning/ebisu-walk.md)（機能のまとめ）。** 機能を作る・変えるときは、まずこれを読み、書かれている体験・数値（距離、ポイント、レア度の確率など）に合わせる。食い違いや未決の点が出たら、勝手に決めずにユーザーに確認する。

体験の流れ（ebisu-walk.md の要約）:

1. はじめに好み（好きなこと・歩く量）を聞く
2. スマホをかざすと、えびすさんが本物の道に沿って歩いている（AR。カメラ映像に板ポリゴンを重ねる）
3. 町の案内人の QR を読むと、話を聞けて、好みに合わせたクエストがもらえる
4. えびす像のそば（30m 以内）まで行くと図鑑に登録され、ポイントがもらえる。写真を撮ると、その像が動き出す
5. えびす像を 10 体集めるごとに、佐賀の七賢人が一人仲間になり、後ろに付いてくる
6. 七賢人と記念撮影。ポイントはお店で使う想定
7. 図鑑がそろわない人はガチャ（デモ決済）でも集められる

守ること:

- **ユーザーの写真は端末の中だけに置き、サーバーに送らない。** 保存・共有は本人が押したときだけ
- **えびす像の写真はリポジトリに保存しない。** 恵比須DEまちづくりネットワークの公式サイトから表示する。一般公開の前に使い方を相談する
- BGM・効果音は自作（Web Audio で鳴らす）か、権利を確かめたフリー素材だけを使う。使うなら出典とライセンスを README に書く
- 七賢人の肖像は国立国会図書館「近代日本人の肖像」のものだけを使う。権利を確かめていない画像は置かない
- 決済はデモ（実際の支払いは起きない）。ほかの参加者・ランキングの相手・案内人は架空でよい。本番の決済を入れるときは Stripe などをサーバー側（Vercel Functions）でつなぐ
- 会場で歩かずに見せられるよう、デモ用の操作（地図を押してそこに立ったことにする、`?gacha=SSR` などの URL パラメータ）を残す
- 試作では記録はブラウザの中（localStorage）。ランキングなどを本物にするときは、Vercel Functions + Marketplace の DB に置く（試作メモの「Worker + D1」は Vercel 版ではこれに読み替える）

## 担当範囲

| 範囲 | 担当 | 中身 |
| --- | --- | --- |
| **フレーム側** | このリポジトリで作る | アプリの枠（画面の構成・切り替え・メニュー）、ポイント・図鑑などの状態管理、**ガチャガチャ**（デモ決済、レア度の抽選、カプセルの演出） |
| 3D 部分 | 別の人 | AR で歩く表示（カメラ映像への重ね合わせ、板ポリゴンのキャラクター、道に沿った移動） |

- 3D 部分の実装には手を出さない。フレームからは、差し込む場所（コンポーネントの置き場所や受け渡すデータ）だけを用意し、中身は仮の表示にしておく
- 3D 側とのつなぎ方（渡すデータの形、イベントの名前など）を決めたら、この節に書く

### 3D 側とのつなぎ方（今の形）

- 差し込む場所は `src/components/StageSlot.tsx`。今は仮の表示と、デモ用の「着いたことにする」ボタンだけ
- 記録は `src/lib/progress.ts` に集める。3D 側は着いた・出会ったときに `collect(key, name, points)`・`visit()`・`awaken()`・`addWalk(m)`・`lapArrive()` を呼ぶ。画面（HUD・図鑑・ガチャ）は記録の変化を受けて自動で描き直す
- 図鑑の key は `ebisu:<id>`（デモの3体）、`cat:<fid>`（828体の一覧）、`sage:<id>`（七賢人）
- お知らせは `src/lib/ui-store.ts` の `toast(text)`
- 案内人に出会ったら `src/lib/guide-quiz.ts` の `meetGuide()` を呼ぶ（佐賀の歴史クイズを出す。`meetGuide('okuma')` のように問題の id も渡せる）。問題は `src/data/history-quiz.json`
- 右下のミニマップ（`src/components/MiniMap.tsx`）はフレーム側（`src/components/ar/MiniMap.tsx` は AR デモの配置図で、別物）。今いる場所は `src/lib/position.ts` に集める。GPS はミニマップが書き、3D 側がデモの位置（地図を押してそこに立ったことにする、など）を出すときは `setPosition(lat, lng, 'demo')` を呼ぶ
- 「見に行く」（地図の道案内）は 3D／地図側の担当。`BookDialog` の `onGo(fid)` で外に渡す

### AR のデモ（`/ar-demo`）

`ar-ebisu-sample`（AR の PoC。仕様は同リポジトリの `docs/reimplementation-guide.md`）を移したもの。`ARClient` で `<Frame stage={<ARView … />} />` とし、トップと同じ枠（図鑑・ガチャ・HUD・ミニマップ・BGM・お知らせ）を AR 画面の上に重ねている。枠は `Frame` の `stage` に渡したものを `StageSlot` の代わりに敷く（`.walk.is-ar` のときの置き方は `globals.css` の末尾）。

- デモ用の案内人「おばあちゃん」（`figure: obaachan`）を置いている。元絵は自作の `scripts/obaachan.svg`（左が正面、右が背面）。絵を変えたら sharp で `assets/figures/obaachan.png` に書き出してから `npm run prepare:figure`。タップでクイズを出すつなぎはまだ無い

- 置くものは `src/data/ar-objects.json` で決める。2 段に分かれている
  - `figures`: 素材（見た目）。`views` は面の並び（`["front","back"]` の二面、または `["front","side","back"]` の三面）。元画像は白背景で、左から `views` の順に等幅で並べる
  - `objects`: 置き方。`figure`（どの素材）、`spawn`（出方）、`motion`（動き方）。同じ素材を何体でも置ける
- 出方と動き方の種類は `src/lib/ar/behaviors.ts`。種類を足すときは型（`SpawnRule` / `MotionRule`）と表（`SPAWNS` / `MOTIONS`）に 1 つずつ足す
  - spawn: `ahead`（視線の前方）、`geo`（緯度経度。最初の測位で原点が決まってから出る）
  - motion: `wander`（出現地点の周りを歩き回る）、`stay`（立ち止まってこちらを向く）
- 二面の素材は、θ < 90° で正面、それ以上で背面。真横から見ても板は進行方向を向いたまま
- 素材を変えたら `npm run prepare:figure` で `public/figures/<id>/` を作り直し、生成物もコミットする（ビルドでは走らせない）
- 図鑑とつなぐときは、`objects[].progressKey` に図鑑の key を書き、近づいた・タップしたときに `progress.ts` の関数を呼ぶ形にする（まだ無い）
- drei の `<Html>` は、後からマウントするとカメラか位置が動くまで距離に応じた拡大率を当てない。名札は最初からマウントし、表示だけ切り替える

## 関連リポジトリ

試作・企画の資料は、隣のディレクトリ `../smart-hackathon-20261115/`（GitHub: `midnight480/smart-hackathon-20261115`）にある。実装の前に該当箇所を読む。

| 読むもの | 場所 |
| --- | --- |
| **機能のまとめ（仕様の正本）** | `planning/ebisu-walk.md` |
| 企画コンセプト（恵比寿さんは時間の窓） | `planning/concept.md` |
| ペルソナ | `planning/personas.md` |
| 試作（AR、図鑑、ガチャ、クエストなど） | `prototype/sanpo/`（`walk.html` / `walk.js` ほか。README にファイルの役割がある） |
| データ | `prototype/sanpo/data/`（`ebisu-catalog.json`: 828 体、`characters.json`、`quiz.json`、`guides.json` など）、`planning/data/ebisu-demo.json` |
| デザインシステム | `design/DESIGN.md`・`design/tokens.css`・`design/components/` |
| Vercel のナレッジ | `docs/vercel/README.md` |

試作のコードやデータを持ってくるときは、ライセンス表記（Leaflet: BSD-2-Clause、Astronomy Engine: MIT、Yale Bright Star Catalog: MIT など）も一緒に持ってくる。

## 技術スタック

- フレームワーク: Next.js 16（App Router）+ React 19 + TypeScript
- ホスティング: Vercel（Fluid Compute、Node.js 24）
- ローカル開発: Node.js 26.12.0（`.nvmrc` に指定。`nvm use` で切り替える）
- 地図: Leaflet 1.9.4（タイルは地理院タイル。出典を地図の隅に出す）、徒歩ルートは OpenStreetMap
- 公開先: https://sagamongo.vercel.app（Vercel の `midnight480` チーム、プロジェクト名 `sagamongo`）
- 設定ファイル: `vercel.ts`（`@vercel/config`）

## ディレクトリ構成

```
.
├── AGENTS.md            # エージェント共通ルール（正本）
├── CLAUDE.md            # Claude Code 用。@AGENTS.md を読み込むだけ
├── README.md
├── vercel.ts            # Vercel のプロジェクト設定
├── next.config.ts       # Next.js の設定（/sw.js のヘッダー）
├── public/icons/        # PWA のアイコン
├── public/sw.js         # Service Worker。中身を変えたら VERSION を上げる
├── .nvmrc               # ローカル開発の Node.js バージョン（nvm 用）
├── assets/figures/      # AR の素材の元画像（白背景。左から views の順）
├── scripts/             # prepare-figure.mjs（AR の素材生成。npm run prepare:figure）と lib/、obaachan.svg（案内人の元絵）、icon.svg・make-icons.mjs（PWA のアイコンを作る）
├── public/img/sages/    # 七賢人の肖像（国立国会図書館「近代日本人の肖像」）
├── public/figures/      # AR の素材の生成物（<id>/{front,back,side}.png・board.json）
└── src/
    ├── app/             # ページとレイアウト（layout.tsx / page.tsx / manifest.ts / globals.css）、ar-demo/（AR のデモ）
    ├── components/      # Frame（枠）・Hud・GachaDialog・BookDialog・JoinDialog・Thumb・GuideQuizDialog・BgmButton・PwaRegister・MiniMap・StageSlot（3D の差し込み場所）
    │   └── ar/          # AR 画面（ARView・SceneObject・FigureBoard・カメラ・位置・デバッグ）
    ├── hooks/           # ブラウザ API の購読（カメラ・端末の向き・位置情報）
    ├── lib/             # progress（記録）・rarity・gacha・gacha-fx（演出）・events・catalog（データの組み立て）・ui-store・bgm（自作 BGM）・guide-quiz（案内人の歴史クイズ）・position（今いる場所）・demo（デモ操作）
    │   └── ar/          # AR の純粋関数（angle・geo・facing・behaviors（出方・動き方）・objects（定義の読み込み））
    ├── data/            # 試作から移した JSON（ebisu-catalog / ebisu-demo / characters / chapters / events / ranking-demo）、ar-objects.json、history-quiz.json（案内人の歴史クイズ）
    └── styles/          # tokens.css・components.css（design/ から複製）、frame.css（試作 walk.css から移したもの）、ar.css
```

- `src/styles/tokens.css`・`components.css` は `../smart-hackathon-20261115/design/` の複製。元を変えたら合わせて写す
- `src/lib/gacha-fx.ts` は試作の描画コードをそのまま動かすため、型チェックを外している（`@ts-nocheck`）

## 作業ルール

### 全般

- 回答・コメント・ドキュメントは日本語で書く。コード中の識別子は英語
- ハッカソンなので「動くものを早く」を優先する。機能の多さより、1つの体験が通しで動くことを優先する
- ただし秘密情報と写真の扱いだけは妥協しない
- 新しいディレクトリやツールを足したら、このファイルの「ディレクトリ構成」を更新する
- 仕様を変えたら、`planning/ebisu-walk.md` 側も直すかをユーザーに確認する

### 秘密情報

- API キー、トークン、`.env*` はコミットしない（`.env.example` だけコミットする）
- 環境変数は `vercel env add` で登録し、ローカルには `vercel env pull .env.local` で落とす

### Vercel

- 作業の前に `../smart-hackathon-20261115/docs/vercel/README.md` を読む。記載と公式ドキュメントが食い違ったら公式を優先する
- プロジェクト設定は `vercel.json` ではなく `vercel.ts` に書く
- `export const runtime = 'edge'` は書かない（Edge runtime は非推奨。ストリーミングも Node.js runtime で動く）
- 関数のリクエスト／レスポンスボディは 4.5 MB まで。画像など大きいファイルは Vercel Blob を使う
- DB や外部サービスが必要になったら、Vercel Marketplace の連携を先に検討する（Vercel Postgres / KV はもう提供されていない）
- Preview デプロイで動きを確かめてから `vercel --prod` で本番に出す
- 新しく分かったハマりどころは、このファイルか `docs/` に追記する

### UI 実装

- UI を作る前に `../smart-hackathon-20261115/design/DESIGN.md` を読み、色・余白・角丸・文字サイズはトークン（`design/tokens.css`）から使う。値を直書きしない
- 部品は `../smart-hackathon-20261115/design/components/<部品名>.md` の仕様（状態・アクセシビリティ）に合わせる
- スマホでの利用が主。カメラ・端末の向き・位置情報は、iPhone ではユーザー操作（ボタン）を挟んで許可を求める

### Git

- コミットはユーザーに頼まれたときだけ行う
- コミットメッセージは日本語でよい。1 コミット 1 目的

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
