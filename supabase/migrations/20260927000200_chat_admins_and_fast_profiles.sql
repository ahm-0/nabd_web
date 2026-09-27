create or replace function public.chat_can_moderate()
returns boolean language sql stable security definer set search_path=public,private,pg_temp as $$
  select auth.uid() is not null and (private.is_premium_admin() or exists(select 1 from public.chat_moderators where user_id=auth.uid()));
$$;
create or replace function public.chat_list_messages_with_profiles(p_limit integer default 80)
returns table(id uuid, sender_id uuid, body text, reply_to_id uuid, reaction text, edited_at timestamptz, created_at timestamptz, pinned_at timestamptz, pinned_by uuid, first_name text, father_name text, family_name text, study_stage text, province text, avatar_url text, bio text, is_moderator boolean)
language sql stable security definer set search_path=public, private, pg_temp as $$
  select m.id,m.sender_id,m.body,m.reply_to_id,m.reaction,m.edited_at,m.created_at,m.pinned_at,m.pinned_by, sp.first_name,sp.father_name,sp.family_name,sp.study_stage,sp.province,sp.avatar_url,sp.bio,
  (exists(select 1 from public.admin_users au where au.user_id=m.sender_id and au.is_active=true and au.role in ('admin','editor')) or exists(select 1 from public.chat_moderators cm where cm.user_id=m.sender_id))
  from public.public_chat_messages m left join public.student_profiles sp on sp.user_id=m.sender_id where m.deleted_at is null order by m.created_at desc limit greatest(1,least(coalesce(p_limit,80),200));
$$;
grant execute on function public.chat_list_messages_with_profiles(integer) to authenticated;
