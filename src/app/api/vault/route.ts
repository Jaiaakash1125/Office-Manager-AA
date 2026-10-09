import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { vaultDb } from '@/lib/vault-db';
import { encryptPassword } from '@/lib/vault-crypto';

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
};

// GET /api/vault — list all entries (NO passwords returned)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles').select('id,role,username').eq('id', user.id).single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 });

    const { data: entries, error } = await vaultDb
      .from('vault_entries')
      .select(`
        id, customer_name, portal_name, portal_url, username,
        notes, created_by, updated_by, created_at, updated_at
      `)
      .order('customer_name', { ascending: true });

    if (error) return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });

    // Log view action
    await vaultDb.from('vault_audit').insert({
      user_id: profile.id,
      entry_id: null,
      action: 'view',
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
    });

    return NextResponse.json({ entries }, { headers: NO_CACHE });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/vault — create new entry
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles').select('id,role').eq('id', user.id).single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 });

    const body = await request.json();
    const { customer_name, portal_name, portal_url, username, password, notes } = body;

    if (!customer_name || !portal_name || !username || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const encrypted = encryptPassword(password);

    const { data: entry, error } = await vaultDb
      .from('vault_entries')
      .insert({
        customer_name: customer_name.trim(),
        portal_name: portal_name.trim(),
        portal_url: portal_url?.trim() || null,
        username: username.trim(),
        password_encrypted: encrypted.password_encrypted,
        iv: encrypted.iv,
        auth_tag: encrypted.auth_tag,
        notes: notes?.trim() || null,
        created_by: profile.id,
        updated_by: profile.id,
      })
      .select('id, customer_name, portal_name, portal_url, username, notes, created_at')
      .single();

    if (error) return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 });

    await vaultDb.from('vault_audit').insert({
      user_id: profile.id,
      entry_id: entry.id,
      action: 'create',
      ip: request.headers.get('x-forwarded-for') || null,
    });

    return NextResponse.json({ entry }, { status: 201, headers: NO_CACHE });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
