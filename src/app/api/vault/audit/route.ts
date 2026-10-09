import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { vaultDb } from '@/lib/vault-db';
import { vaultDb as auditDb } from '@/lib/vault-db';

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
};

// POST /api/vault/audit/copy — log a copy action
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles').select('id').eq('id', user.id).single();
    if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { entry_id } = await request.json();

    await vaultDb.from('vault_audit').insert({
      user_id: profile.id,
      entry_id: entry_id || null,
      action: 'copy',
      ip: request.headers.get('x-forwarded-for') || null,
    });

    return NextResponse.json({ success: true }, { headers: NO_CACHE });
  } catch {
    return NextResponse.json({ error: 'Failed to log copy' }, { status: 500 });
  }
}

// GET /api/vault/audit — admin only, fetch audit log with filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles').select('id,role').eq('id', user.id).single();
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const url = new URL(request.url);
    const filterUser = url.searchParams.get('user_id');
    const filterEntry = url.searchParams.get('entry_id');
    const filterFrom = url.searchParams.get('from');
    const filterTo = url.searchParams.get('to');

    let query = auditDb
      .from('vault_audit')
      .select(`
        id, action, ip, created_at,
        user_id, entry_id
      `)
      .order('created_at', { ascending: false })
      .limit(200);

    if (filterUser) query = query.eq('user_id', filterUser);
    if (filterEntry) query = query.eq('entry_id', filterEntry);
    if (filterFrom) query = query.gte('created_at', filterFrom);
    if (filterTo) query = query.lte('created_at', filterTo + 'T23:59:59Z');

    const { data: logs, error } = await query;
    if (error) return NextResponse.json({ error: 'Failed to fetch audit log' }, { status: 500 });

    // Enrich with profile names and entry names
    const profileIds = [...new Set(logs?.map(l => l.user_id).filter(Boolean))];
    const entryIds = [...new Set(logs?.map(l => l.entry_id).filter(Boolean))];

    const [profilesRes, entriesRes] = await Promise.all([
      profileIds.length
        ? supabase.from('profiles').select('id,name,username').in('id', profileIds)
        : Promise.resolve({ data: [] }),
      entryIds.length
        ? auditDb.from('vault_entries').select('id,customer_name,portal_name').in('id', entryIds)
        : Promise.resolve({ data: [] }),
    ]);

    const profileMap = Object.fromEntries((profilesRes.data || []).map(p => [p.id, p]));
    const entryMap = Object.fromEntries((entriesRes.data || []).map(e => [e.id, e]));

    const enriched = (logs || []).map(log => ({
      ...log,
      user: profileMap[log.user_id] || null,
      entry: entryMap[log.entry_id] || null,
    }));

    return NextResponse.json({ logs: enriched }, { headers: NO_CACHE });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
