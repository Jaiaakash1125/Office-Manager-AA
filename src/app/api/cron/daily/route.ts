import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOfficeDateString } from '@/lib/time-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const url = new URL(request.url);
    const secretQuery = url.searchParams.get('secret');

    const cronSecret = process.env.CRON_SECRET;

    // Validate CRON_SECRET (via Authorization Bearer header or ?secret= query)
    const isAuthorized =
      !cronSecret || // If no secret configured (local dev)
      authHeader === `Bearer ${cronSecret}` ||
      secretQuery === cronSecret;

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid CRON_SECRET' },
        { status: 401 }
      );
    }

    const supabase = createAdminClient();
    const todayDate = getOfficeDateString();

    // 1. LOGOUT CLEANUP: Find open attendance records from past dates (date < todayDate)
    const { data: openAttendances, error: attError } = await supabase
      .from('attendance')
      .select('*')
      .lt('date', todayDate)
      .is('logout_time', null);

    let cleanedCount = 0;

    if (openAttendances && openAttendances.length > 0) {
      for (const record of openAttendances) {
        // If last_active is close to login_time (< 5 minutes diff / no heartbeat), set to 7:00 PM auto
        const loginMs = new Date(record.login_time).getTime();
        const lastActiveMs = new Date(record.last_active).getTime();
        const activeSeconds = record.active_seconds || 0;

        // If there was heartbeat activity (active_seconds > 0 or last_active > 10m from login)
        const hasHeartbeat = activeSeconds > 0 || (lastActiveMs - loginMs > 10 * 60 * 1000);

        let finalLogoutTime: string;
        let logoutType: 'estimated' | 'auto';

        if (hasHeartbeat && record.last_active) {
          finalLogoutTime = record.last_active;
          logoutType = 'estimated';
        } else {
          // Construct 7:00 PM IST on that record's date
          const dateStr = record.date; // "YYYY-MM-DD"
          // 19:00 IST is 13:30 UTC
          finalLogoutTime = new Date(`${dateStr}T19:00:00+05:30`).toISOString();
          logoutType = 'auto';
        }

        await supabase
          .from('attendance')
          .update({
            logout_time: finalLogoutTime,
            logout_type: logoutType,
          })
          .eq('id', record.id);

        cleanedCount++;
      }
    }

    // 2. CHECK 30+ DAYS OVERDUE BILLS
    // 30 days ago in YYYY-MM-DD
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = getOfficeDateString(thirtyDaysAgo);

    const { data: overdueBills, error: billsError } = await supabase
      .from('bills')
      .select('id, client_name, bill_no, amount, bill_date')
      .eq('status', 'pending')
      .lte('bill_date', thirtyDaysAgoStr);

    const overdueCount = overdueBills?.length || 0;
    const totalOverdueAmount = overdueBills?.reduce((sum, b) => sum + Number(b.amount), 0) || 0;

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      attendance_cleaned: cleanedCount,
      overdue_bills_30_days: {
        count: overdueCount,
        total_amount: totalOverdueAmount,
        bills: overdueBills || [],
      },
      message: `Daily check complete. Cleaned ${cleanedCount} unclosed attendances. Found ${overdueCount} pending bills over 30 days.`,
    });
  } catch (err: any) {
    console.error('Daily cron error:', err);
    return NextResponse.json(
      { error: err.message || 'Error running daily cron job' },
      { status: 500 }
    );
  }
}
