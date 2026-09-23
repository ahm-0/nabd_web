-- Per-user persisted reactions for public messages.
create table if not exists public.public_chat_reactions (message_id uuid not null references public.public_chat_messages(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, reaction text not null check (reaction in ('👍','❤️','😂','😮','😢','🙏')), created_at timestamptz not null default now(), primary key(message_id,user_id));
alter table public.public_chat_reactions enable row level security;
drop policy if exists "chat reactions read" on public.public_chat_reactions;
create policy "chat reactions read" on public.public_chat_reactions for select to authenticated using (true);
drop policy if exists "chat reactions own write" on public.public_chat_reactions;
create policy "chat reactions own write" on public.public_chat_reactions for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create or replace function public.chat_toggle_reaction(p_message uuid,p_reaction text) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$ begin if auth.uid() is null or p_message is null then raise exception 'التفاعل غير صالح'; end if; if p_reaction is null or p_reaction not in ('👍','❤️','😂','😮','😢','🙏') then raise exception 'التفاعل غير مدعوم'; end if; if not exists(select 1 from public.public_chat_messages where id=p_message and deleted_at is null) then raise exception 'الرسالة غير موجودة'; end if; insert into public.public_chat_reactions(message_id,user_id,reaction) values(p_message,auth.uid(),p_reaction) on conflict(message_id,user_id) do update set reaction=excluded.reaction,created_at=now(); return true; end; $$;
grant execute on function public.chat_toggle_reaction(uuid,text) to authenticated;
