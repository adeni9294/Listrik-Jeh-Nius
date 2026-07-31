import React from 'react';
import '@/app/globals.css'; // Pastikan TailwindCSS terimpor
import { BottomNav } from '@/components/layout/bottom-nav';

export const metadata = {
  title: 'Listrik Jenius - PWA Assistant',
  description: 'Asisten listrik pintar berbasis AI dan OCR offline-first',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="bg-slate-50 text-slate-900 antialiased min-h-screen">
        <main className="min-h-screen pb-16">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
