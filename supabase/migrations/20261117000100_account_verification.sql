-- توثيق الحسابات: عمود الحالة + دالة للمشرف فقط. طلبات التوثيق تصل عبر صندوق الدعم (فئة «طلب توثيق»).
alter table public.student_profiles add column if not exists is_verified boolean not null default false;
alter table public.student_profiles add column if not exists verification_type text check (verification_type in ('verified','admin','teacher','developer'));

create or replace function public.admin_set_verified(p_user_id uuid, p_verified boolean, p_type text default 'verified')
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not private.is_premium_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.student_profiles
     set is_verified = coalesce(p_verified, false),
         verification_type = case when coalesce(p_verified, false) then (case when p_type in ('verified','admin','teacher','developer') then p_type else 'verified' end) else null end
   where user_id = p_user_id;
end;
$$;
revoke all on function public.admin_set_verified(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_verified(uuid, boolean, text) to authenticated;

-- منع الطالب من توثيق نفسه عبر upsert على ملفه
create or replace function public.student_profiles_protect_verified()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    new.is_verified := false; new.verification_type := null;
  elsif (new.is_verified is distinct from old.is_verified or new.verification_type is distinct from old.verification_type) and not private.is_premium_admin() then
    new.is_verified := old.is_verified; new.verification_type := old.verification_type;
  end if;
  return new;
end;
$$;
drop trigger if exists student_profiles_protect_verified on public.student_profiles;
create trigger student_profiles_protect_verified before insert or update on public.student_profiles
  for each row execute function public.student_profiles_protect_verified();

-- دليل المستخدمين للمشرف: الاسم والبريد والصورة وحالة التوثيق والحظر
create or replace function public.admin_users_directory(p_limit integer default 500)
returns table(user_id uuid, name text, email text, avatar_url text, stage text, province text, is_verified boolean, verification_type text, is_banned boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = public, private, pg_temp as $$
begin
  if not private.is_premium_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  select au.id,
         coalesce(nullif(trim(concat_ws(' ', sp.first_name, sp.father_name, sp.family_name)), ''), 'طالب نبض'),
         au.email::text, sp.avatar_url, sp.study_stage, coalesce(sp.province, sp.governorate),
         coalesce(sp.is_verified, false), sp.verification_type,
         exists(select 1 from public.chat_user_bans b where b.user_id = au.id and (b.expires_at is null or b.expires_at > now())),
         au.created_at
  from auth.users au left join public.student_profiles sp on sp.user_id = au.id
  order by au.created_at desc
  limit greatest(1, least(coalesce(p_limit, 500), 2000));
end; $$;
revoke all on function public.admin_users_directory(integer) from public, anon;
grant execute on function public.admin_users_directory(integer) to authenticated;
