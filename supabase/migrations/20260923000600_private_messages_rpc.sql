-- Reliable private-message write path and conversation timestamp.
create or replace function public.chat_send_private_message(p_thread_id uuid,p_body text)
returns public.private_chat_messages
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_row public.private_chat_messages;
begin
  if auth.uid() is null or p_thread_id is null or char_length(trim(coalesce(p_body,'')))=0 then raise exception 'الرسالة الخاصة غير صالحة'; end if;
  if not exists(select 1 from public.private_chat_threads t where t.id=p_thread_id and (t.user_a=auth.uid() or t.user_b=auth.uid())) then raise exception 'لا تملك صلاحية إرسال الرسالة'; end if;
  insert into public.private_chat_messages(thread_id,sender_id,body) values(p_thread_id,auth.uid(),trim(p_body)) returning * into v_row;
  update public.private_chat_threads set last_message_at=now() where id=p_thread_id;
  return v_row;
end; $$;
grant execute on function public.chat_send_private_message(uuid,text) to authenticated;
