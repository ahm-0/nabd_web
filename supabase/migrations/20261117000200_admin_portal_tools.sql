-- أدوات بوابة المشرفين: قواعد الدردشة (الوضع البطيء + منع الروابط)، مواعيد الامتحانات، عدّاد الموثّقين.

-- 1) قواعد الدردشة
alter table public.chat_platform_settings add column if not exists slow_mode_seconds integer not null default 0 check (slow_mode_seconds between 0 and 600);
alter table public.chat_platform_settings add column if not exists block_links boolean not null default false;

create or replace function public.chat_admin_update_rules(p_slow_mode_seconds integer, p_block_links boolean)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if not public.chat_can_moderate() then raise exception 'لا تملك صلاحية إدارة قواعد الدردشة'; end if;
  update public.chat_platform_settings
     set slow_mode_seconds = greatest(0, least(coalesce(p_slow_mode_seconds, 0), 600)),
         block_links = coalesce(p_block_links, false), updated_by = auth.uid(), updated_at = now()
   where id = true;
end; $$;
grant execute on function public.chat_admin_update_rules(integer, boolean) to authenticated;

create or replace function public.chat_get_rules()
returns table(slow_mode_seconds integer, block_links boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select s.slow_mode_seconds, s.block_links from public.chat_platform_settings s where s.id = true;
$$;
grant execute on function public.chat_get_rules() to authenticated;

-- تطبيق القواعد على الخادم (لا يمكن تجاوزها من المتصفح). المشرفون معفون.
create or replace function public.chat_enforce_rules()
returns trigger language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_slow integer; v_links boolean; v_last timestamptz;
begin
  select s.slow_mode_seconds, s.block_links into v_slow, v_links from public.chat_platform_settings s where s.id = true;
  if public.chat_can_moderate() then return new; end if;
  if coalesce(v_links, false) and new.body ~* '(https?://|www\.|[a-z0-9-]+\.(com|net|org|io|me|ly|tv|app|xyz|info|co|gg)(/|\s|$))' then
    raise exception 'الروابط غير مسموحة في الدردشة حالياً';
  end if;
  if coalesce(v_slow, 0) > 0 then
    select max(m.created_at) into v_last from public.public_chat_messages m where m.sender_id = new.sender_id;
    if v_last is not null and v_last > now() - make_interval(secs => v_slow) then
      raise exception 'الوضع البطيء مفعّل: انتظر % ثانية بين الرسائل', v_slow;
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists chat_enforce_rules_trg on public.public_chat_messages;
create trigger chat_enforce_rules_trg before insert on public.public_chat_messages for each row execute function public.chat_enforce_rules();

-- 2) مواعيد الامتحانات (عدّاد الصفحة الرئيسية)
create table if not exists public.app_exam_dates (
  key text primary key check (key in ('bac','nine')),
  target timestamptz not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.app_exam_dates enable row level security;
revoke all on table public.app_exam_dates from anon, authenticated;

create or replace function public.get_exam_dates()
returns table(key text, target timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select d.key, d.target from public.app_exam_dates d;
$$;
grant execute on function public.get_exam_dates() to anon, authenticated;

create or replace function public.admin_set_exam_date(p_key text, p_target timestamptz)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if not public.premium_is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_key not in ('bac','nine') then raise exception 'invalid key'; end if;
  insert into public.app_exam_dates(key, target, updated_by, updated_at) values (p_key, p_target, auth.uid(), now())
  on conflict (key) do update set target = excluded.target, updated_by = excluded.updated_by, updated_at = now();
end; $$;
revoke all on function public.admin_set_exam_date(text, timestamptz) from public, anon;
grant execute on function public.admin_set_exam_date(text, timestamptz) to authenticated;

-- 3) عدد الحسابات الموثّقة
create or replace function public.admin_verified_count()
returns integer language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.premium_is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return (select count(*)::integer from public.student_profiles where is_verified = true);
end; $$;
revoke all on function public.admin_verified_count() from public, anon;
grant execute on function public.admin_verified_count() to authenticated;
