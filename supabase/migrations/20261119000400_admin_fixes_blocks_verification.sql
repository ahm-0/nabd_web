-- 1) حظر المستخدمين في الدردشة الخاصة -------------------------------------------------
create table if not exists public.chat_user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists chat_user_blocks_blocked_idx on public.chat_user_blocks (blocked_id);
alter table public.chat_user_blocks enable row level security;
revoke all on table public.chat_user_blocks from anon, authenticated;

create or replace function private.chat_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.chat_user_blocks x where (x.blocker_id = a and x.blocked_id = b) or (x.blocker_id = b and x.blocked_id = a));
$$;

create or replace function public.chat_set_block(p_user uuid, p_blocked boolean)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or p_user is null or p_user = auth.uid() then raise exception 'مستخدم غير صالح'; end if;
  if coalesce(p_blocked, true) then
    insert into public.chat_user_blocks(blocker_id, blocked_id) values (auth.uid(), p_user) on conflict do nothing;
  else
    delete from public.chat_user_blocks where blocker_id = auth.uid() and blocked_id = p_user;
  end if;
  return coalesce(p_blocked, true);
end; $$;
revoke all on function public.chat_set_block(uuid, boolean) from public, anon;
grant execute on function public.chat_set_block(uuid, boolean) to authenticated;

