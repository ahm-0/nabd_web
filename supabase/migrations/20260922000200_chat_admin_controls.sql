-- أدوات إدارة دردشة نبض التفوق
create table if not exists public.chat_moderators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.chat_platform_settings (
  id boolean primary key default true check (id = true),
  enabled boolean not null default true,
  announcement text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
insert into public.chat_platform_settings(id) values(true) on conflict(id) do nothing;
alter table public.chat_moderators enable row level security;
alter table public.chat_platform_settings enable row level security;

create or replace function public.chat_is_moderator_or_admin()
returns boolean language sql stable security definer set search_path = public, private, pg_temp as $$
  select auth.uid() is not null and (private.is_premium_admin() or exists(select 1 from public.chat_moderators where user_id = auth.uid()));
$$;

create or replace function public.chat_admin_get_stats()
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_result jsonb; begin
  if not private.is_premium_admin() then raise exception 'لا تملك صلاحية إدارة الدردشة'; end if;
  select jsonb_build_object(
    'total_users', (select count(*) from auth.users),
    'online_users', (select count(*) from public.student_profiles where last_usage_at >= now() - interval '5 minutes'),
    'total_messages', (select count(*) from public.public_chat_messages where deleted_at is null),
    'today_messages', (select count(*) from public.public_chat_messages where deleted_at is null and created_at >= current_date),
    'private_requests', (select count(*) from public.private_chat_requests where status = 'pending'),
    'top_users', coalesce((select jsonb_agg(row_to_json(x)) from (select p.sender_id as user_id, coalesce(nullif(trim(concat_ws(' ',sp.first_name,sp.father_name,sp.family_name)),''),'طالب') as name, count(*) as messages from public.public_chat_messages p left join public.student_profiles sp on sp.user_id=p.sender_id where p.deleted_at is null group by p.sender_id,sp.first_name,sp.father_name,sp.family_name order by count(*) desc limit 8) x),'[]'::jsonb)
  ) into v_result; return v_result;
end; $$;

create or replace function public.chat_admin_list_moderators()
returns table(user_id uuid, email text, name text, created_at timestamptz)
language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if not private.is_premium_admin() then raise exception 'لا تملك صلاحية إدارة الدردشة'; end if;
  return query select m.user_id, u.email, coalesce(nullif(trim(concat_ws(' ',sp.first_name,sp.father_name,sp.family_name)),''),'مستخدم') as name, m.created_at from public.chat_moderators m join auth.users u on u.id=m.user_id left join public.student_profiles sp on sp.user_id=m.user_id order by m.created_at desc;
end; $$;

create or replace function public.chat_admin_set_moderator(p_user_ref text, p_enabled boolean default true)
returns boolean language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_user uuid; begin
  if not private.is_premium_admin() then raise exception 'لا تملك صلاحية إدارة الدردشة'; end if;
  begin v_user := p_user_ref::uuid; exception when others then select id into v_user from auth.users where lower(email)=lower(trim(p_user_ref)) limit 1; end;
  if v_user is null then raise exception 'لم يتم العثور على مستخدم بهذا البريد أو المعرف'; end if;
  if p_enabled then insert into public.chat_moderators(user_id,created_by) values(v_user,auth.uid()) on conflict(user_id) do nothing; else delete from public.chat_moderators where user_id=v_user; end if;
  return true;
end; $$;

create or replace function public.chat_admin_update_settings(p_enabled boolean, p_announcement text default null)
returns public.chat_platform_settings language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_row public.chat_platform_settings; begin
  if not private.is_premium_admin() then raise exception 'لا تملك صلاحية إدارة الدردشة'; end if;
  update public.chat_platform_settings set enabled=coalesce(p_enabled,enabled), announcement=nullif(trim(coalesce(p_announcement,announcement,'')),''), updated_by=auth.uid(), updated_at=now() where id=true returning * into v_row; return v_row;
end; $$;

create or replace function public.chat_admin_get_settings()
returns public.chat_platform_settings language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_row public.chat_platform_settings;
begin
  if not private.is_premium_admin() then raise exception 'لا تملك صلاحية إدارة الدردشة'; end if;
  select * into v_row from public.chat_platform_settings where id=true;
  return v_row;
end; $$;

create or replace function public.chat_admin_send_message(p_title text, p_body text)
returns boolean language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if not private.is_premium_admin() then raise exception 'لا تملك صلاحية إرسال رسائل الدردشة'; end if;
  perform public.admin_create_notification(trim(p_title),trim(p_body),null,'chat.html'); return true;
end; $$;

create or replace function public.chat_get_platform_settings()
returns table(enabled boolean, announcement text)
language sql stable security definer set search_path = public, pg_temp as $$
  select s.enabled, s.announcement from public.chat_platform_settings s where s.id=true;
$$;

grant execute on function public.chat_admin_get_stats() to authenticated;
grant execute on function public.chat_admin_list_moderators() to authenticated;
grant execute on function public.chat_admin_set_moderator(text,boolean) to authenticated;
grant execute on function public.chat_admin_update_settings(boolean,text) to authenticated;
grant execute on function public.chat_admin_get_settings() to authenticated;
grant execute on function public.chat_admin_send_message(text,text) to authenticated;
grant execute on function public.chat_get_platform_settings() to authenticated;
