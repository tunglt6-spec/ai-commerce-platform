import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Commerce Platform',
  description: 'AI Teammate for multi-category e-commerce',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
