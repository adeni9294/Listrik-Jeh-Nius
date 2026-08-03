'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KeyRound, Mail, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(`Gagal Login: ${error.message}`);
      setIsSubmitting(false);
    } else {
      router.push('/');
      router.refresh();
    }
  };

  const handleSignUp = async () => {
    setIsSubmitting(true);
    setMessage(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(`Gagal Daftar: ${error.message}`);
    } else {
      setMessage('Pendaftaran berhasil! Silakan periksa email atau lakukan login.');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="p-4 space-y-4 pt-12 max-w-sm mx-auto">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-lg font-bold text-slate-800 flex items-center justify-center gap-2">
            <KeyRound className="w-5 h-5 text-teal-700" /> Masuk ke Listrik Jenius
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && (
            <div className="p-3 bg-slate-100 text-slate-700 text-xs rounded-lg border border-slate-200">
              {message}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="nama@toko.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Kata Sandi</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="••••••••"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs py-5 rounded-xl"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Masuk'}
            </Button>
          </form>

          <div className="pt-2 text-center">
            <button
              onClick={handleSignUp}
              disabled={isSubmitting || !email || !password}
              className="text-xs text-teal-700 hover:underline font-semibold disabled:opacity-50"
            >
              Belum punya akun? Buat Akun Baru
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