create or replace function public.chat_list_blocks()
returns table(user_id uuid, blocked_by_me boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select b.blocked_id, true from public.chat_user_blocks b where b.blocker_id = auth.uid()
  union all
  select b.blocker_id, false from public.chat_user_blocks b where b.blocked_id = auth.uid();
$$;
revoke all on function public.chat_list_blocks() from public, anon;
grant execute on function public.chat_list_blocks() to authenticated;

create or replace function public.chat_get_or_create_thread(p_other_user uuid)
returns private_chat_threads language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_thread public.private_chat_threads; v_a uuid; v_b uuid; v_enabled boolean;
begin
  if auth.uid() is null or p_other_user is null or p_other_user = auth.uid() then raise exception 'مستخدم الدردشة غير صالح'; end if;
  v_a := least(auth.uid(), p_other_user); v_b := greatest(auth.uid(), p_other_user);
  select * into v_thread from public.private_chat_threads where user_a = v_a and user_b = v_b limit 1;
  if v_thread.id is null then
    if private.chat_blocked_between(auth.uid(), p_other_user) then raise exception 'لا يمكنك مراسلة هذا المستخدم'; end if;
    select coalesce(private_chat_enabled, true) into v_enabled from public.chat_settings where user_id = p_other_user;
    if v_enabled is false then raise exception 'هذا الطالب لا يستقبل الدردشة الخاصة حاليًا'; end if;
    insert into public.private_chat_threads(user_a, user_b) values (v_a, v_b) returning * into v_thread;
  end if;
  return v_thread;
end; $$;

create or replace function public.chat_send_private_request(p_recipient uuid)
returns private_chat_requests language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_row public.private_chat_requests; v_enabled boolean;
begin
  if auth.uid() is null or p_recipient is null or p_recipient = auth.uid() then raise exception 'طلب الدردشة غير صالح'; end if;
  if private.chat_blocked_between(auth.uid(), p_recipient) then raise exception 'لا يمكنك مراسلة هذا المستخدم'; end if;
  select coalesce(private_chat_enabled, true) into v_enabled from public.chat_settings where user_id = p_recipient;
  if v_enabled is false then raise exception 'هذا الطالب لا يستقبل طلبات الدردشة الخاصة حاليًا'; end if;
  select * into v_row from public.private_chat_requests where sender_id = auth.uid() and recipient_id = p_recipient and status = 'pending' limit 1;
  if v_row.id is not null then return v_row; end if;
  insert into public.private_chat_requests(sender_id, recipient_id) values (auth.uid(), p_recipient) returning * into v_row;
  return v_row;
end; $$;

create or replace function public.chat_send_private_message(p_thread_id uuid, p_body text)
returns private_chat_messages language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_row public.private_chat_messages; v_other uuid;
begin
  if auth.uid() is null or p_thread_id is null or char_length(trim(coalesce(p_body, ''))) = 0 then raise exception 'الرسالة الخاصة غير صالحة'; end if;
  select case when t.user_a = auth.uid() then t.user_b else t.user_a end into v_other from public.private_chat_threads t where t.id = p_thread_id and (t.user_a = auth.uid() or t.user_b = auth.uid());
  if v_other is null then raise exception 'لا تملك صلاحية إرسال الرسالة'; end if;
  if private.chat_blocked_between(auth.uid(), v_other) then raise exception 'لا يمكنك مراسلة هذا المستخدم'; end if;
  insert into public.private_chat_messages(thread_id, sender_id, body) values (p_thread_id, auth.uid(), trim(p_body)) returning * into v_row;
  update public.private_chat_threads set last_message_at = now() where id = p_thread_id;
  return v_row;
end; $$;

create or replace function public.chat_send_private_v2(p_thread_id uuid, p_body text, p_reply_to uuid default null, p_id uuid default null)
returns private_chat_messages language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_row public.private_chat_messages; v_body text := trim(coalesce(p_body, '')); v_other uuid;
begin
  if auth.uid() is null or p_thread_id is null or char_length(v_body) not between 1 and 1000 then raise exception 'الرسالة الخاصة غير صالحة'; end if;
  select case when t.user_a = auth.uid() then t.user_b else t.user_a end into v_other from public.private_chat_threads t where t.id = p_thread_id and (t.user_a = auth.uid() or t.user_b = auth.uid());
  if v_other is null then raise exception 'لا تملك صلاحية إرسال الرسالة'; end if;
  if private.chat_blocked_between(auth.uid(), v_other) then raise exception 'لا يمكنك مراسلة هذا المستخدم'; end if;
  if p_reply_to is not null and not exists(select 1 from public.private_chat_messages r where r.id = p_reply_to and r.thread_id = p_thread_id) then p_reply_to := null; end if;
  insert into public.private_chat_messages(id, thread_id, sender_id, body, reply_to_id)
  values (coalesce(p_id, gen_random_uuid()), p_thread_id, auth.uid(), v_body, p_reply_to)
  on conflict (id) do nothing returning * into v_row;
  if v_row.id is null then select * into v_row from public.private_chat_messages where id = p_id and sender_id = auth.uid();
  else update public.private_chat_threads set last_message_at = v_row.created_at where id = p_thread_id; end if;
  return v_row;
end; $$;

-- 2) طلبات التوثيق في جدول مستقل (لا تضيع عند اختلاط تذاكر الدعم) ------------------------
create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id)
);
create index if not exists verification_requests_status_idx on public.verification_requests (status, created_at desc);
create unique index if not exists verification_requests_one_pending on public.verification_requests (user_id) where status = 'pending';
alter table public.verification_requests enable row level security;
revoke all on table public.verification_requests from anon, authenticated;

