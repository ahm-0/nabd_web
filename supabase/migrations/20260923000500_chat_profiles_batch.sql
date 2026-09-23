-- Secure batch profile projection for rendering real names in chat.
create or replace function public.chat_get_profiles(p_user_ids uuid[])
returns table(user_id uuid, first_name text, father_name text, family_name text, study_stage text, province text, avatar_url text, bio text, gender text)
language sql stable security definer set search_path=public,pg_temp as $$
  select sp.user_id,sp.first_name,sp.father_name,sp.family_name,sp.study_stage,sp.province,sp.avatar_url,sp.bio,sp.gender
  from public.student_profiles sp where sp.user_id = any(p_user_ids);
$$;
grant execute on function public.chat_get_profiles(uuid[]) to authenticated;
