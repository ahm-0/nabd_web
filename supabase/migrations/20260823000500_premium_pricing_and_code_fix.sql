drop function if exists public.premium_admin_upsert_file(uuid,uuid,text,text,text,numeric,boolean,integer);

create or replace function public.premium_admin_upsert_file(p_id uuid, p_teacher_id uuid, p_subject_id uuid, p_title text, p_description text, p_file_url text, p_access_price numeric default 0, p_is_available boolean default true, p_sort_order integer default 0)
returns public.premium_files language plpgsql security definer set search_path = public as $$
declare result public.premium_files;
begin
  if not private.is_premium_admin() then raise exception 'not authorized'; end if;
  if not exists (select 1 from public.premium_subjects where id = p_subject_id and teacher_id = p_teacher_id and is_active) then raise exception 'المادة لا تتبع الأستاذ المحدد'; end if;
  insert into public.premium_files(id, subject_id, title, description, file_url, access_price, is_available, sort_order)
  values (coalesce(p_id, gen_random_uuid()), p_subject_id, p_title, p_description, p_file_url, greatest(coalesce(p_access_price, 0), 0), p_is_available, p_sort_order)
  on conflict (id) do update set subject_id=excluded.subject_id, title=excluded.title, description=excluded.description, file_url=excluded.file_url, access_price=excluded.access_price, is_available=excluded.is_available, sort_order=excluded.sort_order
  returning * into result;
  return result;
end;
$$;

drop function if exists public.premium_admin_upsert_code(text,text,uuid,uuid,numeric,integer,timestamptz);

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
  hash_value := encode(digest(lower(raw_code), 'sha256'), 'hex');
  insert into public.premium_access_codes(code_hash, code_hint, code_type, file_id, teacher_id, price, max_uses, created_by, expires_at)
  values (hash_value, right(raw_code, 4), p_code_type, case when p_code_type = 'file' then p_file_id else null end, case when p_code_type = 'teacher_bundle' then p_teacher_id else null end, resolved_price, greatest(coalesce(p_max_uses, 1), 0), auth.uid(), p_expires_at)
  returning * into code_value;
  return query select raw_code, code_value.code_hint, code_value.code_type, code_value.file_id, code_value.teacher_id, code_value.price;
end;
$$;

revoke execute on function public.premium_admin_upsert_file(uuid,uuid,uuid,text,text,text,numeric,boolean,integer) from public, anon;
grant execute on function public.premium_admin_upsert_file(uuid,uuid,uuid,text,text,text,numeric,boolean,integer) to authenticated;
revoke execute on function public.premium_admin_upsert_code(text,text,uuid,uuid,numeric,integer,timestamptz) from public, anon;
grant execute on function public.premium_admin_upsert_code(text,text,uuid,uuid,numeric,integer,timestamptz) to authenticated;
