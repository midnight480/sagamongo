# さがもん！Go！

> 佐賀の町を歩くと、えびすさんと佐賀の七賢人が道を歩いている。像の前まで行って写真を撮ると、その像も動き出す。

SAGA スマートハッカソン（2026-11-15）で作っているアプリの本番実装です。Vercel で公開しています。

- 公開先：https://sagamongo.vercel.app
- 仕様の正本：[planning/ebisu-walk.md](https://github.com/midnight480/smart-hackathon-20261115/blob/main/planning/ebisu-walk.md)（企画と試作は [smart-hackathon-20261115](https://github.com/midnight480/smart-hackathon-20261115) にあります）

## このリポジトリで作るもの

フレーム側を作ります。3D 部分（えびすさんが歩く AR 画面）は別の担当が作り、`src/components/StageSlot.tsx` に差し込みます。

| できていること | 中身 |
| --- | --- |
| えびすガチャ | 図鑑にえびす像を入れて貯まった「使えるポイント」で回せる（1回 100pt）。デモ決済でも回せる（回すほど安くなる値段 ¥300 → ¥150）。レア度の抽選（N 60%／R 25%／SR 12%／SSR 3%）、カプセルの演出（予告・昇格・どんでん返し）、効果音 |
| 図鑑 | 弾（エリア）ごとの図鑑、七賢人、佐賀のえびす像 828 体の一覧（レア度と「持っている」で絞り込み） |
| ランキング | 集めた数・累積ポイント・クエスト達成・最速コンプリート・周回数・歩いた距離（ほかの参加者は架空） |
| ポイント | 使えるポイントと累積ポイント、段位、履歴 |
| 七賢人が仲間になる | えびす像を 10 体集めるごとに一人（N → R → SR → SSR の順） |
| イベントのブースト | 十日恵比須大祭の期間はポイント 2 倍・ガチャのレア 2 倍 |
| PWA | ホーム画面に追加すると、アプリのように全画面で開く。一度開いた画面は端末に置き、電波が悪くても開ける |
| BGM（自作） | お囃子風の曲「えびす囃子」を Web Audio でその場で鳴らす。最初に画面に触れると流れ、上の「BGM」ボタンで止められる。ガチャ中は小さくなる |

まだ移していないもの：案内人とクエスト、知恵くらべ（クイズ）、好みを聞く画面、周回のコンプリート画面、記念撮影。

## 発表で使う URL

| URL | 見せられるもの |
| --- | --- |
| `/?gacha=SSR&reversal=1` | どんでん返しで SSR が出る |
| `/?gacha=SR` など | そのレア度を必ず出す |
| `/?date=2027-01-10` | 十日恵比須大祭のブースト |

3D 部分ができるまでは、画面中央の「どこかのえびす像に着いたことにする（デモ）」で、像を集めたことにできます。

### AR のデモ（`/ar-demo`）

スマホで開いて「AR を開始」を押すと、カメラ映像の先にえびすさんが現れて歩き回ります。歩いて近づいたり、回り込んで後ろ姿を見たりできます（位置は GPS、向きはコンパス）。HTTPS が必要です。PC ではドラッグで見回し、WASD / 矢印キーで歩けます。

- 置くもの（素材・出方・動き方）は `src/data/ar-objects.json` で決めます
- 素材の画像（白背景、左から正面・背面）を変えたら `npm run prepare:figure` で `public/figures/<id>/` を作り直し、生成物もコミットします

## 開発

Node.js 24 で動かします。

```sh
npm install
npm run dev     # http://localhost:3000
npm run lint
npm run build
```

## ホーム画面に追加する（PWA）

- iPhone（Safari）：共有ボタン →「ホーム画面に追加」
- Android（Chrome）：メニュー →「ホーム画面に追加」（または「アプリをインストール」）

Service Worker を変えたら、`public/sw.js` の `VERSION` を上げてください。古い置き場は次に開いたときに消えます。アイコンを描き直したら `node scripts/make-icons.mjs` を流します。

## デプロイ

Vercel の `midnight480` チームの `sagamongo` プロジェクトに、GitHub のリポジトリをつないであります。

| 操作 | デプロイ先 |
| --- | --- |
| `main` への push、PR のマージ | 本番（https://sagamongo.vercel.app） |
| PR を作る・PR のブランチに push | Preview（PR ごとに URL が出る） |

手元から出すこともできます。

```sh
vercel            # Preview にデプロイ
vercel --prod     # 本番にデプロイ
```

環境変数は `vercel env add` で登録し、ローカルには `vercel env pull .env.local` で落とします。`.env*` はコミットしません。

## ディレクトリ

```
src/
├── app/            # Next.js（App Router）のページとレイアウト
├── components/     # 画面の部品（HUD・図鑑・ガチャ・七賢人・BGM ボタン・3D の差し込み場所）
├── lib/            # ロジック（記録、レア度、ガチャ、イベント、BGM、データの組み立て）
├── data/           # えびす像・七賢人・エリア・イベントなどの JSON（試作から移したもの）、AR に置くもの
└── styles/         # デザイントークンと部品のスタイル
public/img/sages/   # 七賢人の肖像写真
public/icons/       # アプリのアイコン（scripts/icon.svg から scripts/make-icons.mjs で作る）
public/sw.js        # Service Worker（PWA。画面と静的ファイルを端末に置く）
public/figures/     # AR の素材（npm run prepare:figure の生成物）
assets/figures/     # AR の素材の元画像
scripts/            # 素材の生成スクリプト（AR の素材、PWA のアイコン）
```

## 記録とプライバシー

- 記録（集めたもの・ポイント）は、今はこの端末のブラウザ（localStorage）にだけ保存します
- ユーザーが撮った写真は端末の中だけに置き、サーバーには送りません
- 決済はデモです。実際の支払いは発生しません
- BGM と効果音は自作です（音声ファイルを使わず、ブラウザの Web Audio で鳴らしています）

## 出典

- えびす像の写真と位置：© 恵比須DEまちづくりネットワーク（公式サイト「佐賀恵比須」）。写真はリポジトリに保存せず、公式サイトから表示しています。一般に公開する前に、使い方を相談します
- 七賢人の肖像：国立国会図書館「近代日本人の肖像」
- AR の表示：[three.js](https://threejs.org/)（MIT）、[React Three Fiber](https://github.com/pmndrs/react-three-fiber)・[drei](https://github.com/pmndrs/drei)（MIT）。素材の生成に [sharp](https://sharp.pixelplumbing.com/)（Apache-2.0）

## エージェント向け

AI エージェント向けのルールは [AGENTS.md](./AGENTS.md) にあります（`CLAUDE.md` はそれを読み込むだけです）。
