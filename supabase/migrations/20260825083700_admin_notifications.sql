-- إشعارات الإدارة: حفظ داخلي، صندوق وارد، حالة قراءة، ورفع صور محمي للمشرفين.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 120),
  body text not null check (char_length(trim(body)) between 1 and 2000),
  image_url text,
  action_url text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  is_active boolean not null default true
);

create index if not exists notifications_created_at_idx on public.notifications (created_at desc);
create index if not exists notifications_created_by_idx on public.notifications (created_by);
alter table public.notifications enable row level security;

drop policy if exists "Authenticated users can read active notifications" on public.notifications;
create policy "Authenticated users can read active notifications"
  on public.notifications for select to authenticated
  using (is_active = true);

create table if not exists public.notification_reads (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create index if not exists notification_reads_user_idx on public.notification_reads (user_id, read_at desc);
alter table public.notification_reads enable row level security;

drop policy if exists "Users can read their notification marks" on public.notification_reads;
create policy "Users can read their notification marks"
  on public.notification_reads for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can create their notification marks" on public.notification_reads;
create policy "Users can create their notification marks"
  on public.notification_reads for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can update their notification marks" on public.notification_reads;
create policy "Users can update their notification marks"
  on public.notification_reads for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.admin_create_notification(
  p_title text,
  p_body text,
  p_image_url text default null,
  p_action_url text default null
)
returns public.notifications
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_row public.notifications;
  v_title text := trim(coalesce(p_title, ''));
  v_body text := trim(coalesce(p_body, ''));
  v_image_url text := nullif(trim(coalesce(p_image_url, '')), '');
  v_action_url text := nullif(trim(coalesce(p_action_url, '')), '');
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول أولًا'; end if;
  if not private.is_premium_admin() then raise exception 'لا تملك صلاحية إرسال الإشعارات'; end if;
  if char_length(v_title) < 1 or char_length(v_title) > 120 then raise exception 'عنوان الإشعار يجب أن يكون بين حرف واحد و120 حرفًا'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 2000 then raise exception 'نص الإشعار يجب أن يكون بين حرف واحد و2000 حرف'; end if;
  if v_image_url is not null and v_image_url !~* '^https?://' then raise exception 'رابط الصورة غير صالح'; end if;
  if v_action_url is not null and v_action_url !~* '^https?://' then raise exception 'رابط الإجراء غير صالح'; end if;
  insert into public.notifications(title, body, image_url, action_url, created_by)
  values (v_title, v_body, v_image_url, v_action_url, auth.uid())
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.get_notifications(p_limit integer default 50)
returns table(
  id uuid,
  title text,
  body text,
  image_url text,
  action_url text,
  created_at timestamptz,
  created_by uuid,
  read_at timestamptz
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select n.id, n.title, n.body, n.image_url, n.action_url, n.created_at, n.created_by, r.read_at
  from public.notifications n
  left join public.notification_reads r
    on r.notification_id = n.id and r.user_id = auth.uid()
  where auth.uid() is not null and n.is_active = true
  order by n.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول أولًا'; end if;
  if not exists (select 1 from public.notifications n where n.id = p_notification_id and n.is_active = true) then
    raise exception 'الإشعار غير متاح';
  end if;
  insert into public.notification_reads(notification_id, user_id, read_at)
  values (p_notification_id, auth.uid(), now())
  on conflict (notification_id, user_id) do update set read_at = excluded.read_at;
  return true;
end;
$$;

create or replace function public.admin_get_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول أولًا'; end if;
  if not private.is_premium_admin() then raise exception 'لا تملك صلاحية عرض إحصائيات الإدارة'; end if;
  return jsonb_build_object(
    'total_users', (select count(*) from auth.users),
    'total_notifications', (select count(*) from public.notifications where is_active = true),
    'unread_marks', (select count(*) from public.notification_reads)
  );
end;
$$;

revoke execute on function public.admin_create_notification(text, text, text, text) from public, anon, authenticated;
revoke execute on function public.get_notifications(integer) from public, anon;
revoke execute on function public.mark_notification_read(uuid) from public, anon;
revoke execute on function public.admin_get_dashboard_stats() from public, anon;
grant execute on function public.get_notifications(integer) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.admin_get_dashboard_stats() to authenticated;

insert into storage.buckets (id, name, public)
values ('notification-assets', 'notification-assets', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can read notification assets" on storage.objects;
create policy "Public can read notification assets"
  on storage.objects for select to public
  using (bucket_id = 'notification-assets');

drop policy if exists "Admins can upload notification assets" on storage.objects;
create policy "Admins can upload notification assets"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'notification-assets' and public.premium_is_admin());

drop policy if exists "Admins can delete notification assets" on storage.objects;
create policy "Admins can delete notification assets"
  on storage.objects for delete to authenticated
  using (bucket_id = 'notification-assets' and public.premium_is_admin());
