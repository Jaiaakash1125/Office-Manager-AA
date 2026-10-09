-- ==============================================================================
-- Password Vault - Database Schema
-- Run this in Supabase SQL Editor
-- ==============================================================================

-- 1. vault_entries: stores encrypted portal credentials
CREATE TABLE IF NOT EXISTS public.vault_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  portal_name   text NOT NULL,
  portal_url    text,
  username      text NOT NULL,
  password_encrypted text NOT NULL,
  iv            text NOT NULL,
  auth_tag      text NOT NULL,
  notes         text,
  created_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vault_entries_customer ON public.vault_entries(customer_name);
CREATE INDEX IF NOT EXISTS idx_vault_entries_created_by ON public.vault_entries(created_by);

-- 2. vault_history: old encrypted passwords when entry is edited
CREATE TABLE IF NOT EXISTS public.vault_history (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id           uuid NOT NULL REFERENCES public.vault_entries(id) ON DELETE CASCADE,
  password_encrypted text NOT NULL,
  iv                 text NOT NULL,
  auth_tag           text NOT NULL,
  changed_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vault_history_entry ON public.vault_history(entry_id);

-- 3. vault_audit: every view/copy/create/edit/delete action
CREATE TABLE IF NOT EXISTS public.vault_audit (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  entry_id   uuid REFERENCES public.vault_entries(id) ON DELETE SET NULL,
  action     text NOT NULL CHECK (action IN ('view','copy','create','edit','delete')),
  ip         text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vault_audit_user ON public.vault_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_audit_entry ON public.vault_audit(entry_id);
CREATE INDEX IF NOT EXISTS idx_vault_audit_created ON public.vault_audit(created_at DESC);

-- 4. Enable RLS on all three vault tables WITH NO POLICIES
--    Only the service-role key used by Next.js server routes can access them.
ALTER TABLE public.vault_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_audit   ENABLE ROW LEVEL SECURITY;

-- 5. Updated_at trigger for vault_entries
CREATE TRIGGER set_vault_entries_updated_at
  BEFORE UPDATE ON public.vault_entries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
