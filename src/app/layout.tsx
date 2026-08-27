import React from 'react';
import type { Metadata, Viewport } from 'next';
import '@/app/globals.css';
import { BottomNav } from '@/components/layout/bottom-nav';

export const metadata: Metadata = {
  title: 'Listrik Jeh-nius - AI Energy Assistant',
  description: 'Asisten Pintar Pembacaan dan Prediksi Token Listrik PLN berbasis AI',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Listrik Jenius',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#0F766E',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="bg-slate-100 text-slate-900 antialiased min-h-screen flex flex-col">
        {/* Container pembatas layar: Responsif dari HP hingga Layar Lebar Desktop (max-w-6xl) */}
        <div className="w-full max-w-6xl mx-auto min-h-screen bg-slate-50 relative shadow-sm flex flex-col">
          <main className="flex-1 pb-24 px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
            {children}
          </main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
