import { GeistSans } from 'geist/font/sans';

import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: { default: '知识工作台', template: '%s · 知识工作台' },
  description: '默认私密的个人与团队知识空间',
  referrer: 'strict-origin-when-cross-origin',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className={GeistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
