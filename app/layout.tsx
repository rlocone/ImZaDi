import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'https://imzadi.love'),
  title: {
    default: 'ImZaDi - Stories That Connect',
    template: '%s | ImZaDi',
  },
  description: 'Explore compelling narratives about relationships, family bonds, and the beautiful complexity of human connections.',
  openGraph: {
    type: 'website',
    siteName: 'ImZaDi',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black antialiased">
        {children}
      </body>
    </html>
  );
}
