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
  select * into access_row from public.premium_access_codes where code_hash = hashed_code and is_active for update;
  if not found then return query select false, 'كود الوصول غير صحيح أو معطل', null::text, null::uuid, null::uuid; return; end if;
  if access_row.expires_at is not null and access_row.expires_at <= now() then return query select false, 'انتهت صلاحية كود الوصول', null::text, null::uuid, null::uuid; return; end if;
  if access_row.max_uses > 0 and access_row.uses_count >= access_row.max_uses then return query select false, 'تم استنفاد استخدامات هذا الكود', null::text, null::uuid, null::uuid; return; end if;
  if access_row.code_type = 'file' and exists (select 1 from public.user_access where user_id = current_user_id and file_id = access_row.file_id and (expires_at is null or expires_at > now())) then return query select true, 'لديك صلاحية وصول لهذا الملف مسبقاً', 'file', null::uuid, access_row.file_id; return; end if;
  if access_row.code_type = 'teacher_bundle' and exists (select 1 from public.user_access where user_id = current_user_id and teacher_id = access_row.teacher_id and (expires_at is null or expires_at > now())) then return query select true, 'لديك صلاحية شاملة لهذا الأستاذ مسبقاً', 'teacher_bundle', access_row.teacher_id, null::uuid; return; end if;
  if access_row.code_type = 'file' then
    granted_file := access_row.file_id;
    insert into public.user_access(user_id, access_type, file_id, access_code_id, expires_at) values (current_user_id, 'file', granted_file, access_row.id, access_row.expires_at) on conflict do nothing;
  else
    granted_teacher := access_row.teacher_id;
    insert into public.user_access(user_id, access_type, teacher_id, access_code_id, expires_at) values (current_user_id, 'teacher_bundle', granted_teacher, access_row.id, access_row.expires_at) on conflict do nothing;
  end if;
  insert into public.access_code_usage(access_code_id, user_id, file_id, teacher_id) values (access_row.id, current_user_id, granted_file, granted_teacher);
  update public.premium_access_codes set uses_count = uses_count + 1 where id = access_row.id;
  return query select true, 'تم تفعيل كود الوصول بنجاح', access_row.code_type, granted_teacher, granted_file;
end;
$$;

create or replace function public.premium_admin_upsert_code(p_code text, p_code_type text, p_file_id uuid default null, p_teacher_id uuid default null, p_price numeric default 0, p_max_uses integer default 1, p_expires_at timestamptz default null)
returns table(code text, code_hint text, code_type text, file_id uuid, teacher_id uuid, price numeric)
language plpgsql security definer set search_path = public as $$
declare raw_code text := nullif(trim(p_code), ''); hash_value text; code_value public.premium_access_codes; resolved_price numeric := 0;
begin
  if not private.is_premium_admin() then raise exception 'not authorized'; end if;
  if p_code_type not in ('file','teacher_bundle') then raise exception 'invalid code type'; end if;
  if p_code_type = 'file' and p_file_id is null then raise exception 'file target required'; end if;
  if p_code_type = 'teacher_bundle' and p_teacher_id is null then raise exception 'teacher target required'; end if;
  if p_code_type = 'file' then
    select f.access_price into resolved_price from public.premium_files f where f.id = p_file_id and f.is_available;
    if resolved_price is null then raise exception 'الملف المحدد غير متاح'; end if;
  else
    select t.bundle_price into resolved_price from public.premium_teachers t where t.id = p_teacher_id and t.is_active and t.bundle_enabled;
    if resolved_price is null then raise exception 'الكود الشامل غير متاح لهذا الأستاذ'; end if;
  end if;
  if raw_code is null then raw_code := upper('NABD-' || substr(md5(coalesce(auth.uid()::text, '') || clock_timestamp()::text || random()::text), 1, 10)); end if;
  hash_value := md5(lower(raw_code));
  insert into public.premium_access_codes(code_hash, code_hint, code_type, file_id, teacher_id, price, max_uses, created_by, expires_at)
  values (hash_value, right(raw_code, 4), p_code_type, case when p_code_type = 'file' then p_file_id else null end, case when p_code_type = 'teacher_bundle' then p_teacher_id else null end, resolved_price, greatest(coalesce(p_max_uses, 1), 0), auth.uid(), p_expires_at)
  returning * into code_value;
  return query select raw_code, code_value.code_hint, code_value.code_type, code_value.file_id, code_value.teacher_id, code_value.price;
end;
$$;

revoke execute on function public.premium_redeem_access_code(text) from public, anon;
grant execute on function public.premium_redeem_access_code(text) to authenticated;
revoke execute on function public.premium_admin_upsert_code(text,text,uuid,uuid,numeric,integer,timestamptz) from public, anon;
grant execute on function public.premium_admin_upsert_code(text,text,uuid,uuid,numeric,integer,timestamptz) to authenticated;
