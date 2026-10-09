import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOfficeDateString } from '@/lib/time-utils';

// GET today's work logs for the logged-in worker
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const todayDate = getOfficeDateString();

    const { data: logs, error } = await supabase
      .from('work_log')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', todayDate)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const totalMinutes = (logs || []).reduce((acc, log) => acc + (log.minutes || 0), 0);

    return NextResponse.json({ logs, totalMinutes });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Add new work log item
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { description, minutes } = await request.json();

    if (!description || !minutes || parseInt(minutes, 10) <= 0) {
      return NextResponse.json(
        { error: 'Description and positive minutes are required' },
        { status: 400 }
      );
    }

    const todayDate = getOfficeDateString();

    const { data: log, error } = await supabase
      .from('work_log')
      .insert({
        user_id: user.id,
        date: todayDate,
        description: description.trim(),
        minutes: parseInt(minutes, 10),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, log });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Delete a work log item
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const logId = url.searchParams.get('id');

    if (!logId) {
      return NextResponse.json({ error: 'Missing log ID' }, { status: 400 });
    }

    const { error } = await supabase
      .from('work_log')
      .delete()
      .eq('id', logId)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
