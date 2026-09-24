-- إظهار علامة المشرف بجانب الاسم في الدردشة العامة
-- إسقاط الدالة القديمة لأن إضافة عمود is_moderator تغيّر نوع الإرجاع.
drop function if exists public.chat_get_profiles(uuid[]);
create or replace function public.chat_get_profiles(p_user_ids uuid[])
returns table(user_id uuid, first_name text, father_name text, family_name text, study_stage text, province text, avatar_url text, bio text, gender text, is_moderator boolean)
language sql stable security definer set search_path=public,pg_temp as $$
  select sp.user_id,sp.first_name,sp.father_name,sp.family_name,sp.study_stage,sp.province,sp.avatar_url,sp.bio,sp.gender,
         exists(select 1 from public.chat_moderators cm where cm.user_id = sp.user_id) as is_moderator
  from public.student_profiles sp where sp.user_id = any(p_user_ids);
$$;
grant execute on function public.chat_get_profiles(uuid[]) to authenticated;
