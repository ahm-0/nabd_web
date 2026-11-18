-- إحصاءات الدردشة: سياسة RLS على student_profiles تسمح للمستخدم برؤية صفه فقط، فكان عدّاد «المتصلين»
-- في الواجهة القديمة يعدّ صفًا واحدًا على الأكثر. دالة security definer تعيد الأرقام الحقيقية.
create or replace function public.chat_get_stats()
returns table(total bigint, online bigint)
language sql stable security definer set search_path = public, pg_temp as $$
  select (select count(*) from auth.users),
         (select count(*) from public.student_profiles where last_usage_at >= now() - interval '5 minutes')
  where auth.uid() is not null;
$$;
revoke all on function public.chat_get_stats() from public, anon;
grant execute on function public.chat_get_stats() to authenticated;

-- إضافة مرسل الرسالة المُجاب عليها لعرض اسمه في معاينة الرد داخل الخاصة
drop function if exists public.chat_list_private_messages(uuid, integer, timestamptz);
create or replace function public.chat_list_private_messages(p_thread uuid, p_limit integer default 40, p_before timestamptz default null)
returns table(
  id uuid, thread_id uuid, sender_id uuid, body text, reply_to_id uuid, reply_body text, reply_sender_id uuid,
  reaction text, edited_at timestamptz, created_at timestamptz, read_at timestamptz
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not exists(select 1 from public.private_chat_threads t where t.id = p_thread and (t.user_a = auth.uid() or t.user_b = auth.uid())) then
    raise exception 'لا تملك صلاحية قراءة هذه المحادثة';
  end if;
  return query
    select m.id, m.thread_id, m.sender_id, m.body, m.reply_to_id, rm.body, rm.sender_id, m.reaction, m.edited_at, m.created_at, m.read_at
    from public.private_chat_messages m
    left join public.private_chat_messages rm on rm.id = m.reply_to_id and rm.deleted_at is null
    where m.thread_id = p_thread and m.deleted_at is null and (p_before is null or m.created_at < p_before)
    order by m.created_at desc
    limit greatest(1, least(coalesce(p_limit, 40), 100));
end; $$;
revoke all on function public.chat_list_private_messages(uuid, integer, timestamptz) from public, anon;
grant execute on function public.chat_list_private_messages(uuid, integer, timestamptz) to authenticated;
