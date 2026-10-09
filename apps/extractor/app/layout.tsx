import type { Metadata, Viewport } from 'next';
import { PwaRegister } from './pwa-register';
// @ts-ignore
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: 'Data Extractor',
  description: 'Handwritten data extraction and OCR platform.',
  applicationName: 'Data Extractor',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Data Extractor',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
