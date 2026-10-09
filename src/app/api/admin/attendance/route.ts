import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { checkIsLate } from '@/lib/time-utils';

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { attendanceId, loginTime, logoutTime, logoutType, activeMinutes } = await request.json();

    if (!attendanceId) {
      return NextResponse.json({ error: 'Missing attendanceId' }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    const updatePayload: any = {};
    if (loginTime) {
      updatePayload.login_time = new Date(loginTime).toISOString();
      updatePayload.is_late = checkIsLate(updatePayload.login_time);
    }
    if (logoutTime !== undefined) {
      updatePayload.logout_time = logoutTime ? new Date(logoutTime).toISOString() : null;
    }
    if (logoutType !== undefined) {
      updatePayload.logout_type = logoutType;
    }
    if (typeof activeMinutes === 'number') {
      updatePayload.active_seconds = Math.max(0, activeMinutes * 60);
    }

    const { data: updated, error } = await adminSupabase
      .from('attendance')
      .update(updatePayload)
      .eq('id', attendanceId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, attendance: updated });
  } catch (err: any) {
    console.error('Error modifying attendance:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
