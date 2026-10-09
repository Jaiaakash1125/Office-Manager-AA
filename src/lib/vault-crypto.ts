import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ─── Key Management ─────────────────────────────────────────────────────────
function getVaultKey(): Buffer {
  const keyB64 = process.env.VAULT_KEY;
  if (!keyB64) throw new Error('VAULT_KEY environment variable is not set');
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) throw new Error('VAULT_KEY must be 32 bytes (base64-encoded)');
  return key;
}

// ─── Encryption ─────────────────────────────────────────────────────────────
export function encryptPassword(plaintext: string): {
  password_encrypted: string;
  iv: string;
  auth_tag: string;
} {
  const key = getVaultKey();
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    password_encrypted: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    auth_tag: authTag.toString('hex'),
  };
}

// ─── Decryption ─────────────────────────────────────────────────────────────
export function decryptPassword(
  password_encrypted: string,
  iv: string,
  auth_tag: string
): string {
  const key = getVaultKey();
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(auth_tag, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(password_encrypted, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

// ─── Verify current user auth ────────────────────────────────────────────────
export async function verifyUserPassword(
  email: string,
  password: string
): Promise<boolean> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return !error;
}

// ─── Rate Limiter (in-memory, per user, per minute) ──────────────────────────
const revealMap = new Map<string, { count: number; resetAt: number }>();

export function checkRevealRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = revealMap.get(userId);
  if (!entry || now > entry.resetAt) {
    revealMap.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}
