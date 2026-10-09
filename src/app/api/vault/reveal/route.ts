import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { vaultDb } from '@/lib/vault-db';
import { decryptPassword, verifyUserPassword, checkRevealRateLimit } from '@/lib/vault-crypto';

// POST /api/vault/reveal
// Body: { entry_id: string, current_password: string }
// Requires user to re-enter their login password to reveal vault password
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles').select('id,role,username').eq('id', user.id).single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 });

    // Rate limit: 10 reveals per minute per user
    if (!checkRevealRateLimit(profile.id)) {
      return NextResponse.json(
        { error: 'Too many reveal requests. Please wait a minute.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { entry_id, current_password } = body;

    if (!entry_id || !current_password) {
      return NextResponse.json({ error: 'entry_id and current_password are required' }, { status: 400 });
    }

    // Verify the user's current login password
    const email = `${profile.username}@office.local`;
    const valid = await verifyUserPassword(email, current_password);
    if (!valid) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
    }

    // Fetch encrypted entry
    const { data: entry, error: fetchErr } = await vaultDb
      .from('vault_entries')
      .select('id, password_encrypted, iv, auth_tag')
      .eq('id', entry_id)
      .single();

    if (fetchErr || !entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    // Decrypt
    const plaintext = decryptPassword(entry.password_encrypted, entry.iv, entry.auth_tag);

    // Log reveal
    await vaultDb.from('vault_audit').insert({
      user_id: profile.id,
      entry_id: entry_id,
      action: 'view',
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
    });

    return NextResponse.json(
      { password: plaintext },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
          'Content-Security-Policy': "default-src 'self'",
        },
      }
    );
  } catch {
    return NextResponse.json({ error: 'Failed to reveal password' }, { status: 500 });
  }
}
