-- Public, read-only profile projection for chat participants.
create or replace function public.chat_get_profile(p_user_id uuid)
returns table(user_id uuid, first_name text, father_name text, family_name text, study_stage text, province text, avatar_url text, bio text, gender text)
language sql stable security definer set search_path=public,pg_temp as $$
  select sp.user_id,sp.first_name,sp.father_name,sp.family_name,sp.study_stage,sp.province,sp.avatar_url,sp.bio,sp.gender
  from public.student_profiles sp where sp.user_id=p_user_id limit 1;
$$;
grant execute on function public.chat_get_profile(uuid) to authenticated;
