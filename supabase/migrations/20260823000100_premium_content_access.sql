create extension if not exists pgcrypto;

create schema if not exists private;

create table if not exists public.premium_sections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.premium_branches (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.premium_sections(id) on delete cascade,
  slug text not null,
  name text not null,
  description text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(section_id, slug)
);

create table if not exists public.premium_teachers (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.premium_branches(id) on delete cascade,
  name text not null,
  description text not null default '',
  avatar_url text,
  bundle_enabled boolean not null default false,
  bundle_price numeric(10,2) not null default 0 check (bundle_price >= 0),
  whatsapp text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.premium_subjects (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.premium_teachers(id) on delete cascade,
  name text not null,
  description text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.premium_files (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.premium_subjects(id) on delete cascade,
  title text not null,
  description text not null default '',
  file_url text not null,
  access_price numeric(10,2) not null default 0 check (access_price >= 0),
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.premium_settings (
  id integer primary key default 1 check (id = 1),
  default_whatsapp text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin','editor')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.premium_access_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  code_hint text not null default '',
  code_type text not null check (code_type in ('file','teacher_bundle')),
  file_id uuid references public.premium_files(id) on delete cascade,
  teacher_id uuid references public.premium_teachers(id) on delete cascade,
  price numeric(10,2) not null default 0 check (price >= 0),
  max_uses integer not null default 1 check (max_uses = 0 or max_uses > 0),
  uses_count integer not null default 0 check (uses_count >= 0),
  is_active boolean not null default true,
  expires_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint access_codes_target_check check ((code_type = 'file' and file_id is not null and teacher_id is null) or (code_type = 'teacher_bundle' and teacher_id is not null and file_id is null))
);

create table if not exists public.user_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  access_type text not null check (access_type in ('file','teacher_bundle')),
  file_id uuid references public.premium_files(id) on delete cascade,
  teacher_id uuid references public.premium_teachers(id) on delete cascade,
  access_code_id uuid not null references public.premium_access_codes(id),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint user_access_target_check check ((access_type = 'file' and file_id is not null and teacher_id is null) or (access_type = 'teacher_bundle' and teacher_id is not null and file_id is null))
);
create unique index if not exists user_access_file_unique on public.user_access(user_id, file_id) where file_id is not null;
create unique index if not exists user_access_teacher_unique on public.user_access(user_id, teacher_id) where teacher_id is not null;

create table if not exists public.access_code_usage (
  id uuid primary key default gen_random_uuid(),
  access_code_id uuid not null references public.premium_access_codes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_id uuid references public.premium_files(id) on delete set null,
  teacher_id uuid references public.premium_teachers(id) on delete set null,
  used_at timestamptz not null default now()
);

create or replace function public.premium_touch_updated_at() returns trigger language plpgsql security invoker set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists premium_sections_updated_at on public.premium_sections;
create trigger premium_sections_updated_at before update on public.premium_sections for each row execute function public.premium_touch_updated_at();
drop trigger if exists premium_branches_updated_at on public.premium_branches;
create trigger premium_branches_updated_at before update on public.premium_branches for each row execute function public.premium_touch_updated_at();
drop trigger if exists premium_teachers_updated_at on public.premium_teachers;
create trigger premium_teachers_updated_at before update on public.premium_teachers for each row execute function public.premium_touch_updated_at();
drop trigger if exists premium_subjects_updated_at on public.premium_subjects;
create trigger premium_subjects_updated_at before update on public.premium_subjects for each row execute function public.premium_touch_updated_at();
drop trigger if exists premium_files_updated_at on public.premium_files;
create trigger premium_files_updated_at before update on public.premium_files for each row execute function public.premium_touch_updated_at();
drop trigger if exists premium_settings_updated_at on public.premium_settings;
create trigger premium_settings_updated_at before update on public.premium_settings for each row execute function public.premium_touch_updated_at();

create or replace function private.is_premium_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = (select auth.uid()) and is_active = true and role in ('admin','editor'));
$$;

create or replace function public.premium_is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select private.is_premium_admin();
$$;

create or replace function public.premium_list_branches(p_section_slug text default 'baccalaureate')
returns table(id uuid, slug text, name text, description text, sort_order integer)
language sql stable security definer set search_path = public as $$
  select b.id, b.slug, b.name, b.description, b.sort_order
  from public.premium_branches b join public.premium_sections s on s.id = b.section_id
  where s.slug = p_section_slug and s.is_active and b.is_active
  order by b.sort_order, b.name;
$$;

create or replace function public.premium_list_teachers(p_branch_id uuid)
returns table(id uuid, name text, description text, avatar_url text, bundle_enabled boolean, bundle_price numeric, whatsapp text, sort_order integer)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, t.description, t.avatar_url, t.bundle_enabled, t.bundle_price, coalesce(nullif(t.whatsapp, ''), ps.default_whatsapp), t.sort_order
  from public.premium_teachers t join public.premium_branches b on b.id = t.branch_id cross join public.premium_settings ps
  where t.branch_id = p_branch_id and b.is_active and t.is_active and ps.id = 1
  order by t.sort_order, t.name;
$$;

create or replace function public.premium_list_subjects(p_teacher_id uuid)
returns table(id uuid, name text, description text, sort_order integer)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.description, s.sort_order
  from public.premium_subjects s join public.premium_teachers t on t.id = s.teacher_id
  where s.teacher_id = p_teacher_id and t.is_active and s.is_active
  order by s.sort_order, s.name;
$$;

create or replace function public.premium_list_files(p_subject_id uuid)
returns table(id uuid, title text, description text, access_price numeric, teacher_id uuid, teacher_name text, bundle_enabled boolean, bundle_price numeric, whatsapp text, sort_order integer)
language sql stable security definer set search_path = public as $$
  select f.id, f.title, f.description, f.access_price, t.id, t.name, t.bundle_enabled, t.bundle_price, coalesce(nullif(t.whatsapp, ''), ps.default_whatsapp), f.sort_order
  from public.premium_files f join public.premium_subjects s on s.id = f.subject_id join public.premium_teachers t on t.id = s.teacher_id cross join public.premium_settings ps
  where f.subject_id = p_subject_id and f.is_available and s.is_active and t.is_active and ps.id = 1
  order by f.sort_order, f.title;
$$;

create or replace function public.premium_check_file_access(p_file_id uuid)
returns table(allowed boolean, file_id uuid, file_title text, reason text)
language plpgsql stable security definer set search_path = public as $$
declare
  current_user_id uuid := auth.uid();
  target_teacher uuid;
  target_title text;
  has_access boolean := false;
begin
  select f.title, t.id into target_title, target_teacher
  from public.premium_files f join public.premium_subjects s on s.id = f.subject_id join public.premium_teachers t on t.id = s.teacher_id
  where f.id = p_file_id and f.is_available and s.is_active and t.is_active;
  if target_title is null then return query select false, p_file_id, null::text, 'الملف غير متاح حالياً'; return; end if;
  if current_user_id is not null then
    select exists (select 1 from public.user_access ua where ua.user_id = current_user_id and ((ua.file_id = p_file_id) or (ua.teacher_id = target_teacher)) and (ua.expires_at is null or ua.expires_at > now())) into has_access;
  end if;
  return query select has_access, p_file_id, target_title, case when has_access then 'مسموح' else 'يتطلب كود وصول' end;
end;
$$;

create or replace function public.premium_open_file(p_file_id uuid)
returns table(allowed boolean, file_id uuid, file_title text, file_url text, reason text)
language plpgsql stable security definer set search_path = public as $$
declare
  current_user_id uuid := auth.uid();
  target_teacher uuid;
  target_title text;
  target_url text;
  has_access boolean := false;
begin
  select f.title, f.file_url, t.id into target_title, target_url, target_teacher
  from public.premium_files f join public.premium_subjects s on s.id = f.subject_id join public.premium_teachers t on t.id = s.teacher_id
  where f.id = p_file_id and f.is_available and s.is_active and t.is_active;
  if target_title is null then return query select false, p_file_id, null::text, null::text, 'الملف غير متاح حالياً'; return; end if;
  if current_user_id is not null then
    select exists (select 1 from public.user_access ua where ua.user_id = current_user_id and ((ua.file_id = p_file_id) or (ua.teacher_id = target_teacher)) and (ua.expires_at is null or ua.expires_at > now())) into has_access;
  end if;
  return query select has_access, p_file_id, target_title, case when has_access then target_url else null::text end, case when has_access then 'مسموح' else 'يتطلب كود وصول' end;
end;
$$;

create or replace function public.premium_redeem_access_code(p_code text)
returns table(success boolean, message text, access_type text, teacher_id uuid, file_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  current_user_id uuid := auth.uid();
  hashed_code text := encode(digest(lower(trim(coalesce(p_code, ''))), 'sha256'), 'hex');
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

create or replace function public.premium_admin_upsert_branch(p_id uuid, p_section_slug text, p_slug text, p_name text, p_description text default '', p_sort_order integer default 0, p_is_active boolean default true)
returns public.premium_branches language plpgsql security definer set search_path = public as $$
declare result public.premium_branches;
begin
  if not private.is_premium_admin() then raise exception 'not authorized'; end if;
  insert into public.premium_sections(slug, name) values (p_section_slug, case when p_section_slug = 'baccalaureate' then 'بكالوريا القسم المميز' else p_section_slug end) on conflict (slug) do nothing;
  insert into public.premium_branches(id, section_id, slug, name, description, sort_order, is_active)
  values (coalesce(p_id, gen_random_uuid()), (select id from public.premium_sections where slug = p_section_slug), p_slug, p_name, p_description, p_sort_order, p_is_active)
  on conflict (id) do update set section_id = excluded.section_id, slug = excluded.slug, name = excluded.name, description = excluded.description, sort_order = excluded.sort_order, is_active = excluded.is_active
  returning * into result;
  return result;
end;
$$;

create or replace function public.premium_admin_upsert_teacher(p_id uuid, p_branch_id uuid, p_name text, p_description text default '', p_avatar_url text default null, p_bundle_enabled boolean default false, p_bundle_price numeric default 0, p_whatsapp text default null, p_sort_order integer default 0, p_is_active boolean default true)
returns public.premium_teachers language plpgsql security definer set search_path = public as $$
declare result public.premium_teachers;
begin
  if not private.is_premium_admin() then raise exception 'not authorized'; end if;
  insert into public.premium_teachers(id, branch_id, name, description, avatar_url, bundle_enabled, bundle_price, whatsapp, sort_order, is_active)
  values (coalesce(p_id, gen_random_uuid()), p_branch_id, p_name, p_description, p_avatar_url, p_bundle_enabled, p_bundle_price, p_whatsapp, p_sort_order, p_is_active)
  on conflict (id) do update set branch_id=excluded.branch_id, name=excluded.name, description=excluded.description, avatar_url=excluded.avatar_url, bundle_enabled=excluded.bundle_enabled, bundle_price=excluded.bundle_price, whatsapp=excluded.whatsapp, sort_order=excluded.sort_order, is_active=excluded.is_active
  returning * into result;
  return result;
end;
$$;

create or replace function public.premium_admin_upsert_subject(p_id uuid, p_teacher_id uuid, p_name text, p_description text default '', p_sort_order integer default 0, p_is_active boolean default true)
returns public.premium_subjects language plpgsql security definer set search_path = public as $$
declare result public.premium_subjects;
begin
  if not private.is_premium_admin() then raise exception 'not authorized'; end if;
  insert into public.premium_subjects(id, teacher_id, name, description, sort_order, is_active)
  values (coalesce(p_id, gen_random_uuid()), p_teacher_id, p_name, p_description, p_sort_order, p_is_active)
  on conflict (id) do update set teacher_id=excluded.teacher_id, name=excluded.name, description=excluded.description, sort_order=excluded.sort_order, is_active=excluded.is_active
  returning * into result;
  return result;
end;
$$;

create or replace function public.premium_admin_upsert_file(p_id uuid, p_subject_id uuid, p_title text, p_description text, p_file_url text, p_access_price numeric default 0, p_is_available boolean default true, p_sort_order integer default 0)
returns public.premium_files language plpgsql security definer set search_path = public as $$
declare result public.premium_files;
begin
  if not private.is_premium_admin() then raise exception 'not authorized'; end if;
  insert into public.premium_files(id, subject_id, title, description, file_url, access_price, is_available, sort_order)
  values (coalesce(p_id, gen_random_uuid()), p_subject_id, p_title, p_description, p_file_url, p_access_price, p_is_available, p_sort_order)
  on conflict (id) do update set subject_id=excluded.subject_id, title=excluded.title, description=excluded.description, file_url=excluded.file_url, access_price=excluded.access_price, is_available=excluded.is_available, sort_order=excluded.sort_order
  returning * into result;
  return result;
end;
$$;

create or replace function public.premium_admin_upsert_code(p_code text, p_code_type text, p_file_id uuid default null, p_teacher_id uuid default null, p_price numeric default 0, p_max_uses integer default 1, p_expires_at timestamptz default null)
returns table(code text, code_hint text, code_type text, file_id uuid, teacher_id uuid)
language plpgsql security definer set search_path = public as $$
declare raw_code text := nullif(trim(p_code), ''); hash_value text; code_value public.premium_access_codes;
begin
  if not private.is_premium_admin() then raise exception 'not authorized'; end if;
  if p_code_type not in ('file','teacher_bundle') then raise exception 'invalid code type'; end if;
  if p_code_type = 'file' and p_file_id is null then raise exception 'file target required'; end if;
  if p_code_type = 'teacher_bundle' and p_teacher_id is null then raise exception 'teacher target required'; end if;
  if raw_code is null then raw_code := upper('NABD-' || encode(gen_random_bytes(5), 'hex')); end if;
  hash_value := encode(digest(lower(raw_code), 'sha256'), 'hex');
  insert into public.premium_access_codes(code_hash, code_hint, code_type, file_id, teacher_id, price, max_uses, created_by, expires_at)
  values (hash_value, right(raw_code, 4), p_code_type, case when p_code_type = 'file' then p_file_id else null end, case when p_code_type = 'teacher_bundle' then p_teacher_id else null end, p_price, p_max_uses, auth.uid(), p_expires_at)
  returning * into code_value;
  return query select raw_code, code_value.code_hint, code_value.code_type, code_value.file_id, code_value.teacher_id;
end;
$$;

create or replace function public.premium_admin_delete_entity(p_entity text, p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not private.is_premium_admin() then raise exception 'not authorized'; end if;
  if p_entity = 'branch' then delete from public.premium_branches where id = p_id;
  elsif p_entity = 'teacher' then delete from public.premium_teachers where id = p_id;
  elsif p_entity = 'subject' then delete from public.premium_subjects where id = p_id;
  elsif p_entity = 'file' then delete from public.premium_files where id = p_id;
  elsif p_entity = 'code' then delete from public.premium_access_codes where id = p_id;
  else raise exception 'invalid entity'; end if;
  return true;
end;
$$;

create or replace function public.premium_admin_update_settings(p_whatsapp text)
returns public.premium_settings language plpgsql security definer set search_path = public as $$
declare result public.premium_settings;
begin
  if not private.is_premium_admin() then raise exception 'not authorized'; end if;
  insert into public.premium_settings(id, default_whatsapp) values (1, coalesce(p_whatsapp, '')) on conflict (id) do update set default_whatsapp=excluded.default_whatsapp returning * into result;
  return result;
end;
$$;

insert into public.premium_sections(slug, name, description) values ('baccalaureate', 'بكالوريا القسم المميز', 'محتوى مدفوع منظم حسب الفرع والأستاذ والمادة.') on conflict (slug) do update set name = excluded.name, description = excluded.description;
insert into public.premium_branches(section_id, slug, name, description, sort_order) select id, 'science', 'بكالوريا علمي', 'دروس وملفات الفرع العلمي.', 1 from public.premium_sections where slug = 'baccalaureate' on conflict (section_id, slug) do nothing;
insert into public.premium_branches(section_id, slug, name, description, sort_order) select id, 'literary', 'بكالوريا أدبي', 'دروس وملفات الفرع الأدبي.', 2 from public.premium_sections where slug = 'baccalaureate' on conflict (section_id, slug) do nothing;
insert into public.premium_settings(id, default_whatsapp) values (1, '') on conflict (id) do nothing;
insert into public.admin_users(user_id, role, is_active) select id, 'admin', true from auth.users where lower(email) = 'aaaaaaaa@gmail.com' on conflict (user_id) do update set role='admin', is_active=true;

alter table public.premium_sections enable row level security;
alter table public.premium_branches enable row level security;
alter table public.premium_teachers enable row level security;
alter table public.premium_subjects enable row level security;
alter table public.premium_files enable row level security;
alter table public.premium_settings enable row level security;
alter table public.admin_users enable row level security;
alter table public.premium_access_codes enable row level security;
alter table public.user_access enable row level security;
alter table public.access_code_usage enable row level security;

revoke all on public.premium_sections, public.premium_branches, public.premium_teachers, public.premium_subjects, public.premium_files, public.premium_settings, public.admin_users, public.premium_access_codes, public.user_access, public.access_code_usage from anon, authenticated;

grant execute on function public.premium_is_admin() to authenticated;
grant execute on function public.premium_list_branches(text) to authenticated;
grant execute on function public.premium_list_teachers(uuid) to authenticated;
grant execute on function public.premium_list_subjects(uuid) to authenticated;
grant execute on function public.premium_list_files(uuid) to authenticated;
grant execute on function public.premium_check_file_access(uuid) to authenticated;
grant execute on function public.premium_open_file(uuid) to authenticated;
grant execute on function public.premium_redeem_access_code(text) to authenticated;
grant execute on function public.premium_admin_upsert_branch(uuid,text,text,text,text,integer,boolean) to authenticated;
grant execute on function public.premium_admin_upsert_teacher(uuid,uuid,text,text,text,boolean,numeric,text,integer,boolean) to authenticated;
grant execute on function public.premium_admin_upsert_subject(uuid,uuid,text,text,integer,boolean) to authenticated;
grant execute on function public.premium_admin_upsert_file(uuid,uuid,text,text,text,numeric,boolean,integer) to authenticated;
grant execute on function public.premium_admin_upsert_code(text,text,uuid,uuid,numeric,integer,timestamptz) to authenticated;
grant execute on function public.premium_admin_delete_entity(text,uuid) to authenticated;
grant execute on function public.premium_admin_update_settings(text) to authenticated;
