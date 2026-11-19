-- سياسة منع لقطات الشاشة لكل قسم (يعدّلها الأدمن أو المطوّر الموثّق).
create table if not exists public.app_screenshot_policy (
  section text primary key check (section in ('home','profile','settings','chat','news','support','premium','exam','tasks','admin')),
  blocked boolean not null default false,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.app_screenshot_policy enable row level security;
revoke all on table public.app_screenshot_policy from anon, authenticated;
create or replace function public.get_screenshot_policy() returns table(section text, blocked boolean)
language sql stable security definer set search_path = public, pg_temp as $$ select p.section, p.blocked from public.app_screenshot_policy p; $$;
grant execute on function public.get_screenshot_policy() to anon, authenticated;
create or replace function public.admin_set_screenshot_policy(p_section text, p_blocked boolean) returns void
language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if auth.uid() is null or not (private.is_premium_admin() or exists (select 1 from public.student_profiles sp where sp.user_id = auth.uid() and sp.is_verified and sp.verification_type = 'developer')) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.app_screenshot_policy(section, blocked, updated_by, updated_at) values (p_section, coalesce(p_blocked, false), auth.uid(), now())
  on conflict (section) do update set blocked = excluded.blocked, updated_by = excluded.updated_by, updated_at = now();
end; $$;
revoke all on function public.admin_set_screenshot_policy(text, boolean) from public, anon;
grant execute on function public.admin_set_screenshot_policy(text, boolean) to authenticated;
