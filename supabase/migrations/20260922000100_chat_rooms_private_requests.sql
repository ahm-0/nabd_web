-- نبض التفوق: طبقة الدردشة العامة والخاصة وطلبات المحادثة
create table if not exists public.chat_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  private_chat_enabled boolean not null default true,
  chat_notifications_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.public_chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  reply_to_id uuid references public.public_chat_messages(id) on delete set null,
  reaction text check (reaction is null or reaction in ('👍','❤️','😂','😮','😢','🙏')),
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists public_chat_messages_created_idx on public.public_chat_messages(created_at desc);
create index if not exists public_chat_messages_sender_idx on public.public_chat_messages(sender_id);

create table if not exists public.private_chat_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint private_chat_requests_different_users check (sender_id <> recipient_id)
);
create unique index if not exists private_chat_pending_unique on public.private_chat_requests(sender_id, recipient_id) where status = 'pending';
create index if not exists private_chat_requests_recipient_idx on public.private_chat_requests(recipient_id, status, created_at desc);

create table if not exists public.private_chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  constraint private_chat_threads_different_users check (user_a <> user_b)
);
create unique index if not exists private_chat_threads_pair_unique on public.private_chat_threads(least(user_a,user_b), greatest(user_a,user_b));

create table if not exists public.private_chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.private_chat_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  reply_to_id uuid references public.private_chat_messages(id) on delete set null,
  reaction text check (reaction is null or reaction in ('👍','❤️','😂','😮','😢','🙏')),
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists private_chat_messages_thread_idx on public.private_chat_messages(thread_id, created_at);

alter table public.chat_settings enable row level security;
alter table public.public_chat_messages enable row level security;
alter table public.private_chat_requests enable row level security;
alter table public.private_chat_threads enable row level security;
alter table public.private_chat_messages enable row level security;

drop policy if exists "chat settings own" on public.chat_settings;
create policy "chat settings own" on public.chat_settings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "public chat read" on public.public_chat_messages;
create policy "public chat read" on public.public_chat_messages for select to authenticated using (deleted_at is null);
drop policy if exists "public chat insert own" on public.public_chat_messages;
create policy "public chat insert own" on public.public_chat_messages for insert to authenticated with check (sender_id = auth.uid());
drop policy if exists "public chat update own" on public.public_chat_messages;
create policy "public chat update own" on public.public_chat_messages for update to authenticated using (sender_id = auth.uid()) with check (sender_id = auth.uid());
drop policy if exists "public chat delete own" on public.public_chat_messages;
create policy "public chat delete own" on public.public_chat_messages for delete to authenticated using (sender_id = auth.uid());
drop policy if exists "private requests participants" on public.private_chat_requests;
create policy "private requests participants" on public.private_chat_requests for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());
drop policy if exists "private requests sender" on public.private_chat_requests;
create policy "private requests sender" on public.private_chat_requests for insert to authenticated with check (sender_id = auth.uid() and sender_id <> recipient_id);
drop policy if exists "private requests recipient update" on public.private_chat_requests;
create policy "private requests recipient update" on public.private_chat_requests for update to authenticated using (recipient_id = auth.uid() or sender_id = auth.uid()) with check (recipient_id = auth.uid() or sender_id = auth.uid());
drop policy if exists "private threads participants" on public.private_chat_threads;
create policy "private threads participants" on public.private_chat_threads for select to authenticated using (user_a = auth.uid() or user_b = auth.uid());
drop policy if exists "private messages participants" on public.private_chat_messages;
create policy "private messages participants" on public.private_chat_messages for select to authenticated using (exists (select 1 from public.private_chat_threads t where t.id = thread_id and (t.user_a = auth.uid() or t.user_b = auth.uid())) and deleted_at is null);
drop policy if exists "private messages sender" on public.private_chat_messages;
create policy "private messages sender" on public.private_chat_messages for insert to authenticated with check (sender_id = auth.uid() and exists (select 1 from public.private_chat_threads t where t.id = thread_id and (t.user_a = auth.uid() or t.user_b = auth.uid())));
drop policy if exists "private messages update own" on public.private_chat_messages;
create policy "private messages update own" on public.private_chat_messages for update to authenticated using (sender_id = auth.uid()) with check (sender_id = auth.uid());

create or replace function public.chat_get_or_create_thread(p_other_user uuid)
returns public.private_chat_threads
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_thread public.private_chat_threads; v_a uuid; v_b uuid;
begin
  if auth.uid() is null or p_other_user is null or p_other_user = auth.uid() then raise exception 'مستخدم الدردشة غير صالح'; end if;
  v_a := least(auth.uid(), p_other_user); v_b := greatest(auth.uid(), p_other_user);
  select * into v_thread from public.private_chat_threads where user_a = v_a and user_b = v_b limit 1;
  if v_thread.id is null then
    insert into public.private_chat_threads(user_a,user_b) values(v_a,v_b) returning * into v_thread;
  end if;
  return v_thread;
end; $$;

create or replace function public.chat_send_private_request(p_recipient uuid)
returns public.private_chat_requests
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.private_chat_requests; v_enabled boolean;
begin
  if auth.uid() is null or p_recipient is null or p_recipient = auth.uid() then raise exception 'طلب الدردشة غير صالح'; end if;
  select coalesce(private_chat_enabled,true) into v_enabled from public.chat_settings where user_id = p_recipient;
  if v_enabled is false then
    raise exception 'هذا الطالب لا يستقبل طلبات الدردشة الخاصة حاليًا';
  end if;
  select * into v_row from public.private_chat_requests where sender_id=auth.uid() and recipient_id=p_recipient and status='pending' limit 1;
  if v_row.id is not null then return v_row; end if;
  insert into public.private_chat_requests(sender_id,recipient_id) values(auth.uid(),p_recipient) returning * into v_row;
  return v_row;
end; $$;

create or replace function public.chat_respond_private_request(p_request uuid, p_accept boolean)
returns public.private_chat_requests
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.private_chat_requests;
begin
  update public.private_chat_requests set status = case when p_accept then 'accepted' else 'rejected' end, updated_at=now() where id=p_request and recipient_id=auth.uid() and status='pending' returning * into v_row;
  if v_row.id is null then raise exception 'طلب الدردشة غير متاح'; end if;
  if p_accept then perform public.chat_get_or_create_thread(v_row.sender_id); end if;
  return v_row;
end; $$;

grant execute on function public.chat_get_or_create_thread(uuid) to authenticated;
grant execute on function public.chat_send_private_request(uuid) to authenticated;
grant execute on function public.chat_respond_private_request(uuid,boolean) to authenticated;
