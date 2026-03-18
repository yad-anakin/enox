import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  metadataBase: new URL('https://enox.website'),
  title: 'Enox AI',
  description: "Your premium gateway to the world's leading AI models.",
  openGraph: {
    title: 'Enox AI',
    description: "Your premium gateway to the world's leading AI models.",
    url: 'https://enox.website',
    images: [
      {
        url: '/enox.png',
        width: 1200,
        height: 630,
        alt: 'Enox AI',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Enox AI',
    description: "Your premium gateway to the world's leading AI models.",
    images: ['/enox.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
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
