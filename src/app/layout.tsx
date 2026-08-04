import React from 'react';
import type { Metadata, Viewport } from 'next';
import '@/app/globals.css';
import { BottomNav } from '@/components/layout/bottom-nav';

export const metadata: Metadata = {
  title: 'Listrik Jenius - AI Energy Assistant',
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
      <body className="bg-slate-100 text-slate-900 antialiased min-h-screen">
        {/* Container pembatas layar agar tampilan di Desktop tetap rapi ala mobile-first */}
        <div className="mx-auto max-w-md min-h-screen bg-slate-50 relative shadow-md flex flex-col">
          <main className="flex-1 pb-24 px-4 pt-4">
            {children}
          </main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
