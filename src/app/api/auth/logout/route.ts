import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOfficeDateString } from '@/lib/time-utils';

export async function POST(request: Request) {
  try {
    const { dailyNote } = await request.json().catch(() => ({ dailyNote: '' }));
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ success: true, message: 'Already logged out' });
    }

    const todayDate = getOfficeDateString();
    const serverNow = new Date().toISOString();

    // 1. If daily work note provided, save or update it
    if (dailyNote && dailyNote.trim().length > 0) {
      await supabase
        .from('work_notes')
        .upsert({
          user_id: user.id,
          date: todayDate,
          note: dailyNote.trim(),
        }, {
          onConflict: 'user_id,date'
        });
    }

    // 2. Update attendance record with logout_time and logout_type='manual'
    await supabase
      .from('attendance')
      .update({
        logout_time: serverNow,
        last_active: serverNow,
        logout_type: 'manual',
      })
      .eq('user_id', user.id)
      .eq('date', todayDate);

    // 3. Sign out of Supabase auth
    await supabase.auth.signOut();

    return NextResponse.json({ success: true, message: 'Logged out successfully' });
  } catch (err: any) {
    console.error('Logout error:', err);
    return NextResponse.json(
      { error: err.message || 'Logout encountered an error' },
      { status: 500 }
    );
  }
}
