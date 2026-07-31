'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, History, Camera, BarChart3, Bot, User } from 'lucide-react';

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/history', label: 'Riwayat', icon: History },
    { href: '/scan', label: 'Scan', icon: Camera, isFAB: true },
    { href: '/analysis', label: 'Analisis', icon: BarChart3 },
    { href: '/ai', label: 'AI', icon: Bot },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-t border-slate-200/80 px-3 py-2 max-w-lg mx-auto">
      <div className="flex justify-between items-center">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          if (item.isFAB) {
            return (
              <Link key={item.href} href={item.href} className="-mt-6">
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
              className={`flex flex-col items-center justify-center w-12 py-1 text-[10px] font-medium transition-colors ${
                isActive ? 'text-teal-700 font-bold' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className={`w-5 h-5 mb-1 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
