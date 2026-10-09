'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, LogOut, Clock, User, ShieldCheck } from 'lucide-react';
import { formatTime } from '@/lib/time-utils';

interface NavbarProps {
  userName?: string;
  role?: string;
  onLogoutClick?: () => void;
}

export function Navbar({ userName, role, onLogoutClick }: NavbarProps) {
  const router = useRouter();
  const [timeStr, setTimeStr] = useState<string>('');
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleDirectLogout = async () => {
    if (onLogoutClick) {
      onLogoutClick();
      return;
    }

    if (!confirm('Are you sure you want to log out?')) return;

    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error(err);
      setLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">
              Office Manager
            </h1>
            <p className="text-xs text-slate-500 font-medium">Accounting & Staff Operations</p>
          </div>
        </div>

        {/* Live Clock & User Info */}
        <div className="flex items-center space-x-3 sm:space-x-6">
          {/* Live Clock */}
          <div className="hidden sm:flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            <span>{timeStr || 'Loading...'} (IST)</span>
          </div>

          {/* User Badge */}
          {userName && (
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-semibold text-xs border border-slate-300">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-xs font-bold text-slate-900 leading-none">
                  {userName}
                </div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 mt-0.5">
                  {role === 'admin' ? (
                    <span className="text-indigo-600 font-bold flex items-center gap-0.5">
                      <ShieldCheck className="w-3 h-3" /> Admin
                    </span>
                  ) : (
                    <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                      <User className="w-3 h-3" /> Staff
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Logout Button */}
          <button
            onClick={handleDirectLogout}
            disabled={loggingOut}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 border border-rose-200 rounded-lg transition-colors cursor-pointer"
            title="Log out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{loggingOut ? 'Signing out...' : 'Logout'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
