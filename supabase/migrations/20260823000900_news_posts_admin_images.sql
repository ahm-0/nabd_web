create table if not exists public.news_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default 'مشرف نبض',
  author_meta text not null default 'نبض التفوق',
  body text not null,
  images text[] not null default '{}',
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint news_posts_body_length check (char_length(trim(body)) between 1 and 1200),
  constraint news_posts_images_limit check (cardinality(images) <= 4)
);

create index if not exists news_posts_published_created_idx
  on public.news_posts (is_published, created_at desc);

alter table public.news_posts enable row level security;

revoke all on table public.news_posts from anon, authenticated;

drop policy if exists "authenticated_can_read_published_news" on public.news_posts;
create policy "authenticated_can_read_published_news"
  on public.news_posts for select to authenticated
  using (is_published = true);

create or replace function public.news_list_posts(p_limit integer default 60)
returns table (
  id uuid,
  author_id uuid,
  author_name text,
  author_meta text,
  body text,
  images text[],
  is_published boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select n.id, n.author_id, n.author_name, n.author_meta, n.body, n.images,
         n.is_published, n.created_at, n.updated_at
  from public.news_posts n
  where n.is_published = true
  order by n.created_at desc
  limit greatest(1, least(coalesce(p_limit, 60), 100));
$$;

grant execute on function public.news_list_posts(integer) to authenticated;

create or replace function public.news_admin_create_post(
  p_body text,
  p_images text[] default '{}'
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_author_name text;
  v_author_meta text;
begin
  if not exists (
    select 1 from public.admin_users au
    where au.user_id = auth.uid() and au.is_active = true and au.role in ('admin', 'editor')
  ) then
    raise exception 'غير مصرح: المشرف فقط يستطيع نشر الأخبار';
  end if;

  if nullif(trim(coalesce(p_body, '')), '') is null and coalesce(cardinality(p_images), 0) = 0 then
    raise exception 'يجب كتابة نص أو إرفاق صورة';
  end if;

  if char_length(trim(coalesce(p_body, ''))) > 1200 then
    raise exception 'نص المنشور يتجاوز 1200 حرفًا';
  end if;

  select coalesce(nullif(trim(concat_ws(' ', sp.first_name, sp.father_name, sp.family_name)), ''), 'مشرف نبض'),
         coalesce(nullif(trim(concat_ws(' · ', sp.study_stage, 'إدارة الأخبار')), ''), 'إدارة الأخبار · نبض التفوق')
    into v_author_name, v_author_meta
  from public.student_profiles sp
  where sp.user_id = auth.uid();

  insert into public.news_posts (author_id, author_name, author_meta, body, images, is_published)
  values (
    auth.uid(),
    coalesce(v_author_name, 'مشرف نبض'),
    coalesce(v_author_meta, 'إدارة الأخبار · نبض التفوق'),
    trim(coalesce(p_body, '')),
    coalesce(p_images, '{}'),
    true
  )
  returning news_posts.id into v_id;

  return v_id;
end;
$$;

grant execute on function public.news_admin_create_post(text, text[]) to authenticated;

create or replace function public.news_admin_update_post(
  p_post_id uuid,
  p_body text,
  p_images text[] default '{}'
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.admin_users au
    where au.user_id = auth.uid() and au.is_active = true and au.role in ('admin', 'editor')
  ) then
    raise exception 'غير مصرح: المشرف فقط يستطيع تعديل الأخبار';
  end if;

  update public.news_posts
     set body = trim(coalesce(p_body, '')),
         images = coalesce(p_images, '{}'),
         updated_at = now()
   where id = p_post_id;

  return found;
end;
$$;

grant execute on function public.news_admin_update_post(uuid, text, text[]) to authenticated;

create or replace function public.news_admin_delete_post(p_post_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.admin_users au
    where au.user_id = auth.uid() and au.is_active = true and au.role in ('admin', 'editor')
  ) then
    raise exception 'غير مصرح: المشرف فقط يستطيع حذف الأخبار';
  end if;

  delete from public.news_posts where id = p_post_id;
  return found;
end;
$$;

grant execute on function public.news_admin_delete_post(uuid) to authenticated;
