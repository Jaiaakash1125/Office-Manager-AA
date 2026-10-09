'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { HeartbeatListener } from '@/components/HeartbeatListener';
import {
  Clock,
  PhoneCall,
  PhoneOff,
  PhoneMissed,
  UserCheck,
  Plus,
  Trash2,
  Calendar,
  Save,
  CheckCircle2,
  AlertTriangle,
  FileText,
  History,
  PhoneForwarded,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import {
  formatTime,
  formatDate,
  formatActiveSeconds,
  calculateDurationHours,
  getOfficeDateString,
} from '@/lib/time-utils';

export default function WorkerDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [attendance, setAttendance] = useState<any>(null);
  const [pastAttendance, setPastAttendance] = useState<any[]>([]);
  const [callStats, setCallStats] = useState<any>({
    total_calls: 0,
    interested: 0,
    not_interested: 0,
    not_reachable: 0,
  });
  const [callbacks, setCallbacks] = useState<any[]>([]);
  const [workLogs, setWorkLogs] = useState<any[]>([]);
  const [totalLogMinutes, setTotalLogMinutes] = useState(0);
  const [dailyNote, setDailyNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteSavedAlert, setNoteSavedAlert] = useState(false);
  const [currentOfficeDate, setCurrentOfficeDate] = useState<string>('');

  // New Lead Modal
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [newLead, setNewLead] = useState({
    name: '',
    phone: '',
    note: '',
    callbackDate: '',
  });
  const [submittingLead, setSubmittingLead] = useState(false);

  // Work Log Form
  const [logDesc, setLogDesc] = useState('');
  const [logMinutes, setLogMinutes] = useState('30');
  const [submittingLog, setSubmittingLog] = useState(false);

  // Logout Modal
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Active tab in lower section
  const [activeTab, setActiveTab] = useState<'worklog' | 'callbacks' | 'history'>('worklog');

  // Elapsed time state for live hours
  const [elapsedDuration, setElapsedDuration] = useState('0h 0m');

  const fetchData = useCallback(async () => {
    try {
      // 1. Fetch own leads & callbacks
      const leadsRes = await fetch('/api/worker/leads');
      if (leadsRes.ok) {
        const data = await leadsRes.json();
        setCallbacks(data.todayCallbacks || []);
      }

      // 2. Fetch today's work logs
      const logsRes = await fetch('/api/worker/work-log');
      if (logsRes.ok) {
        const data = await logsRes.json();
        setWorkLogs(data.logs || []);
        setTotalLogMinutes(data.totalMinutes || 0);
      }

      // 3. Fetch today's work note
      const noteRes = await fetch('/api/worker/notes');
      if (noteRes.ok) {
        const data = await noteRes.json();
        setDailyNote(data.note || '');
      }

      // 4. Initial self attendance & stats via Supabase client or direct query
      // (Let's fetch today's attendance & stats)
      const res = await fetch('/api/worker/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'sync_only' }),
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json();
        if (data.stats) setCallStats(data.stats);
      }
    } catch (err) {
      console.error('Error fetching worker data:', err);
    }
  }, []);

  // Fetch initial profile & attendance history
  useEffect(() => {
    async function loadInitial() {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.push('/login');
          return;
        }

        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        setProfile(prof);

        const today = getOfficeDateString();
        const { data: todayAtt } = await supabase
          .from('attendance')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', today)
          .maybeSingle();

        setAttendance(todayAtt);

        // Fetch past attendances
        const { data: hist } = await supabase
          .from('attendance')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .limit(30);

        setPastAttendance(hist || []);

        // Fetch call stats
        const { data: stats } = await supabase
          .from('call_stats')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', today)
          .maybeSingle();

        if (stats) {
          setCallStats(stats);
        }
      } catch (e) {
        console.error(e);
      }
    }

    loadInitial();
    fetchData();
    const todayStr = getOfficeDateString();
    setCurrentOfficeDate(todayStr);
    setNewLead((prev) => ({ ...prev, callbackDate: todayStr }));
  }, [fetchData, router]);

  // Update live elapsed duration ticker
  useEffect(() => {
    if (!attendance?.login_time) return;

    const updateDuration = () => {
      const { formatted } = calculateDurationHours(
        attendance.login_time,
        attendance.logout_time
      );
      setElapsedDuration(formatted);
    };

    updateDuration();
    const interval = setInterval(updateDuration, 60000);
    return () => clearInterval(interval);
  }, [attendance]);

  // Telecalling fast actions
  const handleCallAction = async (type: 'not_interested' | 'not_reachable') => {
    try {
      const res = await fetch('/api/worker/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      if (res.ok) {
        const data = await res.json();
        setCallStats(data.stats);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLead.name || !newLead.phone) return;

    setSubmittingLead(true);
    try {
      const res = await fetch('/api/worker/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'interested',
          lead: newLead,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCallStats(data.stats);
        setIsLeadModalOpen(false);
        setNewLead({
          name: '',
          phone: '',
          note: '',
          callbackDate: getOfficeDateString(),
        });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingLead(false);
    }
  };

  const handleUpdateLeadStatus = async (leadId: string, status: string) => {
    try {
      const res = await fetch('/api/worker/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, status }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddWorkLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logDesc || !logMinutes) return;

    setSubmittingLog(true);
    try {
      const res = await fetch('/api/worker/work-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: logDesc,
          minutes: parseInt(logMinutes, 10),
        }),
      });
      if (res.ok) {
        setLogDesc('');
        setLogMinutes('30');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingLog(false);
    }
  };

  const handleDeleteWorkLog = async (id: string) => {
    try {
      const res = await fetch(`/api/worker/work-log?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveDailyNote = async () => {
    setSavingNote(true);
    try {
      const res = await fetch('/api/worker/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: dailyNote }),
      });
      if (res.ok) {
        setNoteSavedAlert(true);
        setTimeout(() => setNoteSavedAlert(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingNote(false);
    }
  };

  const handleConfirmLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyNote }),
      });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error(err);
      setLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <HeartbeatListener />
      <Navbar
        userName={profile?.name || 'Worker'}
        role="worker"
        onLogoutClick={() => setIsLogoutModalOpen(true)}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 space-y-6">
        {/* Welcome & Today Summary Banner */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl p-5 sm:p-6 text-white shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                Staff Portal
              </span>
              <span className="text-xs text-slate-400">
                {currentOfficeDate ? formatDate(currentOfficeDate) : 'Today'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold mt-1 text-white">
              Hello, {profile?.name || 'Staff Member'} 👋
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
              Keep your telecalling high and remember to log your tasks before clocking out.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsLogoutModalOpen(true)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md shadow-rose-900/30 transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>Daily Wrap & Logout</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* TOP STATS CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Login Time Card */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-medium uppercase tracking-wider">Clock-In</span>
              <Clock className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-lg sm:text-xl font-bold text-slate-900">
                {formatTime(attendance?.login_time)}
              </span>
              {attendance?.is_late && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  Late (&gt;10 AM)
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Recorded via server time</p>
          </div>

          {/* Time Elapsed Card */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-medium uppercase tracking-wider">Office Hours</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-slate-900">
              {elapsedDuration}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Active: {formatActiveSeconds(attendance?.active_seconds || 0)}
            </p>
          </div>

          {/* Today Calls Card */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-medium uppercase tracking-wider">Today's Calls</span>
              <PhoneCall className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-slate-900">
              {callStats.total_calls}
            </div>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1">
              {callStats.interested} Interested Leads
            </p>
          </div>

          {/* Logged Work Time */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-medium uppercase tracking-wider">Work Logged</span>
              <FileText className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-slate-900">
              {Math.floor(totalLogMinutes / 60)}h {totalLogMinutes % 60}m
            </div>
            <p className="text-[11px] text-slate-400 mt-1">{workLogs.length} tasks registered</p>
          </div>
        </div>

        {/* TELECALLING ACTION CENTER */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-indigo-600" />
                Telecalling Quick Actions
              </h3>
              <p className="text-xs text-slate-500">
                Tap the result buttons immediately after finishing a call. Only Interested prospects ask for details.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 self-start">
              <span>Total: <b>{callStats.total_calls}</b></span>
              <span className="text-slate-300">|</span>
              <span className="text-emerald-700">Int: <b>{callStats.interested}</b></span>
              <span className="text-slate-300">|</span>
              <span className="text-rose-700">Not Int: <b>{callStats.not_interested}</b></span>
              <span className="text-slate-300">|</span>
              <span className="text-amber-700">Not Reach: <b>{callStats.not_reachable}</b></span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {/* Interested Button */}
            <button
              onClick={() => setIsLeadModalOpen(true)}
              className="flex flex-col items-center justify-center p-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border-2 border-emerald-300 text-emerald-900 font-bold transition transform active:scale-98 shadow-xs cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center mb-2 shadow-sm">
                <UserCheck className="w-6 h-6" />
              </div>
              <span className="text-sm sm:text-base">Interested Client</span>
              <span className="text-[11px] font-medium text-emerald-700 mt-0.5">
                +1 & Open Lead Form
              </span>
            </button>

            {/* Not Interested Button */}
            <button
              onClick={() => handleCallAction('not_interested')}
              className="flex flex-col items-center justify-center p-4 rounded-xl bg-rose-50 hover:bg-rose-100 active:bg-rose-200 border-2 border-rose-200 text-rose-900 font-bold transition transform active:scale-98 shadow-xs cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-rose-600 text-white flex items-center justify-center mb-2 shadow-sm">
                <PhoneOff className="w-6 h-6" />
              </div>
              <span className="text-sm sm:text-base">+1 Not Interested</span>
              <span className="text-[11px] font-medium text-rose-700 mt-0.5">
                Current: {callStats.not_interested}
              </span>
            </button>

            {/* Not Reachable Button */}
            <button
              onClick={() => handleCallAction('not_reachable')}
              className="flex flex-col items-center justify-center p-4 rounded-xl bg-amber-50 hover:bg-amber-100 active:bg-amber-200 border-2 border-amber-200 text-amber-900 font-bold transition transform active:scale-98 shadow-xs cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-amber-600 text-white flex items-center justify-center mb-2 shadow-sm">
                <PhoneMissed className="w-6 h-6" />
              </div>
              <span className="text-sm sm:text-base">+1 Not Reachable</span>
              <span className="text-[11px] font-medium text-amber-700 mt-0.5">
                Current: {callStats.not_reachable}
              </span>
            </button>
          </div>
        </div>

        {/* LOWER SPLIT SECTION: TABS & DAILY NOTE */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT 2 COLUMNS: TABS (Work Log, Today's Callbacks, Attendance History) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
            {/* Tab Headers */}
            <div className="flex border-b border-slate-200 bg-slate-50/70 px-4 pt-3 gap-2 overflow-x-auto">
              <button
                onClick={() => setActiveTab('worklog')}
                className={`px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-t-lg transition border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === 'worklog'
                    ? 'border-indigo-600 text-indigo-700 bg-white shadow-xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Work Log ({workLogs.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('callbacks')}
                className={`px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-t-lg transition border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === 'callbacks'
                    ? 'border-indigo-600 text-indigo-700 bg-white shadow-xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <PhoneForwarded className="w-4 h-4 text-emerald-600" />
                <span>Today's Callbacks</span>
                {callbacks.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold">
                    {callbacks.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('history')}
                className={`px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-t-lg transition border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === 'history'
                    ? 'border-indigo-600 text-indigo-700 bg-white shadow-xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <History className="w-4 h-4" />
                <span>Attendance History</span>
              </button>
            </div>

            {/* Tab Body */}
            <div className="p-5 flex-1">
              {/* TAB 1: WORK LOG */}
              {activeTab === 'worklog' && (
                <div className="space-y-4">
                  {/* Quick Add Log Form */}
                  <form
                    onSubmit={handleAddWorkLog}
                    className="flex flex-col sm:flex-row items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200"
                  >
                    <input
                      type="text"
                      placeholder="What task did you work on? (e.g. GST filing for ABC Corp)"
                      value={logDesc}
                      onChange={(e) => setLogDesc(e.target.value)}
                      required
                      className="flex-1 w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <select
                        value={logMinutes}
                        onChange={(e) => setLogMinutes(e.target.value)}
                        className="px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="15">15 min</option>
                        <option value="30">30 min</option>
                        <option value="45">45 min</option>
                        <option value="60">1 hour (60m)</option>
                        <option value="90">1.5 hours (90m)</option>
                        <option value="120">2 hours (120m)</option>
                      </select>
                      <button
                        type="submit"
                        disabled={submittingLog || !logDesc}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs sm:text-sm rounded-lg transition disabled:opacity-50 flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add</span>
                      </button>
                    </div>
                  </form>

                  {/* Work Log List */}
                  {workLogs.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      No tasks logged yet today. Add tasks above to record your daily minutes.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                      {workLogs.map((log) => (
                        <div
                          key={log.id}
                          className="py-2.5 flex items-center justify-between gap-3 text-xs sm:text-sm group"
                        >
                          <div className="flex items-start gap-2">
                            <span className="font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs shrink-0 mt-0.5">
                              {log.minutes} min
                            </span>
                            <span className="text-slate-800">{log.description}</span>
                          </div>
                          <button
                            onClick={() => handleDeleteWorkLog(log.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: TODAY'S CALLBACKS */}
              {activeTab === 'callbacks' && (
                <div className="space-y-3">
                  {callbacks.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      No callbacks scheduled for today. Great job!
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                      {callbacks.map((lead) => (
                        <div
                          key={lead.id}
                          className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">{lead.name}</span>
                              <a
                                href={`tel:${lead.phone}`}
                                className="text-xs text-indigo-600 hover:underline font-semibold bg-indigo-50 px-2 py-0.5 rounded"
                              >
                                {lead.phone}
                              </a>
                            </div>
                            {lead.note && (
                              <p className="text-xs text-slate-600 mt-1 italic">
                                Note: {lead.note}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 self-start sm:self-center">
                            <button
                              onClick={() => handleUpdateLeadStatus(lead.id, 'followed_up')}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition cursor-pointer"
                            >
                              Followed Up
                            </button>
                            <button
                              onClick={() => handleUpdateLeadStatus(lead.id, 'converted')}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer"
                            >
                              Converted
                            </button>
                            <button
                              onClick={() => handleUpdateLeadStatus(lead.id, 'dropped')}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                            >
                              Drop
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: ATTENDANCE HISTORY */}
              {activeTab === 'history' && (
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider">
                        <th className="py-2 pr-3">Date</th>
                        <th className="py-2 pr-3">Login</th>
                        <th className="py-2 pr-3">Logout</th>
                        <th className="py-2 pr-3">Active Time</th>
                        <th className="py-2">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pastAttendance.map((att) => (
                        <tr key={att.id} className="hover:bg-slate-50/80">
                          <td className="py-2.5 pr-3 font-semibold text-slate-900">
                            {formatDate(att.date)}
                          </td>
                          <td className="py-2.5 pr-3 text-slate-700">
                            {formatTime(att.login_time)}
                            {att.is_late && (
                              <span className="ml-1 text-[10px] text-amber-700 font-bold">
                                (Late)
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 pr-3 text-slate-700">
                            {formatTime(att.logout_time)}
                          </td>
                          <td className="py-2.5 pr-3 text-slate-700 font-medium">
                            {formatActiveSeconds(att.active_seconds)}
                          </td>
                          <td className="py-2.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                att.logout_type === 'manual'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : att.logout_type === 'estimated'
                                  ? 'bg-amber-100 text-amber-800'
                                  : att.logout_type === 'auto'
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {att.logout_type?.toUpperCase() || (att.logout_time ? 'DONE' : 'ACTIVE')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT 1 COLUMN: DAILY WORK NOTE */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  Today's Work Summary
                </h3>
                {noteSavedAlert && (
                  <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1 animate-pulse">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Saved!
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Summarize what you accomplished today. Required before final logout.
              </p>

              <textarea
                value={dailyNote}
                onChange={(e) => setDailyNote(e.target.value)}
                placeholder="Write your day's work summary here (e.g., Completed bookkeeping for 3 clients, followed up 15 leads)..."
                rows={7}
                className="w-full p-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white resize-none transition"
              />
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Auto-saves on logout</span>
              <button
                onClick={handleSaveDailyNote}
                disabled={savingNote}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 active:bg-black text-white text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingNote ? 'Saving...' : 'Save Note'}</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL: ADD INTERESTED LEAD */}
      {isLeadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-emerald-600" />
              Add Interested Lead
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter customer details and schedule a callback reminder.
            </p>

            <form onSubmit={handleSaveLead} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Client / Contact Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={newLead.name}
                  onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  value={newLead.phone}
                  onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Callback Date
                </label>
                <input
                  type="date"
                  value={newLead.callbackDate}
                  onChange={(e) => setNewLead({ ...newLead, callbackDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Discussion Note / Requirement
                </label>
                <textarea
                  rows={3}
                  placeholder="Interested in ITR filing, requested quotation on WhatsApp..."
                  value={newLead.note}
                  onChange={(e) => setNewLead({ ...newLead, note: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLeadModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLead}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {submittingLead ? 'Saving Lead...' : 'Save Lead & Count +1'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LOGOUT CONFIRMATION WITH DAILY WORK NOTE */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in duration-150">
            <div className="flex items-center space-x-3 text-amber-600 mb-2">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Daily Wrap & Logout</h3>
                <p className="text-xs text-slate-500">Record your server logout time</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 my-3">
              Please review or write your daily work note below before clocking out:
            </p>

            <textarea
              rows={4}
              value={dailyNote}
              onChange={(e) => setDailyNote(e.target.value)}
              placeholder="What did you complete today? (e.g. 45 calls made, 3 leads generated, 2 tax returns prepared)..."
              className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 resize-none mb-4"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsLogoutModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Continue Working
              </button>
              <button
                onClick={handleConfirmLogout}
                disabled={loggingOut}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {loggingOut ? 'Clocking Out...' : 'Save Note & Clock Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
