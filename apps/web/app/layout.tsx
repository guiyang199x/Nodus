import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Knowledge Base',
  description: 'AI-powered knowledge base with document processing and grounded chat',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
