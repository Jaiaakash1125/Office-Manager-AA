import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { usernameToEmail } from '@/lib/auth-helpers';
import { checkIsLate, getOfficeDateString } from '@/lib/time-utils';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const email = usernameToEmail(username);
    const supabase = await createClient();

    // 1. Authenticate with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || 'Invalid username or password' },
        { status: 401 }
      );
    }

    // 2. Fetch Profile to verify role and active status
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: 'User profile not found. Please contact the administrator.' },
        { status: 403 }
      );
    }

    if (!profile.active) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: 'Your account has been deactivated. Please contact the admin.' },
        { status: 403 }
      );
    }

    // 3. First login of the day: Check / Create attendance row using SERVER time
    const todayDate = getOfficeDateString();
    const serverNow = new Date().toISOString();
    const isLate = checkIsLate(serverNow);

    // Look for existing attendance today
    const { data: existingAttendance } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', profile.id)
      .eq('date', todayDate)
      .maybeSingle();

    if (!existingAttendance) {
      // Create new attendance row with server timestamp
      await supabase.from('attendance').insert({
        user_id: profile.id,
        date: todayDate,
        login_time: serverNow,
        last_active: serverNow,
        active_seconds: 0,
        is_late: isLate,
      });

      // Also ensure call_stats row exists for today
      await supabase.from('call_stats').insert({
        user_id: profile.id,
        date: todayDate,
        total_calls: 0,
        interested: 0,
        not_interested: 0,
        not_reachable: 0,
      }).select().maybeSingle();
    } else {
      // Update last_active
      await supabase
        .from('attendance')
        .update({ last_active: serverNow })
        .eq('id', existingAttendance.id);
    }

    return NextResponse.json({
      success: true,
      role: profile.role,
      user: {
        id: profile.id,
        name: profile.name,
        username: profile.username,
        role: profile.role,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error during login' },
      { status: 500 }
    );
  }
}
