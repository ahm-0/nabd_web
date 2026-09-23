-- Return the current user's private conversations with the other participant.
create or replace function public.chat_list_private_conversations()
returns table(thread_id uuid, other_user_id uuid, other_name text, other_avatar text, last_message text, last_message_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
  select t.id,
    case when t.user_a=auth.uid() then t.user_b else t.user_a end,
    coalesce(nullif(trim(concat_ws(' ',p.first_name,p.father_name,p.family_name)),''),'مستخدم'),
    p.avatar_url,
    lm.body,
    t.last_message_at
  from public.private_chat_threads t
  left join public.student_profiles p on p.user_id=case when t.user_a=auth.uid() then t.user_b else t.user_a end
  left join lateral (select m.body from public.private_chat_messages m where m.thread_id=t.id and m.deleted_at is null order by m.created_at desc limit 1) lm on true
  where auth.uid() is not null and (t.user_a=auth.uid() or t.user_b=auth.uid())
  order by t.last_message_at desc;
$$;
grant execute on function public.chat_list_private_conversations() to authenticated;
