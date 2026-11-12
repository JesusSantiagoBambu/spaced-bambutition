-- Spaced Bambutition: tablas y reglas de seguridad para Supabase.
-- Pegar entero en Supabase > SQL Editor > New query > Run. Se puede ejecutar mas de una vez.

-- 1. Perfiles (uno por usuario). role = 'student' por defecto; el profesor se marca a mano.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'student' check (role in ('student', 'teacher')),
  created_at timestamptz not null default now()
);

-- 2. Datos de la app de cada alumno (todo su estado en un JSON).
create table if not exists public.app_states (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  client_updated_at timestamptz,
  app_version text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.app_states enable row level security;

-- 3. Saber si quien consulta es profesor (security definer para no entrar en bucle con RLS).
create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher');
$$;

-- 4. Crear el perfil automaticamente al registrarse.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. Fecha de ultima subida la pone el servidor.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_states_touch on public.app_states;
create trigger app_states_touch
  before insert or update on public.app_states
  for each row execute function public.touch_updated_at();

-- 6. Reglas: cada alumno solo ve y cambia lo suyo; el profesor puede leer todo.
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_teacher());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "app_states_select" on public.app_states;
create policy "app_states_select" on public.app_states
  for select to authenticated
  using (user_id = auth.uid() or public.is_teacher());

drop policy if exists "app_states_insert_own" on public.app_states;
create policy "app_states_insert_own" on public.app_states
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "app_states_update_own" on public.app_states;
create policy "app_states_update_own" on public.app_states
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 7. Permisos: nadie sin sesion; los alumnos solo pueden cambiar su nombre, nunca su rol.
revoke all on public.profiles from anon;
revoke all on public.app_states from anon;
revoke insert, update, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, update on public.app_states to authenticated;
revoke delete on public.app_states from authenticated;
revoke execute on function public.is_teacher() from anon;

-- 8. Perfiles de usuarios que ya existieran antes de ejecutar este script.
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;
