import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { formatTime, formatDate, formatActiveSeconds, calculateDurationHours } from '@/lib/time-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
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

    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'attendance'; // 'attendance' | 'bills'

    if (type === 'attendance') {
      // Fetch attendance with profile join
      const { data: attendanceList, error } = await supabase
        .from('attendance')
        .select(`
          id, date, login_time, logout_time, last_active, active_seconds, logout_type, is_late,
          profiles (name, username)
        `)
        .order('date', { ascending: false });

      if (error) throw error;

      // Build CSV
      const headers = ['Date', 'Worker Name', 'Username', 'Login Time', 'Logout Time', 'Total Duration', 'Active Time', 'Status / Late', 'Logout Type'];
      const rows = (attendanceList || []).map((att: any) => {
        const totalDuration = calculateDurationHours(att.login_time, att.logout_time, att.last_active).formatted;
        const activeDuration = formatActiveSeconds(att.active_seconds);
        const lateStatus = att.is_late ? 'Late (>10:00 AM)' : 'On Time';
        const logoutTypeStr = att.logout_type ? att.logout_type.toUpperCase() : (att.logout_time ? 'COMPLETED' : 'IN PROGRESS');

        return [
          att.date,
          `"${att.profiles?.name || 'Unknown'}"`,
          att.profiles?.username || '',
          formatTime(att.login_time),
          formatTime(att.logout_time),
          totalDuration,
          activeDuration,
          lateStatus,
          logoutTypeStr,
        ].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="staff_attendance_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    } else if (type === 'bills') {
      const { data: billsList, error } = await supabase
        .from('bills')
        .select('*')
        .order('bill_date', { ascending: false });

      if (error) throw error;

      const headers = ['Bill No', 'Client Name', 'Amount (INR)', 'Bill Date', 'Status', 'Paid Date'];
      const rows = (billsList || []).map((bill: any) => [
        `"${bill.bill_no}"`,
        `"${bill.client_name}"`,
        bill.amount,
        bill.bill_date,
        bill.status.toUpperCase(),
        bill.paid_date || 'N/A',
      ].join(','));

      const csvContent = [headers.join(','), ...rows].join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="bills_invoices_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid export type' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
