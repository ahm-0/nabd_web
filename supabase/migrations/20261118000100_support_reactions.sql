-- تفاعلات (إيموجي) على رسائل الدعم: للطالب صاحب المحادثة وللمشرفين.
create table if not exists public.support_message_reactions (
  message_id uuid not null references public.support_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('👍','❤️','😂','😮','😢','🙏')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
alter table public.support_message_reactions enable row level security;
revoke all on table public.support_message_reactions from anon, authenticated;

create or replace function public.support_react(p_message_id uuid, p_emoji text)
returns text language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_thread uuid; v_owner uuid; v_current text;
begin
  if auth.uid() is null then raise exception 'يلزم تسجيل الدخول'; end if;
  select m.thread_id into v_thread from public.support_messages m where m.id = p_message_id;
  if v_thread is null then raise exception 'الرسالة غير موجودة'; end if;
  select t.user_id into v_owner from public.support_threads t where t.id = v_thread;
  if v_owner is distinct from auth.uid() and not private.is_premium_admin() then raise exception 'غير مسموح'; end if;
  select r.emoji into v_current from public.support_message_reactions r where r.message_id = p_message_id and r.user_id = auth.uid();
  if v_current = p_emoji then
    delete from public.support_message_reactions where message_id = p_message_id and user_id = auth.uid();
    return null;
  end if;
  insert into public.support_message_reactions(message_id, user_id, emoji) values (p_message_id, auth.uid(), p_emoji)
  on conflict (message_id, user_id) do update set emoji = excluded.emoji, created_at = now();
  return p_emoji;
end; $$;
revoke all on function public.support_react(uuid, text) from public, anon;
grant execute on function public.support_react(uuid, text) to authenticated;

create or replace function public.support_get_reactions(p_thread_id uuid)
returns table(message_id uuid, emoji text, user_id uuid)
language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare v_owner uuid;
begin
  if auth.uid() is null then raise exception 'يلزم تسجيل الدخول'; end if;
  select t.user_id into v_owner from public.support_threads t where t.id = p_thread_id;
  if v_owner is distinct from auth.uid() and not private.is_premium_admin() then raise exception 'غير مسموح'; end if;
  return query select r.message_id, r.emoji, r.user_id
    from public.support_message_reactions r join public.support_messages m on m.id = r.message_id where m.thread_id = p_thread_id;
end; $$;
revoke all on function public.support_get_reactions(uuid) from public, anon;
grant execute on function public.support_get_reactions(uuid) to authenticated;
