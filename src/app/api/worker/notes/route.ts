import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOfficeDateString } from '@/lib/time-utils';

// GET today's work note for the logged-in worker
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const todayDate = getOfficeDateString();

    const { data: noteRecord } = await supabase
      .from('work_notes')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', todayDate)
      .maybeSingle();

    return NextResponse.json({ note: noteRecord?.note || '' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Save or update today's work note
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { note } = await request.json();
    const todayDate = getOfficeDateString();

    const { data: saved, error } = await supabase
      .from('work_notes')
      .upsert({
        user_id: user.id,
        date: todayDate,
        note: (note || '').trim(),
      }, {
        onConflict: 'user_id,date'
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, note: saved.note });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
