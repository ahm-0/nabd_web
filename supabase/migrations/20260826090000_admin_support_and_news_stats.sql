create table if not exists public.support_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'استفسار عام',
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('student', 'admin')),
  body text not null check (char_length(trim(body)) between 1 and 700),
  created_at timestamptz not null default now()
);

create index if not exists support_threads_user_updated_idx
  on public.support_threads (user_id, updated_at desc);
create index if not exists support_threads_status_updated_idx
  on public.support_threads (status, updated_at desc);
create index if not exists support_messages_thread_created_idx
  on public.support_messages (thread_id, created_at asc);

alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;
revoke all on table public.support_threads, public.support_messages from anon, authenticated;

create or replace function public.support_send_message(p_category text, p_body text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_thread_id uuid;
  v_body text := trim(coalesce(p_body, ''));
  v_category text := nullif(trim(coalesce(p_category, '')), '');
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول أولًا'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 700 then
    raise exception 'يجب أن تكون رسالة الدعم بين حرف واحد و700 حرف';
  end if;

  select t.id into v_thread_id
  from public.support_threads t
  where t.user_id = auth.uid() and t.status = 'open'
  order by t.updated_at desc
  limit 1;

  if v_thread_id is null then
    insert into public.support_threads(user_id, category, status)
    values (auth.uid(), coalesce(v_category, 'استفسار عام'), 'open')
    returning id into v_thread_id;
  else
    update public.support_threads
       set category = coalesce(v_category, category), status = 'open', updated_at = now()
     where id = v_thread_id;
  end if;

  insert into public.support_messages(thread_id, sender_id, sender_role, body)
  values (v_thread_id, auth.uid(), 'student', v_body);
  update public.support_threads set updated_at = now() where id = v_thread_id;
  return v_thread_id;
end;
$$;

create or replace function public.support_get_my_thread()
returns jsonb
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select coalesce((
    select jsonb_build_object(
      'id', t.id,
      'category', t.category,
      'status', t.status,
      'created_at', t.created_at,
      'updated_at', t.updated_at,
      'messages', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', m.id,
          'sender', m.sender_role,
          'text', m.body,
          'created_at', m.created_at
        ) order by m.created_at asc)
        from public.support_messages m
        where m.thread_id = t.id
      ), '[]'::jsonb)
    )
    from public.support_threads t
    where t.user_id = auth.uid()
    order by t.updated_at desc
    limit 1
  ), '{}'::jsonb);
$$;

create or replace function public.admin_list_support_threads(p_limit integer default 100)
returns table (
  id uuid,
  user_id uuid,
  name text,
  email text,
  category text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  message_count bigint,
  messages jsonb
)
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
begin
  if auth.uid() is null or not private.is_premium_admin() then
    raise exception 'لا تملك صلاحية عرض صندوق الدعم';
  end if;

  return query
  select t.id,
         t.user_id,
         coalesce(nullif(trim(concat_ws(' ', sp.first_name, sp.father_name, sp.family_name)), ''), 'طالب نبض') as name,
         au.email::text,
         t.category,
         t.status,
         t.created_at,
         t.updated_at,
         (select count(*) from public.support_messages m where m.thread_id = t.id) as message_count,
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'id', m.id,
             'sender', m.sender_role,
             'text', m.body,
             'created_at', m.created_at
           ) order by m.created_at asc)
           from public.support_messages m
           where m.thread_id = t.id
         ), '[]'::jsonb) as messages
  from public.support_threads t
  left join public.student_profiles sp on sp.user_id = t.user_id
  left join auth.users au on au.id = t.user_id
  order by t.updated_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 200));
end;
$$;

create or replace function public.support_admin_reply(p_thread_id uuid, p_body text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_body text := trim(coalesce(p_body, ''));
begin
  if auth.uid() is null or not private.is_premium_admin() then
    raise exception 'لا تملك صلاحية الرد على رسائل الدعم';
  end if;
  if p_thread_id is null or not exists (select 1 from public.support_threads t where t.id = p_thread_id) then
    raise exception 'محادثة الدعم غير موجودة';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 700 then
    raise exception 'يجب أن يكون الرد بين حرف واحد و700 حرف';
  end if;

  insert into public.support_messages(thread_id, sender_id, sender_role, body)
  values (p_thread_id, auth.uid(), 'admin', v_body);
  update public.support_threads set status = 'resolved', updated_at = now() where id = p_thread_id;
  return true;
end;
$$;

create or replace function public.admin_list_news_activity(p_limit integer default 60)
returns table (
  kind text,
  id uuid,
  post_id uuid,
  author_name text,
  body text,
  post_body text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
begin
  if auth.uid() is null or not private.is_premium_admin() then
    raise exception 'لا تملك صلاحية عرض نشاط الأخبار';
  end if;

  return query
  with activity as (
    select 'post'::text as kind, n.id, n.id as post_id, n.author_name, n.body, n.body as post_body, n.created_at
    from public.news_posts n
    union all
    select 'comment'::text as kind, c.id, c.post_id, c.author_name, c.body, n.body as post_body, c.created_at
    from public.news_post_comments c
    join public.news_posts n on n.id = c.post_id
  )
  select activity.kind, activity.id, activity.post_id, activity.author_name, activity.body, activity.post_body, activity.created_at
  from activity
  order by activity.created_at desc
  limit greatest(1, least(coalesce(p_limit, 60), 120));
end;
$$;

create or replace function public.admin_get_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول أولًا'; end if;
  if not private.is_premium_admin() then raise exception 'لا تملك صلاحية عرض إحصائيات الإدارة'; end if;
  return jsonb_build_object(
    'total_users', (select count(*) from auth.users),
    'total_notifications', (select count(*) from public.notifications where is_active = true),
    'unread_marks', (select count(*) from public.notification_reads),
    'total_news_posts', (select count(*) from public.news_posts),
    'total_news_comments', (select count(*) from public.news_post_comments),
    'total_support_threads', (select count(*) from public.support_threads),
    'total_support_messages', (select count(*) from public.support_messages),
    'open_support_threads', (select count(*) from public.support_threads where status = 'open')
  );
end;
$$;

revoke execute on function public.support_send_message(text, text) from public, anon;
revoke execute on function public.support_get_my_thread() from public, anon;
revoke execute on function public.admin_list_support_threads(integer) from public, anon;
revoke execute on function public.support_admin_reply(uuid, text) from public, anon;
revoke execute on function public.admin_list_news_activity(integer) from public, anon;
revoke execute on function public.admin_get_dashboard_stats() from public, anon;

grant execute on function public.support_send_message(text, text) to authenticated;
grant execute on function public.support_get_my_thread() to authenticated;
grant execute on function public.admin_list_support_threads(integer) to authenticated;
grant execute on function public.support_admin_reply(uuid, text) to authenticated;
grant execute on function public.admin_list_news_activity(integer) to authenticated;
grant execute on function public.admin_get_dashboard_stats() to authenticated;
