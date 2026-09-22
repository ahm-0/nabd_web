-- صلاحيات مشرفي الدردشة وتثبيت الرسائل
alter table if exists public.public_chat_messages add column if not exists pinned_at timestamptz;
alter table if exists public.public_chat_messages add column if not exists pinned_by uuid references auth.users(id);

create or replace function public.chat_can_moderate()
returns boolean language sql stable security definer set search_path = public, private, pg_temp as $$
  select auth.uid() is not null and (private.is_premium_admin() or exists(select 1 from public.chat_moderators where user_id=auth.uid()));
$$;

create or replace function public.chat_toggle_pin(p_message uuid, p_pinned boolean default true)
returns boolean language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if not public.chat_can_moderate() then raise exception 'لا تملك صلاحية تثبيت الرسائل'; end if;
  if p_pinned then update public.public_chat_messages set pinned_at=null, pinned_by=null where pinned_at is not null; end if;
  update public.public_chat_messages set pinned_at=case when p_pinned then now() else null end, pinned_by=case when p_pinned then auth.uid() else null end where id=p_message;
  return found;
end; $$;

grant execute on function public.chat_can_moderate() to authenticated;
grant execute on function public.chat_toggle_pin(uuid,boolean) to authenticated;

create or replace function public.chat_admin_get_stats()
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_result jsonb; begin
  if not public.chat_can_moderate() then raise exception 'لا تملك صلاحية إدارة الدردشة'; end if;
  select jsonb_build_object(
    'total_users', (select count(*) from auth.users),
    'online_users', (select count(*) from public.student_profiles where last_usage_at >= now() - interval '5 minutes'),
    'total_messages', (select count(*) from public.public_chat_messages where deleted_at is null),
    'today_messages', (select count(*) from public.public_chat_messages where deleted_at is null and created_at >= current_date),
    'private_requests', (select count(*) from public.private_chat_requests where status = 'pending'),
    'top_users', coalesce((select jsonb_agg(row_to_json(x)) from (select p.sender_id as user_id, coalesce(nullif(trim(concat_ws(' ',sp.first_name,sp.father_name,sp.family_name)),''),'طالب') as name, count(*) as messages from public.public_chat_messages p left join public.student_profiles sp on sp.user_id=p.sender_id where p.deleted_at is null group by p.sender_id,sp.first_name,sp.father_name,sp.family_name order by count(*) desc limit 8) x),'[]'::jsonb)
  ) into v_result; return v_result;
end; $$;

create or replace function public.chat_admin_update_settings(p_enabled boolean, p_announcement text default null)
returns public.chat_platform_settings language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_row public.chat_platform_settings; begin
  if not public.chat_can_moderate() then raise exception 'لا تملك صلاحية إدارة الدردشة'; end if;
  update public.chat_platform_settings set enabled=coalesce(p_enabled,enabled), announcement=nullif(trim(coalesce(p_announcement,announcement,'')),''), updated_by=auth.uid(), updated_at=now() where id=true returning * into v_row; return v_row;
end; $$;

create or replace function public.chat_admin_get_settings()
returns public.chat_platform_settings language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_row public.chat_platform_settings; begin
  if not public.chat_can_moderate() then raise exception 'لا تملك صلاحية إدارة الدردشة'; end if;
  select * into v_row from public.chat_platform_settings where id=true; return v_row;
end; $$;

create or replace function public.chat_admin_send_message(p_title text, p_body text)
returns boolean language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if not public.chat_can_moderate() then raise exception 'لا تملك صلاحية إرسال رسائل الدردشة'; end if;
  perform public.admin_create_notification(trim(p_title),trim(p_body),null,'chat.html'); return true;
end; $$;
