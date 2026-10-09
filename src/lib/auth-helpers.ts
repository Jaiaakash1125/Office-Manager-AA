import { Profile } from '@/types';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const EMAIL_DOMAIN = 'office.local';

/**
 * Converts a simple username to the internal Supabase auth email
 * e.g., "john" -> "john@office.local"
 */
export function usernameToEmail(username: string): string {
  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
  return `${cleanUsername}@${EMAIL_DOMAIN}`;
}

/**
 * Extracts username from the internal email
 */
export function emailToUsername(email: string): string {
  if (!email) return '';
  return email.split('@')[0];
}

/**
 * Fetches the active profile for the currently logged-in user
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return null;
  }

  return profile as Profile;
}
