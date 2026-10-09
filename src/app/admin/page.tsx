'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import {
  Users,
  Calendar,
  DollarSign,
  AlertCircle,
  FileSpreadsheet,
  Plus,
  CheckCircle2,
  Clock,
  PhoneCall,
  UserCheck,
  ShieldCheck,
  Edit2,
  Lock,
  Key,
  Copy,
  Check,
  Filter,
  Download,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import {
  formatTime,
  formatDate,
  formatActiveSeconds,
  calculateDurationHours,
  isBillOverdue30Days,
  getDaysOverdue,
  getOfficeDateString,
} from '@/lib/time-utils';

export default function AdminDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'bills' | 'leads' | 'staff'>('overview');

  // Master Data
  const [workers, setWorkers] = useState<any[]>([]);
  const [attendances, setAttendances] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [callStats, setCallStats] = useState<any[]>([]);
  const [workLogs, setWorkLogs] = useState<any[]>([]);
  const [workNotes, setWorkNotes] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedWorkerFilter, setSelectedWorkerFilter] = useState<string>('all');
  const [billFilter, setBillFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all');

  // Modals
  const [isAddBillOpen, setIsAddBillOpen] = useState(false);
  const [newBill, setNewBill] = useState({ clientName: '', billNo: '', amount: '', billDate: '' });
  const [addingBill, setAddingBill] = useState(false);

  const [isAddWorkerOpen, setIsAddWorkerOpen] = useState(false);
  const [newWorker, setNewWorker] = useState({ name: '', username: '', password: '', role: 'worker' });
  const [addingWorker, setAddingWorker] = useState(false);
  const [workerError, setWorkerError] = useState<string | null>(null);

  const [isResetPwdOpen, setIsResetPwdOpen] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<any>(null);
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [resettingPwd, setResettingPwd] = useState(false);

  const [isEditAttOpen, setIsEditAttOpen] = useState(false);
  const [editAttTarget, setEditAttTarget] = useState<any>(null);
  const [editLoginTime, setEditLoginTime] = useState('');
  const [editLogoutTime, setEditLogoutTime] = useState('');
  const [editLogoutType, setEditLogoutType] = useState('manual');
  const [editActiveMinutes, setEditActiveMinutes] = useState(0);
  const [savingAttEdit, setSavingAttEdit] = useState(false);

  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
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

      if (prof?.role !== 'admin') {
        router.push('/worker');
        return;
      }
      setProfile(prof);

      // 1. Fetch Workers
      const workersRes = await fetch('/api/admin/workers');
      if (workersRes.ok) {
        const d = await workersRes.json();
        setWorkers(d.profiles || []);
      }

      // 2. Fetch Bills
      const billsRes = await fetch('/api/admin/bills');
      if (billsRes.ok) {
        const d = await billsRes.json();
        setBills(d.bills || []);
      }

      // 3. Fetch All Attendances with Profiles
      const { data: attList } = await supabase
        .from('attendance')
        .select('*, profiles(name, username)')
        .order('date', { ascending: false });
      setAttendances(attList || []);

      // 4. Fetch All Leads with Profiles
      const { data: leadsList } = await supabase
        .from('leads')
        .select('*, profiles(name, username)')
        .order('created_at', { ascending: false });
      setLeads(leadsList || []);

      // 5. Fetch Call Stats
      const { data: statsList } = await supabase
        .from('call_stats')
        .select('*');
      setCallStats(statsList || []);

      // 6. Fetch Work Logs
      const { data: logsList } = await supabase
        .from('work_log')
        .select('*');
      setWorkLogs(logsList || []);

      // 7. Fetch Work Notes
      const { data: notesList } = await supabase
        .from('work_notes')
        .select('*');
      setWorkNotes(notesList || []);

    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  const [todayDate, setTodayDate] = useState<string>('');

  useEffect(() => {
    const todayStr = getOfficeDateString();
    setTodayDate(todayStr);
    setSelectedDate(todayStr);
    setNewBill((prev) => ({ ...prev, billDate: todayStr }));
    fetchAllData();
  }, [fetchAllData]);

  // Derived Calculations
  const staffWorkers = workers.filter((w) => w.role === 'worker');

  // Today's attendance calculation
  const todayAttendances = attendances.filter((a) => a.date === todayDate);
  const presentWorkerIds = new Set(todayAttendances.map((a) => a.user_id));
  const activeNowCount = todayAttendances.filter((a) => !a.logout_time).length;
  const lateCount = todayAttendances.filter((a) => a.is_late).length;
  const notComeCount = staffWorkers.filter((w) => w.active && !presentWorkerIds.has(w.id)).length;

  // Overdue bills check (> 30 days)
  const overdueBills30Days = bills.filter((b) => isBillOverdue30Days(b.bill_date, b.status));
  const totalOverdueAmount = overdueBills30Days.reduce((acc, b) => acc + Number(b.amount), 0);

  // Today's Telecalling
  const todayCallStats = callStats.filter((c) => c.date === todayDate);
  const todayTotalCalls = todayCallStats.reduce((sum, c) => sum + (c.total_calls || 0), 0);
  const todayInterested = todayCallStats.reduce((sum, c) => sum + (c.interested || 0), 0);

  // Actions
  const handleAddBill = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingBill(true);
    try {
      const res = await fetch('/api/admin/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBill),
      });
      if (res.ok) {
        setIsAddBillOpen(false);
        setNewBill({ clientName: '', billNo: '', amount: '', billDate: getOfficeDateString() });
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAddingBill(false);
    }
  };

  const handleMarkBillPaid = async (billId: string) => {
    try {
      const res = await fetch('/api/admin/bills', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billId, status: 'paid' }),
      });
      if (res.ok) fetchAllData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorkerError(null);
    setAddingWorker(true);
    try {
      const res = await fetch('/api/admin/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWorker),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create worker');
      }
      setIsAddWorkerOpen(false);
      setNewWorker({ name: '', username: '', password: '', role: 'worker' });
      fetchAllData();
    } catch (err: any) {
      setWorkerError(err.message);
    } finally {
      setAddingWorker(false);
    }
  };

  const handleToggleWorkerActive = async (userId: string, currentActive: boolean) => {
    if (!confirm(`Are you sure you want to ${currentActive ? 'deactivate' : 'activate'} this worker?`)) return;
    try {
      await fetch('/api/admin/workers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, active: !currentActive }),
      });
      fetchAllData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser || newPasswordVal.length < 6) return;
    setResettingPwd(true);
    try {
      const res = await fetch('/api/admin/workers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: resetTargetUser.id, newPassword: newPasswordVal }),
      });
      if (res.ok) {
        setIsResetPwdOpen(false);
        setNewPasswordVal('');
        setResetTargetUser(null);
        alert('Password reset successfully!');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setResettingPwd(false);
    }
  };

  const openEditAttendance = (att: any) => {
    setEditAttTarget(att);
    // Format to datetime-local values
    const toInputVal = (iso: string | null) => {
      if (!iso) return '';
      const d = new Date(iso);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    };
    setEditLoginTime(toInputVal(att.login_time));
    setEditLogoutTime(toInputVal(att.logout_time));
    setEditLogoutType(att.logout_type || 'manual');
    setEditActiveMinutes(Math.round((att.active_seconds || 0) / 60));
    setIsEditAttOpen(true);
  };

  const handleSaveAttendanceEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAttTarget) return;
    setSavingAttEdit(true);
    try {
      const res = await fetch('/api/admin/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendanceId: editAttTarget.id,
          loginTime: editLoginTime ? new Date(editLoginTime).toISOString() : undefined,
          logoutTime: editLogoutTime ? new Date(editLogoutTime).toISOString() : null,
          logoutType: editLogoutType,
          activeMinutes: parseInt(String(editActiveMinutes), 10),
        }),
      });
      if (res.ok) {
        setIsEditAttOpen(false);
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingAttEdit(false);
    }
  };

  const copyApiToken = (token: string, id: string) => {
    navigator.clipboard.writeText(token);
    setCopiedTokenId(id);
    setTimeout(() => setCopiedTokenId(null), 2500);
  };

  const handleUpdateLeadStatus = async (leadId: string, status: string) => {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      await supabase.from('leads').update({ status }).eq('id', leadId);
      fetchAllData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar userName={profile?.name || 'Administrator'} role="admin" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 space-y-6">
        {/* CRITICAL 30-DAY OVERDUE BILLS BANNER */}
        {overdueBills30Days.length > 0 && (
          <div className="bg-rose-50 border-2 border-rose-500/80 rounded-2xl p-4 sm:p-5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-rose-950">
                    {overdueBills30Days.length} Pending Bills Older than 30 Days!
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-rose-200 text-rose-900 border border-rose-300">
                    Action Required
                  </span>
                </div>
                <p className="text-xs text-rose-800 mt-0.5 font-medium">
                  Total Outstanding Overdue Amount: <b>₹{totalOverdueAmount.toLocaleString('en-IN')}</b>. Please follow up with clients immediately.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setActiveTab('bills');
                setBillFilter('overdue');
              }}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              <span>View Overdue Invoices</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ADMIN TAB NAVIGATION BAR */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 rounded-2xl shadow-xs overflow-x-auto gap-2">
          <div className="flex items-center space-x-1 sm:space-x-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Live Today</span>
            </button>

            <button
              onClick={() => setActiveTab('attendance')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'attendance'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Staff Attendance</span>
            </button>

            <button
              onClick={() => setActiveTab('bills')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'bills'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Manual Bills</span>
              {overdueBills30Days.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('leads')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'leads'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <PhoneCall className="w-4 h-4" />
              <span>Leads Pipeline ({leads.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('staff')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'staff'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Staff Accounts</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchAllData}
              className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              title="Refresh Data"
            >
              <TrendingUp className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* TAB 1: LIVE TODAY OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 4 LIVE STATUS TILES */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider">Logged In Today</span>
                  <UserCheck className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {todayAttendances.length} / {staffWorkers.length}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Staff clocked in</p>
              </div>

              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider">Late Clock-Ins</span>
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {lateCount}
                </div>
                <p className="text-[11px] text-amber-700 font-medium mt-1">After 10:00 AM IST</p>
              </div>

              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider">Still Working</span>
                  <Clock className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {activeNowCount}
                </div>
                <p className="text-[11px] text-indigo-600 font-medium mt-1">Open session right now</p>
              </div>

              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider">Not Come</span>
                  <XCircle className="w-5 h-5 text-rose-500" />
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {notComeCount}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Active staff without login</p>
              </div>
            </div>

            {/* STAFF LIVE STATUS CARDS */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                Today's Staff Roster & Activity
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {staffWorkers.map((worker) => {
                  const todayAtt = todayAttendances.find((a) => a.user_id === worker.id);
                  const todayStat = todayCallStats.find((c) => c.user_id === worker.id);
                  const todayNote = workNotes.find((n) => n.user_id === worker.id && n.date === todayDate);
                  const isPresent = !!todayAtt;
                  const isStillWorking = isPresent && !todayAtt.logout_time;

                  return (
                    <div
                      key={worker.id}
                      className={`p-4 rounded-xl border transition ${
                        isStillWorking
                          ? 'border-indigo-300 bg-indigo-50/30'
                          : isPresent
                          ? 'border-slate-200 bg-white'
                          : 'border-slate-200 bg-slate-50 opacity-75'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{worker.name}</h4>
                          <span className="text-xs text-slate-500">@{worker.username}</span>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isStillWorking
                              ? 'bg-emerald-100 text-emerald-800 animate-pulse'
                              : isPresent
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isStillWorking ? 'Working Now' : isPresent ? 'Logged Out' : 'Absent / Not In'}
                        </span>
                      </div>

                      {isPresent ? (
                        <div className="space-y-2 text-xs text-slate-700">
                          <div className="flex justify-between border-b border-slate-100 pb-1">
                            <span className="text-slate-500">Login Time:</span>
                            <span className="font-semibold">
                              {formatTime(todayAtt.login_time)}
                              {todayAtt.is_late && (
                                <span className="ml-1 text-[10px] text-amber-700 font-bold bg-amber-100 px-1 rounded">
                                  Late
                                </span>
                              )}
                            </span>
                          </div>

                          <div className="flex justify-between border-b border-slate-100 pb-1">
                            <span className="text-slate-500">Active Duration:</span>
                            <span className="font-semibold text-emerald-700">
                              {formatActiveSeconds(todayAtt.active_seconds)}
                            </span>
                          </div>

                          <div className="flex justify-between border-b border-slate-100 pb-1">
                            <span className="text-slate-500">Calls Handled:</span>
                            <span className="font-semibold">
                              {todayStat?.total_calls || 0} ({todayStat?.interested || 0} interested)
                            </span>
                          </div>

                          {todayNote?.note && (
                            <div className="mt-2 bg-slate-50 p-2 rounded-lg text-[11px] text-slate-600 italic">
                              "{todayNote.note}"
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="py-4 text-center text-xs text-slate-400">
                          No login activity recorded today yet.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DETAILED ATTENDANCE LOG & CSV EXPORT */}
        {activeTab === 'attendance' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-600" />
                  Staff Attendance Log (Per Worker / Day)
                </h3>
                <p className="text-xs text-slate-500">
                  Real-time records, active keyboard/mouse hours, telecalling stats, and logout types.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="/api/admin/export?type=attendance"
                  download
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Export CSV</span>
                </a>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div className="flex items-center gap-1.5">
                <Filter className="w-4 h-4 text-slate-500" />
                <span className="font-semibold text-slate-700">Filter Worker:</span>
              </div>
              <select
                value={selectedWorkerFilter}
                onChange={(e) => setSelectedWorkerFilter(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-xs"
              >
                <option value="all">All Workers</option>
                {staffWorkers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} (@{w.username})
                  </option>
                ))}
              </select>
            </div>

            {/* Attendance Records Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider bg-slate-50/50">
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Worker</th>
                    <th className="py-3 px-3">Login</th>
                    <th className="py-3 px-3">Logout</th>
                    <th className="py-3 px-3">Total Office</th>
                    <th className="py-3 px-3">Active Hours</th>
                    <th className="py-3 px-3">Calls / Leads</th>
                    <th className="py-3 px-3">Logout Type</th>
                    <th className="py-3 px-3">Daily Note</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendances
                    .filter((a) => selectedWorkerFilter === 'all' || a.user_id === selectedWorkerFilter)
                    .map((att) => {
                      const workerObj = workers.find((w) => w.id === att.user_id);
                      const statObj = callStats.find((c) => c.user_id === att.user_id && c.date === att.date);
                      const noteObj = workNotes.find((n) => n.user_id === att.user_id && n.date === att.date);
                      const duration = calculateDurationHours(att.login_time, att.logout_time, att.last_active);

                      return (
                        <tr key={att.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                            {formatDate(att.date)}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="font-semibold text-slate-900">{workerObj?.name || 'Worker'}</span>
                            <span className="text-[11px] text-slate-400 block">@{workerObj?.username}</span>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="font-medium text-slate-800">{formatTime(att.login_time)}</span>
                            {att.is_late && (
                              <span className="ml-1.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                Late
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            {formatTime(att.logout_time)}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap">
                            {duration.formatted}
                          </td>
                          <td className="py-3 px-3 font-bold text-emerald-700 whitespace-nowrap">
                            {formatActiveSeconds(att.active_seconds)}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="font-semibold text-slate-900">{statObj?.total_calls || 0}</span> calls
                            <span className="text-emerald-600 font-bold ml-1">({statObj?.interested || 0} lead)</span>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                att.logout_type === 'manual'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : att.logout_type === 'estimated'
                                  ? 'bg-orange-100 text-orange-800 border border-orange-300'
                                  : att.logout_type === 'auto'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              }`}
                            >
                              {att.logout_type?.toUpperCase() || (att.logout_time ? 'DONE' : 'IN PROGRESS')}
                            </span>
                          </td>
                          <td className="py-3 px-3 max-w-xs truncate text-slate-600 text-[11px]" title={noteObj?.note || ''}>
                            {noteObj?.note || '-'}
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <button
                              onClick={() => openEditAttendance(att)}
                              className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition cursor-pointer"
                            >
                              Edit Times
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: MANUAL BILLS & 30-DAY OVERDUE ALERTS */}
        {activeTab === 'bills' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-indigo-600" />
                  Manual Office Bills & Invoices
                </h3>
                <p className="text-xs text-slate-500">
                  Track client billings. Unpaid bills 30+ days old automatically flag in bright RED.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="/api/admin/export?type=bills"
                  download
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </a>
                <button
                  onClick={() => setIsAddBillOpen(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Bill</span>
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto text-xs">
              <button
                onClick={() => setBillFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  billFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({bills.length})
              </button>
              <button
                onClick={() => setBillFilter('pending')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  billFilter === 'pending' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Pending ({bills.filter((b) => b.status === 'pending').length})
              </button>
              <button
                onClick={() => setBillFilter('paid')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  billFilter === 'paid' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Paid ({bills.filter((b) => b.status === 'paid').length})
              </button>
              <button
                onClick={() => setBillFilter('overdue')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1 cursor-pointer ${
                  billFilter === 'overdue' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>30+ Days Overdue ({overdueBills30Days.length})</span>
              </button>
            </div>

            {/* Bills Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider bg-slate-50/50">
                    <th className="py-3 px-3">Bill #</th>
                    <th className="py-3 px-3">Client Name</th>
                    <th className="py-3 px-3">Amount</th>
                    <th className="py-3 px-3">Bill Date</th>
                    <th className="py-3 px-3">Age / Status</th>
                    <th className="py-3 px-3">Paid Date</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bills
                    .filter((b) => {
                      if (billFilter === 'pending') return b.status === 'pending';
                      if (billFilter === 'paid') return b.status === 'paid';
                      if (billFilter === 'overdue') return isBillOverdue30Days(b.bill_date, b.status);
                      return true;
                    })
                    .map((bill) => {
                      const isOverdue = isBillOverdue30Days(bill.bill_date, bill.status);
                      const days = getDaysOverdue(bill.bill_date);

                      return (
                        <tr
                          key={bill.id}
                          className={`transition ${
                            isOverdue
                              ? 'bg-rose-50/70 hover:bg-rose-50 font-medium'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                            {bill.bill_no}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap">
                            {bill.client_name}
                          </td>
                          <td className="py-3 px-3 font-black text-slate-900 whitespace-nowrap">
                            ₹{Number(bill.amount).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap text-slate-600">
                            {formatDate(bill.bill_date)}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            {bill.status === 'paid' ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                PAID
                              </span>
                            ) : isOverdue ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-600 text-white shadow-xs animate-pulse">
                                OVERDUE ({days} days)
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                                Pending ({days}d)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap text-slate-500">
                            {bill.paid_date ? formatDate(bill.paid_date) : '-'}
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            {bill.status === 'pending' ? (
                              <button
                                onClick={() => handleMarkBillPaid(bill.id)}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-xs transition cursor-pointer"
                              >
                                Mark Paid
                              </button>
                            ) : (
                              <span className="text-emerald-700 font-semibold flex items-center justify-end gap-1">
                                <CheckCircle className="w-4 h-4" /> Settled
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: LEADS & TELECALLING PIPELINE */}
        {activeTab === 'leads' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-emerald-600" />
                  Interested Leads & Calling Pipeline
                </h3>
                <p className="text-xs text-slate-500">
                  All interested prospects generated by staff telecalling with callback schedules and conversion status.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider bg-slate-50/50">
                    <th className="py-3 px-3">Date Added</th>
                    <th className="py-3 px-3">Generated By</th>
                    <th className="py-3 px-3">Client Name</th>
                    <th className="py-3 px-3">Phone</th>
                    <th className="py-3 px-3">Callback Due</th>
                    <th className="py-3 px-3">Requirement / Note</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Update Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.map((lead) => {
                    const creator = workers.find((w) => w.id === lead.user_id);

                    return (
                      <tr key={lead.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3 whitespace-nowrap text-slate-500">
                          {formatDate(lead.created_at)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="font-semibold text-slate-800">{creator?.name || 'Staff'}</span>
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                          {lead.name}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <a href={`tel:${lead.phone}`} className="text-indigo-600 font-semibold hover:underline">
                            {lead.phone}
                          </a>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap font-medium text-slate-700">
                          {lead.callback_date ? formatDate(lead.callback_date) : '-'}
                        </td>
                        <td className="py-3 px-3 max-w-xs text-slate-700 text-[11px]">
                          {lead.note || '-'}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              lead.status === 'converted'
                                ? 'bg-emerald-100 text-emerald-800'
                                : lead.status === 'followed_up'
                                ? 'bg-blue-100 text-blue-800'
                                : lead.status === 'dropped'
                                ? 'bg-slate-200 text-slate-700'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {lead.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleUpdateLeadStatus(lead.id, 'followed_up')}
                              className="px-2 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded border border-blue-200 cursor-pointer"
                            >
                              Followed Up
                            </button>
                            <button
                              onClick={() => handleUpdateLeadStatus(lead.id, 'converted')}
                              className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded border border-emerald-200 cursor-pointer"
                            >
                              Converted
                            </button>
                            <button
                              onClick={() => handleUpdateLeadStatus(lead.id, 'dropped')}
                              className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 rounded cursor-pointer"
                            >
                              Drop
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: STAFF MANAGEMENT & TRACKER TOKENS */}
        {activeTab === 'staff' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  Staff Accounts & Tracker API Tokens
                </h3>
                <p className="text-xs text-slate-500">
                  Create staff login credentials and retrieve API tokens for the background Windows Python tracker.
                </p>
              </div>

              <button
                onClick={() => setIsAddWorkerOpen(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Worker Account</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider bg-slate-50/50">
                    <th className="py-3 px-3">Name</th>
                    <th className="py-3 px-3">Username (Login)</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Windows Tracker API Token</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {workers.map((worker) => (
                    <tr key={worker.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                        {worker.name}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">
                        {worker.username}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            worker.role === 'admin'
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {worker.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            worker.active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {worker.active ? 'ACTIVE' : 'DEACTIVATED'}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] bg-slate-100 px-2 py-1 rounded text-slate-700 border border-slate-200">
                            {worker.api_token ? `${worker.api_token.slice(0, 12)}...` : 'N/A'}
                          </span>
                          {worker.api_token && (
                            <button
                              onClick={() => copyApiToken(worker.api_token, worker.id)}
                              className="p-1 hover:bg-slate-200 rounded transition cursor-pointer text-slate-600"
                              title="Copy API Token for tracker_config.json"
                            >
                              {copiedTokenId === worker.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setResetTargetUser(worker);
                              setIsResetPwdOpen(true);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                          >
                            Reset Password
                          </button>
                          {worker.role !== 'admin' && (
                            <button
                              onClick={() => handleToggleWorkerActive(worker.id, worker.active)}
                              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                                worker.active
                                  ? 'text-rose-700 hover:bg-rose-50 border border-rose-200'
                                  : 'text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
                              }`}
                            >
                              {worker.active ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: ADD BILL */}
      {isAddBillOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-600" />
              Add Office Invoice / Bill
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter bill details. Pending bills older than 30 days trigger automatic alerts.
            </p>

            <form onSubmit={handleAddBill} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Client / Company Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Logistics Pvt Ltd"
                  value={newBill.clientName}
                  onChange={(e) => setNewBill({ ...newBill, clientName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Bill / Invoice # *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="INV-2026-001"
                    value={newBill.billNo}
                    onChange={(e) => setNewBill({ ...newBill, billNo: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="15000"
                    value={newBill.amount}
                    onChange={(e) => setNewBill({ ...newBill, amount: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Bill Date *
                </label>
                <input
                  type="date"
                  required
                  value={newBill.billDate}
                  onChange={(e) => setNewBill({ ...newBill, billDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddBillOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingBill}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {addingBill ? 'Creating...' : 'Create Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD WORKER */}
      {isAddWorkerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              Add New Staff Account
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Create a worker profile with simple username and password for office sign in.
            </p>

            {workerError && (
              <div className="mb-4 p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                {workerError}
              </div>
            )}

            <form onSubmit={handleAddWorker} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Priya Sharma"
                  value={newWorker.name}
                  onChange={(e) => setNewWorker({ ...newWorker, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Username (Login handle) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. priya"
                  value={newWorker.username}
                  onChange={(e) => setNewWorker({ ...newWorker, username: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Temporary Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Min 6 characters"
                  value={newWorker.password}
                  onChange={(e) => setNewWorker({ ...newWorker, password: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddWorkerOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingWorker}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {addingWorker ? 'Creating User...' : 'Create Worker'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET PASSWORD */}
      {isResetPwdOpen && resetTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-600" />
              Reset Password
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter a new password for <b>{resetTargetUser.name}</b> (@{resetTargetUser.username}).
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  New Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Min 6 characters"
                  value={newPasswordVal}
                  onChange={(e) => setNewPasswordVal(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsResetPwdOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resettingPwd || newPasswordVal.length < 6}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {resettingPwd ? 'Resetting...' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT ATTENDANCE TIMES */}
      {isEditAttOpen && editAttTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-indigo-600" />
              Manual Attendance Correction
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Adjust login/logout timestamps and active duration for <b>{editAttTarget.profiles?.name}</b> on {formatDate(editAttTarget.date)}.
            </p>

            <form onSubmit={handleSaveAttendanceEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Login Time
                </label>
                <input
                  type="datetime-local"
                  value={editLoginTime}
                  onChange={(e) => setEditLoginTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Logout Time (Leave empty if ongoing)
                </label>
                <input
                  type="datetime-local"
                  value={editLogoutTime}
                  onChange={(e) => setEditLogoutTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Logout Type
                  </label>
                  <select
                    value={editLogoutType}
                    onChange={(e) => setEditLogoutType(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="manual">Manual (Normal)</option>
                    <option value="estimated">Estimated</option>
                    <option value="auto">Auto (7:00 PM)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Active Time (Minutes)
                  </label>
                  <input
                    type="number"
                    value={editActiveMinutes}
                    onChange={(e) => setEditActiveMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditAttOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAttEdit}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {savingAttEdit ? 'Saving...' : 'Save Correction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
