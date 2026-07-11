import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Commerce Platform | Operator Console',
  description: 'Bảng vận hành AI Teammate cho thương mại đa ngành',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
