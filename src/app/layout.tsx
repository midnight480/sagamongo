import type { Metadata, Viewport } from 'next';
import '@/styles/tokens.css';
import '@/styles/components.css';
import '@/styles/frame.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'さがもん！Go！',
  description: '佐賀の町を歩くと、えびすさんと佐賀の七賢人が道を歩いている。像の前まで行って写真を撮ると、その像も動き出す。',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
