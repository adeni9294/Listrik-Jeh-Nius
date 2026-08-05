'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, History, Camera, BarChart3, Bot } from 'lucide-react';

export function BottomNav() {
  const pathname = usePathname();

  // Sembunyikan BottomNav di halaman Login, Tambah Toko, & Reset Password
  if (
    pathname === '/login' ||
    pathname === '/toko/tambah' ||
    pathname === '/lupa-password'
  ) {
    return null;
  }

  const navItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/history', label: 'Riwayat', icon: History },
    { href: '/scan', label: 'Scan', icon: Camera, isFAB: true },
    { href: '/analysis', label: 'Analisis', icon: BarChart3 },
    { href: '/ai', label: 'AI', icon: Bot },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-2 sm:p-4 pointer-events-none flex justify-center">
      <div className="pointer-events-auto w-full max-w-md sm:max-w-lg bg-white/90 backdrop-blur-lg border border-slate-200/80 shadow-xl rounded-2xl sm:rounded-full px-4 py-2 flex justify-between items-center">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          if (item.isFAB) {
            return (
              <Link key={item.href} href={item.href} className="-mt-7 sm:-mt-8">
                <div className="w-14 h-14 bg-teal-700 hover:bg-teal-800 rounded-full flex items-center justify-center text-white shadow-lg shadow-teal-700/40 border-4 border-slate-50 transition-transform active:scale-95">
                  <Icon className="w-6 h-6" />
                </div>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors ${
                isActive
                  ? 'text-teal-700 font-bold bg-teal-50/80'
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <Icon
                className={`w-5 h-5 mb-0.5 ${
                  isActive ? 'stroke-[2.5]' : 'stroke-2'
                }`}
              />
              <span className="text-[10px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
