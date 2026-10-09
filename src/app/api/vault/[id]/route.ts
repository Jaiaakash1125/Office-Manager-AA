import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { vaultDb } from '@/lib/vault-db';
import { encryptPassword } from '@/lib/vault-crypto';

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
};

// PUT /api/vault/[id] — edit entry (saves old password to history first)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles').select('id,role').eq('id', user.id).single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 });

    const body = await request.json();
    const { customer_name, portal_name, portal_url, username, password, notes } = body;

    // Fetch existing entry
    const { data: existing, error: fetchErr } = await vaultDb
      .from('vault_entries')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    // If password is being changed, save old encrypted password to history
    let newEncrypted = {
      password_encrypted: existing.password_encrypted,
      iv: existing.iv,
      auth_tag: existing.auth_tag,
    };

    if (password && password.trim().length > 0) {
      // Save old password to history
      await vaultDb.from('vault_history').insert({
        entry_id: id,
        password_encrypted: existing.password_encrypted,
        iv: existing.iv,
        auth_tag: existing.auth_tag,
        changed_by: profile.id,
      });
      // Encrypt new password
      newEncrypted = encryptPassword(password);
    }

    const { data: updated, error: updateErr } = await vaultDb
      .from('vault_entries')
      .update({
        customer_name: customer_name?.trim() || existing.customer_name,
        portal_name: portal_name?.trim() || existing.portal_name,
        portal_url: portal_url?.trim() || existing.portal_url,
        username: username?.trim() || existing.username,
        password_encrypted: newEncrypted.password_encrypted,
        iv: newEncrypted.iv,
        auth_tag: newEncrypted.auth_tag,
        notes: notes !== undefined ? notes?.trim() || null : existing.notes,
        updated_by: profile.id,
      })
      .eq('id', id)
      .select('id, customer_name, portal_name, portal_url, username, notes, updated_at')
      .single();

    if (updateErr) return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 });

    await vaultDb.from('vault_audit').insert({
      user_id: profile.id,
      entry_id: id,
      action: 'edit',
      ip: request.headers.get('x-forwarded-for') || null,
    });

    return NextResponse.json({ entry: updated }, { headers: NO_CACHE });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/vault/[id] — admin only
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles').select('id,role').eq('id', user.id).single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 });
    if (profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    await vaultDb.from('vault_audit').insert({
      user_id: profile.id,
      entry_id: id,
      action: 'delete',
      ip: request.headers.get('x-forwarded-for') || null,
    });

    const { error } = await vaultDb.from('vault_entries').delete().eq('id', id);
    if (error) return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500 });

    return NextResponse.json({ success: true }, { headers: NO_CACHE });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
