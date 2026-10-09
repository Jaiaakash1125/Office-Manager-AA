import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOfficeDateString } from '@/lib/time-utils';

// GET all bills with 30-day overdue calculation
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: bills, error } = await supabase
      .from('bills')
      .select('*')
      .order('bill_date', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ bills });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Add new bill
export async function POST(request: Request) {
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

    const { clientName, billNo, amount, billDate } = await request.json();

    if (!clientName || !billNo || !amount || !billDate) {
      return NextResponse.json(
        { error: 'Client name, Bill #, Amount, and Bill date are required' },
        { status: 400 }
      );
    }

    const { data: bill, error } = await supabase
      .from('bills')
      .insert({
        client_name: clientName.trim(),
        bill_no: billNo.trim(),
        amount: parseFloat(amount),
        bill_date: billDate,
        status: 'pending',
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, bill });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH: Mark as paid or update status
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

    const { billId, status } = await request.json();

    if (!billId || !status) {
      return NextResponse.json({ error: 'Missing billId or status' }, { status: 400 });
    }

    const todayDate = getOfficeDateString();
    const paidDate = status === 'paid' ? todayDate : null;

    const { data: updated, error } = await supabase
      .from('bills')
      .update({
        status,
        paid_date: paidDate,
      })
      .eq('id', billId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, bill: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
