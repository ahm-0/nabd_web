-- Reliable enable/disable RPC for the admin toggle.
create or replace function public.chat_admin_set_enabled(p_enabled boolean)
returns boolean language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
  if not private.is_premium_admin() then raise exception 'لا تملك صلاحية إدارة الدردشة'; end if;
  update public.chat_platform_settings set enabled=coalesce(p_enabled,true),updated_by=auth.uid(),updated_at=now() where id=true;
  return exists(select 1 from public.chat_platform_settings where id=true and enabled=coalesce(p_enabled,true));
end; $$;
grant execute on function public.chat_admin_set_enabled(boolean) to authenticated;
