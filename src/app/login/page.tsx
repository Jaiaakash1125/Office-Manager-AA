'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Lock, User, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid credentials');
      }

      // Successful login -> route to appropriate dashboard
      if (data.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/worker');
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Failed to login');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative background grid and glow */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-40" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-500/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Brand Icon & Heading */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-600/30 ring-4 ring-indigo-500/20">
            <Building2 className="w-9 h-9" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-white">
          Office Manager
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Accounting & Operations Portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="bg-slate-800/90 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-700/80">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3.5 flex items-start space-x-3 text-rose-300 text-sm">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="username"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
              >
                Username
              </label>
              <div className="mt-2 relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="h-4 w-4" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. admin or john"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
              >
                Password
              </label>
              <div className="mt-2 relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl shadow-lg shadow-indigo-600/30 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <span className="inline-flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Signing In...
                  </span>
                ) : (
                  <span className="inline-flex items-center">
                    Sign In <ArrowRight className="ml-2 w-4 h-4" />
                  </span>
                )}
              </button>
            </div>
          </form>

          {/* Quick instructions / Help */}
          <div className="mt-6 pt-6 border-t border-slate-700/60 text-xs text-slate-400">
            <div className="flex items-center gap-1.5 font-semibold text-slate-300 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Office Access Note</span>
            </div>
            <p className="leading-relaxed">
              Login is logged in real-time. First login of the day marks your attendance. Logging in after 10:00 AM IST will be marked as Late.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
