import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, active')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.active) {
    redirect('/login');
  }

  if (profile.role === 'admin') {
    redirect('/admin');
  } else {
    redirect('/worker');
  }
}
