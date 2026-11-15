import type { Metadata } from 'next';
import QRCode from 'qrcode';
import { QUESTIONS, QUIZ_POINTS } from '@/lib/guide-quiz';
import './print.css';

// 町の案内人（おばあちゃん）に渡す、印刷用の QR コード。
// 読み取ると /guide に来て、トップでまだ正解していない歴史クイズが出る（行き先は next.config.ts の redirects）。
// A4 に 4 枚並ぶので、印刷して切り分けて配る。

export const metadata: Metadata = {
  title: '案内人の QR コード（印刷用） | さがもん！Go！',
  robots: { index: false },
};

// 印刷物に載せるので、本番の URL に固定する
const GUIDE_URL = 'https://sagamongo.vercel.app/guide';
const CARDS = 4;

export default async function GuideQrPage() {
  // 自分で作った SVG なので、そのまま埋め込む
  const svg = await QRCode.toString(GUIDE_URL, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 });

  return (
    <main className="qr-sheet">
      <div className="qr-help">
        <h1>案内人の QR コード（印刷用）</h1>
        <p>
          町の案内人に渡す QR コードです。ブラウザの印刷（⌘P / Ctrl+P）で A4 に印刷し、切り分けて渡してください。
          読み取ると「さがもん！Go！」が開き、佐賀の歴史クイズ（全 {QUESTIONS.length} 問。初めて正解すると {QUIZ_POINTS}pt）が出ます。
        </p>
        <p>行き先：<code>{GUIDE_URL}</code>（このページは印刷しても出ません）</p>
      </div>
      <div className="qr-cards">
        {Array.from({ length: CARDS }, (_, i) => (
          <section key={i} className="qr-card" aria-label="案内人の QR コード">
            <p className="qr-card-app">さがもん！Go！</p>
            <p className="qr-card-title">町の案内人のクイズ</p>
            <div className="qr-card-code" role="img" aria-label={`QR コード：${GUIDE_URL}`} dangerouslySetInnerHTML={{ __html: svg }} />
            <p className="qr-card-text">スマホのカメラで読み取ると、<br />佐賀の歴史クイズが出ます</p>
            <p className="qr-card-url">{GUIDE_URL.replace('https://', '')}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
