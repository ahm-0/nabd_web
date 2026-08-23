create or replace function public.premium_admin_set_code_active(p_id uuid, p_is_active boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not private.is_premium_admin() then raise exception 'not authorized'; end if;
  update public.premium_access_codes set is_active = p_is_active where id = p_id;
  return found;
end;
$$;
grant execute on function public.premium_admin_set_code_active(uuid,boolean) to authenticated;
