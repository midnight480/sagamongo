import type { Metadata, Viewport } from 'next';
import '@/styles/tokens.css';
import '@/styles/components.css';
import '@/styles/frame.css';
import './globals.css';
import { PwaRegister } from '@/components/PwaRegister';

export const metadata: Metadata = {
  title: 'さがもん！Go！',
  description: '佐賀の町を歩くと、えびすさんと佐賀の七賢人が道を歩いている。像の前まで行って写真を撮ると、その像も動き出す。',
  applicationName: 'さがもん！Go！',
  // iPhone でホーム画面に追加したとき、全画面のアプリとして開く
  appleWebApp: { capable: true, title: 'さがもんGo', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#16181d',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" data-theme="dark">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