create or replace function public.verification_submit(p_reason text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول أولًا'; end if;
  if exists (select 1 from public.student_profiles where user_id = auth.uid() and is_verified) then raise exception 'حسابك موثّق بالفعل'; end if;
  select id into v_id from public.verification_requests where user_id = auth.uid() and status = 'pending';
  if v_id is null then
    insert into public.verification_requests(user_id, reason) values (auth.uid(), left(nullif(trim(coalesce(p_reason, '')), ''), 500)) returning id into v_id;
  end if;
  return v_id;
end; $$;
revoke all on function public.verification_submit(text) from public, anon;
grant execute on function public.verification_submit(text) to authenticated;

create or replace function public.verification_my_status()
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select case when exists (select 1 from public.student_profiles where user_id = auth.uid() and is_verified) then 'approved'
    else coalesce((select v.status from public.verification_requests v where v.user_id = auth.uid() order by v.created_at desc limit 1), 'none') end;
$$;
revoke all on function public.verification_my_status() from public, anon;
grant execute on function public.verification_my_status() to authenticated;

create or replace function public.admin_list_verification_requests(p_limit integer default 100)
returns table(id uuid, user_id uuid, name text, email text, avatar_url text, stage text, reason text, status text, created_at timestamptz)
language plpgsql stable security definer set search_path = public, private, pg_temp as $$
begin
  if not private.is_premium_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  select v.id, v.user_id, coalesce(nullif(trim(concat_ws(' ', sp.first_name, sp.father_name, sp.family_name)), ''), 'طالب نبض'), au.email::text, sp.avatar_thumb, sp.study_stage, v.reason, v.status, v.created_at
  from public.verification_requests v left join public.student_profiles sp on sp.user_id = v.user_id left join auth.users au on au.id = v.user_id
  order by (v.status = 'pending') desc, v.created_at desc limit greatest(1, least(coalesce(p_limit, 100), 300));
end; $$;
revoke all on function public.admin_list_verification_requests(integer) from public, anon;
grant execute on function public.admin_list_verification_requests(integer) to authenticated;

create or replace function public.admin_decide_verification(p_id uuid, p_approve boolean, p_type text default 'verified')
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_user uuid;
begin
  if not private.is_premium_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.verification_requests set status = case when p_approve then 'approved' else 'rejected' end, decided_at = now(), decided_by = auth.uid()
   where id = p_id returning user_id into v_user;
  if v_user is null then raise exception 'الطلب غير موجود'; end if;
  if p_approve then
    update public.student_profiles set is_verified = true, verification_type = case when p_type in ('verified','admin','teacher','developer') then p_type else 'verified' end where user_id = v_user;
  end if;
end; $$;
revoke all on function public.admin_decide_verification(uuid, boolean, text) from public, anon;
grant execute on function public.admin_decide_verification(uuid, boolean, text) to authenticated;

-- 3) دليل المستخدمين مع الأدوار + بحث وترقيم -----------------------------------------------
create or replace function public.admin_users_directory_v2(p_search text default null, p_limit integer default 60, p_offset integer default 0)
returns table(user_id uuid, name text, email text, avatar_url text, stage text, province text, is_verified boolean, verification_type text, is_banned boolean, is_admin boolean, is_assistant boolean, created_at timestamptz, total bigint)
language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare q text := nullif(trim(coalesce(p_search, '')), '');
begin
  if not private.is_premium_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  select au.id,
         coalesce(nullif(trim(concat_ws(' ', sp.first_name, sp.father_name, sp.family_name)), ''), 'طالب نبض'),
         au.email::text, coalesce(sp.avatar_thumb, sp.avatar_url), sp.study_stage, coalesce(sp.province, sp.governorate),
         coalesce(sp.is_verified, false), sp.verification_type,
         exists(select 1 from public.chat_user_bans b where b.user_id = au.id and (b.expires_at is null or b.expires_at > now())),
         exists(select 1 from public.admin_users a where a.user_id = au.id and a.is_active and a.role in ('admin','editor')),
         exists(select 1 from public.chat_moderators m where m.user_id = au.id),
         au.created_at,
         count(*) over()
  from auth.users au left join public.student_profiles sp on sp.user_id = au.id
  where q is null or au.email ilike '%' || q || '%' or concat_ws(' ', sp.first_name, sp.father_name, sp.family_name) ilike '%' || q || '%'
  order by au.created_at desc
  limit greatest(1, least(coalesce(p_limit, 60), 200)) offset greatest(0, coalesce(p_offset, 0));
end; $$;
revoke all on function public.admin_users_directory_v2(text, integer, integer) from public, anon;
grant execute on function public.admin_users_directory_v2(text, integer, integer) to authenticated;

