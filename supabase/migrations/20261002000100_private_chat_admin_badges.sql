-- توحيد شارة المشرف في الدردشة العامة والخاصة.
-- كل من يملك صلاحية بوابة الإدارة أو عُيّن مشرف دردشة يظهر كحساب موثّق.
drop function if exists public.chat_get_profiles(uuid[]);
create or replace function public.chat_get_profiles(p_user_ids uuid[])
returns table(user_id uuid, first_name text, father_name text, family_name text, study_stage text, province text, avatar_url text, bio text, gender text, is_moderator boolean)
language sql stable security definer set search_path=public,private,pg_temp as $$
  select sp.user_id, sp.first_name, sp.father_name, sp.family_name, sp.study_stage, sp.province, sp.avatar_url, sp.bio, sp.gender,
    (exists(select 1 from public.admin_users au where au.user_id=sp.user_id and au.is_active=true and au.role in ('admin','editor'))
     or exists(select 1 from public.chat_moderators cm where cm.user_id=sp.user_id)) as is_moderator
  from public.student_profiles sp
  where sp.user_id = any(p_user_ids);
$$;
grant execute on function public.chat_get_profiles(uuid[]) to authenticated;
