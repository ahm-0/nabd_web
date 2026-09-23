-- Total registered application users for the public chat header.
create or replace function public.chat_get_total_users()
returns bigint language sql stable security definer set search_path=public,pg_temp as $$
  select count(*)::bigint from auth.users;
$$;
grant execute on function public.chat_get_total_users() to authenticated;
