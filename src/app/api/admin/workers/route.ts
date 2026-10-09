import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { usernameToEmail } from '@/lib/auth-helpers';

// GET all workers (admin only)
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (myProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const adminSupabase = createAdminClient();
    const { data: profiles, error } = await adminSupabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ profiles });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Create a new worker
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (myProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { name, username, password, role = 'worker' } = await request.json();

    if (!name || !username || !password) {
      return NextResponse.json(
        { error: 'Name, username, and password are required' },
        { status: 400 }
      );
    }

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    const email = usernameToEmail(cleanUsername);
    const adminSupabase = createAdminClient();

    // Check if username is taken
    const { data: existing } = await adminSupabase
      .from('profiles')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: `Username "${cleanUsername}" is already taken` },
        { status: 400 }
      );
    }

    // 1. Create User in Supabase Auth via Admin client
    const { data: authUser, error: createError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, username: cleanUsername },
    });

    if (createError || !authUser.user) {
      return NextResponse.json(
        { error: createError?.message || 'Failed to create auth user' },
        { status: 400 }
      );
    }

    // 2. Insert Profile record
    const { data: newProfile, error: profileInsertError } = await adminSupabase
      .from('profiles')
      .insert({
        id: authUser.user.id,
        name: name.trim(),
        username: cleanUsername,
        role: role === 'admin' ? 'admin' : 'worker',
        active: true,
      })
      .select()
      .single();

    if (profileInsertError) {
      // rollback auth user if profile fails
      await adminSupabase.auth.admin.deleteUser(authUser.user.id);
      throw profileInsertError;
    }

    return NextResponse.json({ success: true, profile: newProfile });
  } catch (err: any) {
    console.error('Error creating worker:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

// PATCH: Toggle active status or Reset Password
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (myProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { userId, active, newPassword } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'Worker ID is required' }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    // Reset password if provided
    if (newPassword && newPassword.length >= 6) {
      const { error: pwdError } = await adminSupabase.auth.admin.updateUserById(userId, {
        password: newPassword,
      });
      if (pwdError) throw pwdError;
    }

    // Update active status if provided
    if (typeof active === 'boolean') {
      const { error: actError } = await adminSupabase
        .from('profiles')
        .update({ active })
        .eq('id', userId);
      if (actError) throw actError;
    }

    return NextResponse.json({ success: true, message: 'Worker updated successfully' });
  } catch (err: any) {
    console.error('Error updating worker:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
