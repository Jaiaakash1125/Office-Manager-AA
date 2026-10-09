-- ==============================================================================
-- Office Manager - Initial Admin Seed Script
-- ==============================================================================
-- Instructions:
-- 1. Create your Admin user in Supabase Dashboard -> Authentication -> Users.
--    Email: admin@office.local
--    Password: (your chosen secure password)
--    Auto-confirm email: Checked
-- 2. Run the SQL below to insert or link the profile as 'admin'.
-- 3. Alternatively, use the SQL block below which creates the user and profile directly:

do $$
declare
  admin_uid uuid;
begin
  -- Check if admin user already exists in auth.users
  select id into admin_uid from auth.users where email = 'admin@office.local';

  -- If not exists, you can create it via Dashboard or if permitted:
  if admin_uid is null then
    admin_uid := gen_random_uuid();
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      admin_uid,
      'authenticated',
      'authenticated',
      'admin@office.local',
      crypt('Admin@123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"Office Admin","username":"admin"}',
      now(),
      now()
    );
  end if;

  -- Create or update Admin Profile
  insert into public.profiles (id, name, username, role, active, api_token)
  values (
    admin_uid,
    'Office Admin',
    'admin',
    'admin',
    true,
    encode(gen_random_bytes(24), 'hex')
  )
  on conflict (id) do update set
    name = excluded.name,
    username = excluded.username,
    role = 'admin',
    active = true;

end $$;
