import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOfficeDateString } from '@/lib/time-utils';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { type, lead } = await request.json(); // type: 'interested' | 'not_interested' | 'not_reachable'
    const todayDate = getOfficeDateString();

    // 1. Fetch or create today's call stats
    const { data: stats } = await supabase
      .from('call_stats')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', todayDate)
      .maybeSingle();

    let currentTotal = stats?.total_calls || 0;
    let currentInterested = stats?.interested || 0;
    let currentNotInterested = stats?.not_interested || 0;
    let currentNotReachable = stats?.not_reachable || 0;

    if (type === 'interested') {
      currentInterested += 1;
      currentTotal += 1;

      // Create lead if lead info provided
      if (lead && lead.name && lead.phone) {
        const { error: leadErr } = await supabase.from('leads').insert({
          user_id: user.id,
          name: lead.name.trim(),
          phone: lead.phone.trim(),
          note: lead.note?.trim() || null,
          callback_date: lead.callbackDate || null,
          status: 'new',
        });
        if (leadErr) throw leadErr;
      }
    } else if (type === 'not_interested') {
      currentNotInterested += 1;
      currentTotal += 1;
    } else if (type === 'not_reachable') {
      currentNotReachable += 1;
      currentTotal += 1;
    }

    // Upsert call stats
    const { data: updatedStats, error: statErr } = await supabase
      .from('call_stats')
      .upsert({
        user_id: user.id,
        date: todayDate,
        total_calls: currentTotal,
        interested: currentInterested,
        not_interested: currentNotInterested,
        not_reachable: currentNotReachable,
      }, {
        onConflict: 'user_id,date'
      })
      .select()
      .single();

    if (statErr) throw statErr;

    return NextResponse.json({ success: true, stats: updatedStats });
  } catch (err: any) {
    console.error('Error logging call:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
