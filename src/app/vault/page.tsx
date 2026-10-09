'use client';

import React, {
  useState, useEffect, useCallback, useRef
} from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import {
  KeyRound, Plus, Search, Eye, EyeOff, Copy, Check, Pencil,
  Trash2, ShieldAlert, Globe, User, Lock, FileText, ExternalLink,
  AlertCircle, X, ClockAlert, History, Filter, RefreshCw,
  ChevronDown, Building,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface VaultEntry {
  id: string;
  customer_name: string;
  portal_name: string;
  portal_url?: string;
  username: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface AuditLog {
  id: string;
  action: string;
  ip?: string;
  created_at: string;
  user?: { name: string; username: string };
  entry?: { customer_name: string; portal_name: string };
}

const IDLE_MS = 5 * 60 * 1000; // 5 minutes
const REVEAL_TTL = 15 * 1000;   // 15 seconds

// ─── Helpers ─────────────────────────────────────────────────────────────────
function actionBadge(action: string) {
  const map: Record<string, string> = {
    view:   'bg-blue-100 text-blue-700',
    copy:   'bg-violet-100 text-violet-700',
    create: 'bg-emerald-100 text-emerald-700',
    edit:   'bg-amber-100 text-amber-700',
    delete: 'bg-rose-100 text-rose-700',
  };
  return map[action] || 'bg-slate-100 text-slate-700';
}

function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition z-10">
          <X className="w-5 h-5" />
        </button>
        {children}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function VaultPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'vault' | 'audit'>('vault');

  // Search & filter
  const [search, setSearch] = useState('');
  const [auditFilterUser, setAuditFilterUser] = useState('');
  const [auditFilterFrom, setAuditFilterFrom] = useState('');
  const [auditFilterTo, setAuditFilterTo] = useState('');

  // Revealed passwords map: entryId -> { password, expiresAt }
  const [revealed, setRevealed] = useState<Record<string, { password: string; expiresAt: number }>>({});
  const [copied, setCopied] = useState<string | null>(null);

  // Modals
  const [addOpen, setAddOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<VaultEntry | null>(null);
  const [revealEntry, setRevealEntry] = useState<VaultEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<VaultEntry | null>(null);
  const [revealPwd, setRevealPwd] = useState('');
  const [revealLoading, setRevealLoading] = useState(false);
  const [revealError, setRevealError] = useState('');

  // Form state
  const emptyForm = { customer_name: '', portal_name: '', portal_url: '', username: '', password: '', notes: '' };
  const [form, setForm] = useState(emptyForm);
  const [formPwdVisible, setFormPwdVisible] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Locked state
  const [locked, setLocked] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ─── Auth & init ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (!prof) { router.push('/login'); return; }
      setProfile(prof);
      // Fetch all profiles for audit filter (admin only)
      if (prof.role === 'admin') {
        const { data: profs } = await supabase.from('profiles').select('id,name,username');
        setAllProfiles(profs || []);
      }
    })();
  }, [router]);

  // ─── Idle auto-lock ─────────────────────────────────────────────────────────
  const resetIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      setLocked(true);
      setRevealed({});
    }, IDLE_MS);
  }, []);

  useEffect(() => {
    resetIdle();
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetIdle));
    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdle));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [resetIdle]);

  // ─── Reveal auto-hide ────────────────────────────────────────────────────────
  const scheduleRevealHide = useCallback((entryId: string) => {
    if (revealTimers.current[entryId]) clearTimeout(revealTimers.current[entryId]);
    revealTimers.current[entryId] = setTimeout(() => {
      setRevealed(prev => { const n = { ...prev }; delete n[entryId]; return n; });
    }, REVEAL_TTL);
  }, []);

  // ─── Data fetching ──────────────────────────────────────────────────────────
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/vault');
      if (res.ok) { const d = await res.json(); setEntries(d.entries || []); }
    } finally { setLoading(false); }
  }, []);

  const fetchAudit = useCallback(async () => {
    const params = new URLSearchParams();
    if (auditFilterUser) params.set('user_id', auditFilterUser);
    if (auditFilterFrom) params.set('from', auditFilterFrom);
    if (auditFilterTo) params.set('to', auditFilterTo);
    const res = await fetch(`/api/vault/audit?${params}`);
    if (res.ok) { const d = await res.json(); setAuditLogs(d.logs || []); }
  }, [auditFilterUser, auditFilterFrom, auditFilterTo]);

  useEffect(() => { if (profile) fetchEntries(); }, [profile, fetchEntries]);
  useEffect(() => { if (profile?.role === 'admin' && tab === 'audit') fetchAudit(); }, [profile, tab, fetchAudit]);

  // ─── Filtered entries ────────────────────────────────────────────────────────
  const filtered = entries.filter(e => {
    const q = search.toLowerCase();
    return !q || e.customer_name.toLowerCase().includes(q) ||
      e.portal_name.toLowerCase().includes(q) ||
      e.username.toLowerCase().includes(q);
  });

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handleReveal = async () => {
    if (!revealEntry || !revealPwd) return;
    setRevealLoading(true);
    setRevealError('');
    try {
      const res = await fetch('/api/vault/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id: revealEntry.id, current_password: revealPwd }),
      });
      const data = await res.json();
      if (!res.ok) { setRevealError(data.error || 'Failed to reveal'); return; }
      setRevealed(prev => ({ ...prev, [revealEntry.id]: { password: data.password, expiresAt: Date.now() + REVEAL_TTL } }));
      scheduleRevealHide(revealEntry.id);
      setRevealEntry(null);
      setRevealPwd('');
    } catch { setRevealError('Network error'); }
    finally { setRevealLoading(false); }
  };

  const handleCopy = async (entryId: string, password: string) => {
    await navigator.clipboard.writeText(password);
    setCopied(entryId);
    setTimeout(() => setCopied(null), 2000);
    await fetch('/api/vault/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry_id: entryId }),
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);
    try {
      const isEdit = !!editEntry;
      const url = isEdit ? `/api/vault/${editEntry!.id}` : '/api/vault';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || 'Failed'); return; }
      setAddOpen(false);
      setEditEntry(null);
      setForm(emptyForm);
      fetchEntries();
    } catch { setFormError('Network error'); }
    finally { setFormLoading(false); }
  };

  const handleDelete = async () => {
    if (!deleteEntry) return;
    const res = await fetch(`/api/vault/${deleteEntry.id}`, { method: 'DELETE' });
    if (res.ok) { setDeleteEntry(null); fetchEntries(); }
  };

  const openEdit = (entry: VaultEntry) => {
    setForm({
      customer_name: entry.customer_name,
      portal_name: entry.portal_name,
      portal_url: entry.portal_url || '',
      username: entry.username,
      password: '',
      notes: entry.notes || '',
    });
    setEditEntry(entry);
  };

  // ─── Lock screen ──────────────────────────────────────────────────────────
  if (locked) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-700">
            <Lock className="w-10 h-10 text-slate-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Vault Locked</h2>
          <p className="text-slate-400 text-sm mb-6">Locked due to 5 minutes of inactivity</p>
          <button
            onClick={() => { setLocked(false); resetIdle(); }}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm transition"
          >
            Unlock Vault
          </button>
        </div>
      </div>
    );
  }

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (!profile || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center animate-pulse">
            <KeyRound className="w-6 h-6 text-white" />
          </div>
          <p className="text-slate-500 text-sm">Loading Vault...</p>
        </div>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <Navbar userName={profile.name} role={profile.role} />

      {/* CSP + no-cache meta */}
      <meta httpEquiv="Cache-Control" content="no-store, no-cache, must-revalidate" />
      <meta httpEquiv="Pragma" content="no-cache" />

      <div className="min-h-screen bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* ── Header ── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                <KeyRound className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900">Password Vault</h1>
                <p className="text-sm text-slate-500">Encrypted customer portal credentials</p>
              </div>
            </div>
            <button
              onClick={() => { setForm(emptyForm); setAddOpen(true); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-indigo-200 transition"
            >
              <Plus className="w-4 h-4" /> Add Entry
            </button>
          </div>

          {/* ── Tabs (admin only gets audit tab) ── */}
          {profile.role === 'admin' && (
            <div className="flex gap-1 p-1 bg-slate-200 rounded-xl w-fit mb-6">
              {(['vault', 'audit'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition ${
                    tab === t ? 'bg-white text-slate-900 shadow' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t === 'vault' ? '🔐 Vault' : '📋 Audit Log'}
                </button>
              ))}
            </div>
          )}

          {/* ═══════════════ VAULT TAB ═══════════════ */}
          {tab === 'vault' && (
            <>
              {/* Search */}
              <div className="relative mb-6">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by customer, portal or username..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-sm"
                />
              </div>

              {/* Entry Cards */}
              {filtered.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                  <KeyRound className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No entries found</p>
                  <p className="text-sm">Add your first entry using the button above</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filtered.map(entry => {
                    const rev = revealed[entry.id];
                    const isRevealed = !!rev && Date.now() < rev.expiresAt;
                    const isCopied = copied === entry.id;
                    return (
                      <div key={entry.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition overflow-hidden">
                        {/* Card Header */}
                        <div className="px-5 pt-5 pb-4">
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Building className="w-4 h-4 text-indigo-500 shrink-0" />
                                <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider truncate">
                                  {entry.customer_name}
                                </span>
                              </div>
                              <h3 className="text-base font-bold text-slate-900 truncate">{entry.portal_name}</h3>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => openEdit(entry)}
                                title="Edit"
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              {profile.role === 'admin' && (
                                <button
                                  onClick={() => setDeleteEntry(entry)}
                                  title="Delete"
                                  className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Username */}
                          <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-mono text-xs bg-slate-50 px-2 py-0.5 rounded border border-slate-100 truncate">{entry.username}</span>
                          </div>

                          {/* Portal URL */}
                          {entry.portal_url && (
                            <a
                              href={entry.portal_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 truncate mb-2 transition"
                            >
                              <Globe className="w-3 h-3 shrink-0" />
                              <span className="truncate">{entry.portal_url}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          )}

                          {/* Notes */}
                          {entry.notes && (
                            <p className="text-xs text-slate-500 italic border-t border-slate-100 pt-2 mt-2 line-clamp-2">{entry.notes}</p>
                          )}
                        </div>

                        {/* Password Row */}
                        <div className="px-5 pb-5">
                          <div className="flex items-center gap-2 bg-slate-900 rounded-xl px-3 py-2.5">
                            <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className={`flex-1 font-mono text-sm min-w-0 truncate ${isRevealed ? 'text-emerald-400' : 'text-slate-500'}`}>
                              {isRevealed ? rev.password : '••••••••••••'}
                            </span>
                            {isRevealed ? (
                              <button
                                onClick={() => handleCopy(entry.id, rev.password)}
                                title="Copy password"
                                className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-emerald-400 transition shrink-0"
                              >
                                {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                              </button>
                            ) : (
                              <button
                                onClick={() => { setRevealEntry(entry); setRevealError(''); setRevealPwd(''); }}
                                title="Reveal password"
                                className="flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-200 transition shrink-0 whitespace-nowrap"
                              >
                                <Eye className="w-3.5 h-3.5" /> Reveal
                              </button>
                            )}
                          </div>
                          {isRevealed && (
                            <p className="text-xs text-amber-500 flex items-center gap-1 mt-1.5">
                              <ClockAlert className="w-3 h-3" />
                              Hides in 15 seconds
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ═══════════════ AUDIT LOG TAB (admin) ═══════════════ */}
          {tab === 'audit' && profile.role === 'admin' && (
            <>
              {/* Filters */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 shadow-sm">
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">User</label>
                    <select
                      value={auditFilterUser}
                      onChange={e => setAuditFilterUser(e.target.value)}
                      className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      <option value="">All users</option>
                      {allProfiles.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.username})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">From</label>
                    <input type="date" value={auditFilterFrom} onChange={e => setAuditFilterFrom(e.target.value)}
                      className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">To</label>
                    <input type="date" value={auditFilterTo} onChange={e => setAuditFilterTo(e.target.value)}
                      className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  </div>
                  <button onClick={fetchAudit}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition">
                    <RefreshCw className="w-3.5 h-3.5" /> Apply
                  </button>
                  <button onClick={() => { setAuditFilterUser(''); setAuditFilterFrom(''); setAuditFilterTo(''); }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition">
                    Clear
                  </button>
                </div>
              </div>

              {/* Audit Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Time</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Entry</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">IP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {auditLogs.length === 0 ? (
                        <tr><td colSpan={5} className="text-center py-12 text-slate-400">No audit logs found</td></tr>
                      ) : auditLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                            {new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                          </td>
                          <td className="px-4 py-3">
                            {log.user ? (
                              <span className="font-medium text-slate-800">{log.user.name} <span className="text-slate-400 font-normal">(@{log.user.username})</span></span>
                            ) : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${actionBadge(log.action)}`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-xs">
                            {log.entry ? `${log.entry.customer_name} — ${log.entry.portal_name}` : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-400 font-mono text-xs">{log.ip || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══ ADD / EDIT MODAL ═══ */}
      <Modal open={addOpen || !!editEntry} onClose={() => { setAddOpen(false); setEditEntry(null); setFormError(''); }}>
        <div className="px-6 pt-6 pb-1">
          <h2 className="text-lg font-bold text-slate-900 mb-1">
            {editEntry ? 'Edit Entry' : 'New Vault Entry'}
          </h2>
          <p className="text-sm text-slate-500 mb-5">
            {editEntry ? 'Leave password blank to keep existing.' : 'Password is encrypted with AES-256-GCM before saving.'}
          </p>
        </div>
        <form onSubmit={handleFormSubmit} className="px-6 pb-6 space-y-4">
          {formError && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 flex items-center gap-2 text-rose-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Customer Name *</label>
              <input required value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="Acme Corp" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Portal Name *</label>
              <input required value={form.portal_name} onChange={e => setForm(f => ({ ...f, portal_name: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="GST Portal" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Portal URL</label>
            <input type="url" value={form.portal_url} onChange={e => setForm(f => ({ ...f, portal_url: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="https://gst.gov.in" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Username *</label>
              <input required={!editEntry} value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="user@example.com" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Password {editEntry ? '(leave blank to keep)' : '*'}
              </label>
              <div className="relative">
                <input
                  required={!editEntry}
                  type={formPwdVisible ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder={editEntry ? '(unchanged)' : '••••••••'}
                />
                <button type="button" tabIndex={-1} onClick={() => setFormPwdVisible(v => !v)}
                  className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-700 transition">
                  {formPwdVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" placeholder="Any additional info..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={formLoading}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition">
              {formLoading ? 'Saving...' : editEntry ? 'Save Changes' : 'Add Entry'}
            </button>
            <button type="button" onClick={() => { setAddOpen(false); setEditEntry(null); setFormError(''); }}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition">
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* ═══ REVEAL MODAL ═══ */}
      <Modal open={!!revealEntry} onClose={() => { setRevealEntry(null); setRevealPwd(''); setRevealError(''); }}>
        <div className="px-6 pt-6 pb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Verify Identity</h2>
              <p className="text-xs text-slate-500">Enter your login password to reveal</p>
            </div>
          </div>
          {revealEntry && (
            <div className="bg-slate-50 rounded-xl px-4 py-3 mb-4 border border-slate-200 text-sm">
              <span className="font-semibold text-slate-700">{revealEntry.customer_name}</span>
              <span className="text-slate-400"> — </span>
              <span className="text-slate-600">{revealEntry.portal_name}</span>
            </div>
          )}
          {revealError && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 flex items-center gap-2 text-rose-700 text-sm mb-4">
              <AlertCircle className="w-4 h-4 shrink-0" /> {revealError}
            </div>
          )}
          <div className="relative mb-4">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="password"
              autoFocus
              placeholder="Your login password"
              value={revealPwd}
              onChange={e => setRevealPwd(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleReveal()}
              className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <button onClick={handleReveal} disabled={revealLoading || !revealPwd}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2">
            {revealLoading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Verifying...</> : <><Eye className="w-4 h-4" /> Reveal Password</>}
          </button>
          <p className="text-xs text-slate-400 text-center mt-3">Password will be hidden after 15 seconds. Max 10 reveals per minute.</p>
        </div>
      </Modal>

      {/* ═══ DELETE CONFIRM MODAL ═══ */}
      <Modal open={!!deleteEntry} onClose={() => setDeleteEntry(null)}>
        <div className="px-6 pt-6 pb-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-rose-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Delete Entry?</h2>
          <p className="text-sm text-slate-500 mb-1">This will permanently delete:</p>
          <p className="text-sm font-semibold text-slate-800 mb-5">
            {deleteEntry?.customer_name} — {deleteEntry?.portal_name}
          </p>
          <div className="flex gap-3">
            <button onClick={handleDelete}
              className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-semibold text-sm transition">
              Yes, Delete
            </button>
            <button onClick={() => setDeleteEntry(null)}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition">
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
