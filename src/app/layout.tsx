import React from 'react';
import type { Metadata, Viewport } from 'next';
import '@/app/globals.css';
import { BottomNav } from '@/components/layout/bottom-nav';

export const metadata: Metadata = {
  title: 'Listrik Jenius - PWA Assistant',
  description: 'Asisten listrik pintar berbasis AI dan OCR offline-first',
  manifest: '/manifest.json',
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
  themeColor: '#0f766e',
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
      <body className="bg-slate-50 text-slate-900 antialiased min-h-screen">
        {/* Container pembatas layar agar tampilan di Desktop tetap rapi ala mobile-first */}
        <div className="mx-auto max-w-md min-h-screen bg-slate-50 relative shadow-sm">
          <main className="min-h-screen pb-24 px-4 pt-4">
            {children}
          </main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
