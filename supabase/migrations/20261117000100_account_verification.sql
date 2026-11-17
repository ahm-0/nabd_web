-- توثيق الحسابات: عمود الحالة + دالة للمشرف فقط. طلبات التوثيق تصل عبر صندوق الدعم (فئة «طلب توثيق»).
alter table public.student_profiles add column if not exists is_verified boolean not null default false;

create or replace function public.admin_set_verified(p_user_id uuid, p_verified boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.premium_is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.student_profiles set is_verified = coalesce(p_verified, false) where user_id = p_user_id;
end;
$$;
revoke all on function public.admin_set_verified(uuid, boolean) from public, anon;
grant execute on function public.admin_set_verified(uuid, boolean) to authenticated;

-- منع الطالب من توثيق نفسه عبر upsert على ملفه
create or replace function public.student_profiles_protect_verified()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    new.is_verified := false;
  elsif new.is_verified is distinct from old.is_verified and not public.premium_is_admin() then
    new.is_verified := old.is_verified;
  end if;
  return new;
end;
$$;
drop trigger if exists student_profiles_protect_verified on public.student_profiles;
create trigger student_profiles_protect_verified before insert or update on public.student_profiles
  for each row execute function public.student_profiles_protect_verified();
