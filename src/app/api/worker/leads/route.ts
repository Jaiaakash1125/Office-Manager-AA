import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOfficeDateString } from '@/lib/time-utils';

// GET worker's leads and today's callbacks
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const todayDate = getOfficeDateString();

    const { data: leads, error } = await supabase
      .from('leads')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Filter today's pending callbacks
    const todayCallbacks = (leads || []).filter(
      (l) => l.callback_date && l.callback_date <= todayDate && l.status !== 'converted' && l.status !== 'dropped'
    );

    return NextResponse.json({ leads, todayCallbacks });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH: Update lead status or note
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { leadId, status, note, callbackDate } = await request.json();

    if (!leadId) {
      return NextResponse.json({ error: 'Missing leadId' }, { status: 400 });
    }

    const updatePayload: any = {};
    if (status) updatePayload.status = status;
    if (note !== undefined) updatePayload.note = note;
    if (callbackDate !== undefined) updatePayload.callback_date = callbackDate || null;

    const { data: updated, error } = await supabase
      .from('leads')
      .update(updatePayload)
      .eq('id', leadId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, lead: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
