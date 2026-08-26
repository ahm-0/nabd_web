create or replace function public.admin_list_notifications(p_limit integer default 100)
returns table (
  id uuid,
  title text,
  body text,
  created_at timestamptz,
  is_active boolean
)
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
begin
  if auth.uid() is null or not private.is_premium_admin() then
    raise exception 'لا تملك صلاحية عرض إشعارات الإدارة';
  end if;

  return query
  select n.id, n.title, n.body, n.created_at, n.is_active
  from public.notifications n
  where n.is_active = true
  order by n.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 200));
end;
$$;

create or replace function public.admin_delete_notification(p_notification_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, private, pg_temp
as $$
begin
  if auth.uid() is null or not private.is_premium_admin() then
    raise exception 'لا تملك صلاحية حذف الإشعارات';
  end if;
  if p_notification_id is null then
    raise exception 'معرّف الإشعار غير صالح';
  end if;

  update public.notifications
     set is_active = false
   where id = p_notification_id and is_active = true;

  if not found then
    raise exception 'الإشعار غير موجود أو تمت إزالته مسبقًا';
  end if;
  return true;
end;
$$;

revoke execute on function public.admin_list_notifications(integer) from public, anon;
revoke execute on function public.admin_delete_notification(uuid) from public, anon;
grant execute on function public.admin_list_notifications(integer) to authenticated;
grant execute on function public.admin_delete_notification(uuid) to authenticated;
