import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  metadataBase: new URL('https://enox.website'),
  title: 'Enox Admin',
  description: 'Enox AI Platform Admin Dashboard',
  openGraph: {
    title: 'Enox Admin',
    description: 'Enox AI Platform Admin Dashboard',
    url: 'https://enox.website',
    images: [
      {
        url: '/enox.png',
        width: 1200,
        height: 630,
        alt: 'Enox Admin',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Enox Admin',
    description: 'Enox AI Platform Admin Dashboard',
    images: ['/enox.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground`}>
        {children}
      </body>
    </html>
  );
}
