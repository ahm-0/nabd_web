create or replace function public.premium_redeem_access_code(p_code text)
returns table(success boolean, message text, access_type text, teacher_id uuid, file_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  current_user_id uuid := auth.uid();
  hashed_code text := md5(lower(trim(coalesce(p_code, ''))));
  access_row public.premium_access_codes%rowtype;
  granted_teacher uuid;
  granted_file uuid;
begin
  if current_user_id is null then return query select false, 'يجب تسجيل الدخول أولاً', null::text, null::uuid, null::uuid; return; end if;
  if trim(coalesce(p_code, '')) = '' then return query select false, 'أدخل كود الوصول', null::text, null::uuid, null::uuid; return; end if;
  select * into access_row from public.premium_access_codes pac where pac.code_hash = hashed_code and pac.is_active for update;
  if not found then return query select false, 'كود الوصول غير صحيح أو معطل', null::text, null::uuid, null::uuid; return; end if;
  if access_row.expires_at is not null and access_row.expires_at <= now() then return query select false, 'انتهت صلاحية كود الوصول', null::text, null::uuid, null::uuid; return; end if;
  if access_row.max_uses > 0 and access_row.uses_count >= access_row.max_uses then return query select false, 'تم استنفاد استخدامات هذا الكود', null::text, null::uuid, null::uuid; return; end if;
  if access_row.code_type = 'file' and exists (select 1 from public.user_access ua where ua.user_id = current_user_id and ua.file_id = access_row.file_id and (ua.expires_at is null or ua.expires_at > now())) then return query select true, 'لديك صلاحية وصول لهذا الملف مسبقاً', 'file', null::uuid, access_row.file_id; return; end if;
  if access_row.code_type = 'teacher_bundle' and exists (select 1 from public.user_access ua where ua.user_id = current_user_id and ua.teacher_id = access_row.teacher_id and (ua.expires_at is null or ua.expires_at > now())) then return query select true, 'لديك صلاحية شاملة لهذا الأستاذ مسبقاً', 'teacher_bundle', access_row.teacher_id, null::uuid; return; end if;
  if access_row.code_type = 'file' then
    granted_file := access_row.file_id;
    insert into public.user_access(user_id, access_type, file_id, access_code_id, expires_at) values (current_user_id, 'file', granted_file, access_row.id, access_row.expires_at) on conflict do nothing;
  else
    granted_teacher := access_row.teacher_id;
    insert into public.user_access(user_id, access_type, teacher_id, access_code_id, expires_at) values (current_user_id, 'teacher_bundle', granted_teacher, access_row.id, access_row.expires_at) on conflict do nothing;
  end if;
  insert into public.access_code_usage(access_code_id, user_id, file_id, teacher_id) values (access_row.id, current_user_id, granted_file, granted_teacher);
  update public.premium_access_codes pac set uses_count = pac.uses_count + 1 where pac.id = access_row.id;
  return query select true, 'تم تفعيل كود الوصول بنجاح', access_row.code_type, granted_teacher, granted_file;
end;
$$;

revoke execute on function public.premium_redeem_access_code(text) from public, anon;
grant execute on function public.premium_redeem_access_code(text) to authenticated;
