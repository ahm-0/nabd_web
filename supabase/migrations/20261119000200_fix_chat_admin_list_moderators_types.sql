-- إصلاح: عمود البريد (varchar) لا يطابق النوع text فكانت قائمة مشرفي الدردشة تفشل.
create or replace function public.chat_admin_list_moderators()
returns table(user_id uuid, email text, name text, created_at timestamptz)
language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if not private.is_premium_admin() then raise exception 'لا تملك صلاحية إدارة الدردشة'; end if;
  return query select m.user_id, u.email::text, coalesce(nullif(trim(concat_ws(' ', sp.first_name, sp.father_name, sp.family_name)), ''), 'مستخدم'), m.created_at
    from public.chat_moderators m join auth.users u on u.id = m.user_id left join public.student_profiles sp on sp.user_id = m.user_id order by m.created_at desc;
end; $$;
