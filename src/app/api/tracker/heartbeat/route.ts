import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkIsLate, getOfficeDateString } from '@/lib/time-utils';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { api_token, active_seconds = 60, app_name = '' } = body;

    if (!api_token) {
      return NextResponse.json(
        { error: 'Missing api_token in request body' },
        { status: 401 }
      );
    }

    const supabase = createAdminClient();

    // 1. Find the profile matching this API token
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, username, active')
      .eq('api_token', api_token)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Invalid API token' },
        { status: 403 }
      );
    }

    if (!profile.active) {
      return NextResponse.json(
        { error: 'User account is deactivated' },
        { status: 403 }
      );
    }

    const todayDate = getOfficeDateString();
    const serverNow = new Date().toISOString();

    // 2. Find today's attendance record
    const { data: attendance } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', profile.id)
      .eq('date', todayDate)
      .maybeSingle();

    const addedSeconds = Math.max(0, parseInt(active_seconds, 10) || 0);

    if (!attendance) {
      // First activity of day detected via tracker
      await supabase.from('attendance').insert({
        user_id: profile.id,
        date: todayDate,
        login_time: serverNow,
        last_active: serverNow,
        active_seconds: addedSeconds,
        is_late: checkIsLate(serverNow),
      });
    } else {
      // Update attendance with new active seconds and last_active
      const totalActiveSeconds = (attendance.active_seconds || 0) + addedSeconds;
      await supabase
        .from('attendance')
        .update({
          last_active: serverNow,
          active_seconds: totalActiveSeconds,
          // If was previously auto-closed on same day, resume it
          logout_time: null,
          logout_type: null,
        })
        .eq('id', attendance.id);
    }

    return NextResponse.json({
      success: true,
      user: profile.name,
      last_active: serverNow,
      app_logged: app_name || 'N/A',
    });
  } catch (err: any) {
    console.error('Tracker API error:', err);
    return NextResponse.json(
      { error: err.message || 'Error processing tracker heartbeat' },
      { status: 500 }
    );
  }
}
