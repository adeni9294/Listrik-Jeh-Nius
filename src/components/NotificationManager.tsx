'use client';

import { useEffect } from 'react';

export default function NotificationManager({ daysLeft }: { daysLeft: number }) {
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    if (daysLeft > 0 && daysLeft <= 2 && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('🚨 Token Listrik Kritis!', {
        body: `Sisa token toko diprediksi habis dalam ${daysLeft} hari. Segera lakukan isi ulang.`,
        icon: '/icon-192x192.png',
      });
    }
  }, [daysLeft]);

  return null;
}
