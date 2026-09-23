alter table public.private_chat_messages add column if not exists read_at timestamptz;
create index if not exists private_chat_messages_unread_idx on public.private_chat_messages(thread_id, sender_id, read_at) where read_at is null;
create or replace function public.chat_get_private_unread_count()
returns bigint language sql stable security definer set search_path=public,pg_temp as $$
  select count(*)::bigint from public.private_chat_messages m join public.private_chat_threads t on t.id=m.thread_id
  where m.sender_id <> auth.uid() and m.read_at is null and (t.user_a=auth.uid() or t.user_b=auth.uid()) and auth.uid() is not null;
$$;
create or replace function public.chat_mark_private_thread_read(p_thread_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.private_chat_messages m set read_at=now() where m.thread_id=p_thread_id and m.sender_id <> auth.uid() and m.read_at is null and exists(select 1 from public.private_chat_threads t where t.id=m.thread_id and (t.user_a=auth.uid() or t.user_b=auth.uid()));
  return true;
end; $$;
grant execute on function public.chat_get_private_unread_count() to authenticated;
grant execute on function public.chat_mark_private_thread_read(uuid) to authenticated;
