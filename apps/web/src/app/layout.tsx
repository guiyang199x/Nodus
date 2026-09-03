import { GeistSans } from 'geist/font/sans';

import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: '知识工作台',
  description: '让知识重新连接：登录后继续整理、发现与提问。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={GeistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
