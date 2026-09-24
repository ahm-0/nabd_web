-- تمكين مشرفي الدردشة المعيّنين من تشغيل الدردشة وإدارة إعلانها وإحصائياتها.
-- تبقى إضافة وإزالة المشرفين نفسها حصرية لصاحب بوابة الإدارة.
create or replace function public.chat_admin_update_settings(p_enabled boolean, p_announcement text default null)
returns public.chat_platform_settings
language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_row public.chat_platform_settings;
begin
  if not public.chat_can_moderate() then raise exception 'لا تملك صلاحية إدارة إعدادات الدردشة'; end if;
  update public.chat_platform_settings
    set enabled=coalesce(p_enabled,enabled),
        announcement=nullif(trim(coalesce(p_announcement,announcement,'')),''),
        updated_by=auth.uid(), updated_at=now()
    where id=true returning * into v_row;
  return v_row;
end; $$;


create or replace function public.chat_admin_get_settings()
returns public.chat_platform_settings
language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_row public.chat_platform_settings;
begin
  if not public.chat_can_moderate() then raise exception 'لا تملك صلاحية قراءة إعدادات الدردشة'; end if;
  select * into v_row from public.chat_platform_settings where id=true;
  return v_row;
end; $$;

create or replace function public.chat_admin_set_enabled(p_enabled boolean)
returns boolean
language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
  if not public.chat_can_moderate() then raise exception 'لا تملك صلاحية تغيير حالة الدردشة'; end if;
  update public.chat_platform_settings
    set enabled=coalesce(p_enabled,true), updated_by=auth.uid(), updated_at=now()
    where id=true;
  return exists(select 1 from public.chat_platform_settings where id=true and enabled=coalesce(p_enabled,true));
end; $$;

create or replace function public.chat_admin_send_message(p_title text, p_body text)
returns boolean
language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if not public.chat_can_moderate() then raise exception 'لا تملك صلاحية إرسال رسائل الدردشة'; end if;
  perform public.admin_create_notification(trim(p_title),trim(p_body),null,'chat.html');
  return true;
end; $$;

grant execute on function public.chat_admin_update_settings(boolean,text) to authenticated;
grant execute on function public.chat_admin_get_settings() to authenticated;
grant execute on function public.chat_admin_set_enabled(boolean) to authenticated;
grant execute on function public.chat_admin_send_message(text,text) to authenticated;
