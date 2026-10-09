import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOfficeDateString } from '@/lib/time-utils';

export async function POST(request: Request) {
  try {
    const { isActive, elapsedSeconds = 300 } = await request.json().catch(() => ({
      isActive: false,
      elapsedSeconds: 0,
    }));

    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const todayDate = getOfficeDateString();
    const serverNow = new Date().toISOString();

    // Fetch existing attendance row for today
    const { data: attendance } = await supabase
      .from('attendance')
      .select('id, active_seconds, logout_time')
      .eq('user_id', user.id)
      .eq('date', todayDate)
      .maybeSingle();

    if (!attendance) {
      // If no attendance yet today, create it
      await supabase.from('attendance').insert({
        user_id: user.id,
        date: todayDate,
        login_time: serverNow,
        last_active: serverNow,
        active_seconds: isActive ? Math.min(elapsedSeconds, 300) : 0,
      });
    } else if (!attendance.logout_time) {
      // Only increment if not manually logged out
      const additionalActiveSeconds = isActive ? Math.min(Math.max(0, elapsedSeconds), 300) : 0;
      const newActiveSeconds = (attendance.active_seconds || 0) + additionalActiveSeconds;

      await supabase
        .from('attendance')
        .update({
          last_active: serverNow,
          active_seconds: newActiveSeconds,
        })
        .eq('id', attendance.id);
    }

    return NextResponse.json({
      success: true,
      last_active: serverNow,
    });
  } catch (err: any) {
    console.error('Heartbeat error:', err);
    return NextResponse.json(
      { error: err.message || 'Error processing heartbeat' },
      { status: 500 }
    );
  }
}