-- 4) منح/سحب الصلاحيات --------------------------------------------------------------------
create or replace function public.admin_set_user_role(p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if not private.is_premium_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_user_id is null then raise exception 'مستخدم غير صالح'; end if;
  if p_role = 'admin' then
    insert into public.admin_users(user_id, role, is_active) values (p_user_id, 'admin', true)
    on conflict (user_id) do update set role = 'admin', is_active = true;
    update public.student_profiles set is_verified = true, verification_type = 'admin' where user_id = p_user_id;
  elsif p_role = 'assistant' then
    insert into public.chat_moderators(user_id, created_by) values (p_user_id, auth.uid()) on conflict do nothing;
  elsif p_role = 'teacher' then
    update public.student_profiles set is_verified = true, verification_type = 'teacher' where user_id = p_user_id;
  elsif p_role = 'none' then
    if p_user_id = auth.uid() then raise exception 'لا يمكنك سحب صلاحياتك بنفسك'; end if;
    if exists (select 1 from public.admin_users where user_id = p_user_id and is_active)
       and not exists (select 1 from public.admin_users where user_id <> p_user_id and is_active and role in ('admin','editor')) then
      raise exception 'لا يمكن سحب صلاحية آخر أدمن';
    end if;
    delete from public.admin_users where user_id = p_user_id;
    delete from public.chat_moderators where user_id = p_user_id;
    update public.student_profiles set is_verified = false, verification_type = null where user_id = p_user_id and verification_type in ('admin','teacher');
  else
    raise exception 'صلاحية غير معروفة';
  end if;
end; $$;
revoke all on function public.admin_set_user_role(uuid, text) from public, anon;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;

create or replace function public.admin_list_staff()
returns table(user_id uuid, name text, email text, avatar_url text, role text, created_at timestamptz)
language plpgsql stable security definer set search_path = public, private, pg_temp as $$
begin
  if not private.is_premium_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  select s.uid, coalesce(nullif(trim(concat_ws(' ', sp.first_name, sp.father_name, sp.family_name)), ''), 'مشرف'), au.email::text, coalesce(sp.avatar_thumb, sp.avatar_url), s.role, s.created_at
  from (select a.user_id as uid, a.role, a.created_at from public.admin_users a where a.is_active
        union all select m.user_id, 'assistant', m.created_at from public.chat_moderators m where not exists (select 1 from public.admin_users a2 where a2.user_id = m.user_id and a2.is_active)) s
  left join public.student_profiles sp on sp.user_id = s.uid left join auth.users au on au.id = s.uid
  order by (s.role = 'assistant'), s.created_at;
end; $$;
revoke all on function public.admin_list_staff() from public, anon;
grant execute on function public.admin_list_staff() to authenticated;

-- 5) عدّادات لوحة المشرف: دعم ينتظر الرد + توثيق معلّق في الاستدعاء السريع نفسه ---------------
create or replace function public.admin_support_pending()
returns integer language plpgsql stable security definer set search_path = public, private, pg_temp as $$
begin
  if not private.is_premium_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return (select count(*)::integer from public.support_threads t where t.status = 'open'
    and (select m.sender_role from public.support_messages m where m.thread_id = t.id order by m.created_at desc limit 1) = 'student');
end; $$;
revoke all on function public.admin_support_pending() from public, anon;
grant execute on function public.admin_support_pending() to authenticated;

create or replace function public.admin_verify_pending()
returns integer language plpgsql stable security definer set search_path = public, private, pg_temp as $$
begin
  if not private.is_premium_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return (select count(*)::integer from public.verification_requests where status = 'pending');
end; $$;
revoke all on function public.admin_verify_pending() from public, anon;
grant execute on function public.admin_verify_pending() to authenticated;

-- 6) فهارس للأداء -------------------------------------------------------------------------
create index if not exists public_chat_messages_sender_created_idx on public.public_chat_messages (sender_id, created_at desc);
create index if not exists student_profiles_last_usage_idx on public.student_profiles (last_usage_at desc) where last_usage_at is not null;
create index if not exists student_profiles_verified_idx on public.student_profiles (user_id) where is_verified;
create index if not exists private_chat_threads_a_idx on public.private_chat_threads (user_a, last_message_at desc);
create index if not exists private_chat_threads_b_idx on public.private_chat_threads (user_b, last_message_at desc);
