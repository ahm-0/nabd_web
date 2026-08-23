create table if not exists public.news_post_likes (
  post_id uuid not null references public.news_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.news_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.news_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default 'طالب نبض',
  author_meta text not null default 'مجتمع الأخبار',
  body text not null,
  created_at timestamptz not null default now(),
  constraint news_post_comments_body_length check (char_length(trim(body)) between 1 and 280)
);

create index if not exists news_post_comments_post_created_idx
  on public.news_post_comments (post_id, created_at asc);

alter table public.news_post_likes enable row level security;
alter table public.news_post_comments enable row level security;
revoke all on table public.news_post_likes, public.news_post_comments from anon, authenticated;

 drop function if exists public.news_list_posts(integer);

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
  updated_at timestamptz,
  like_count bigint,
  liked_by_me boolean,
  comment_count bigint,
  comments jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select n.id, n.author_id, n.author_name, n.author_meta, n.body, n.images,
         n.is_published, n.created_at, n.updated_at,
         (select count(*) from public.news_post_likes l where l.post_id = n.id) as like_count,
         exists(select 1 from public.news_post_likes me where me.post_id = n.id and me.user_id = auth.uid()) as liked_by_me,
         (select count(*) from public.news_post_comments cc where cc.post_id = n.id) as comment_count,
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'id', c.id,
             'author_id', c.author_id,
             'name', c.author_name,
             'meta', c.author_meta,
             'text', c.body,
             'created_at', c.created_at
           ) order by c.created_at asc)
           from public.news_post_comments c
           where c.post_id = n.id
         ), '[]'::jsonb) as comments
  from public.news_posts n
  where n.is_published = true
  order by n.created_at desc
  limit greatest(1, least(coalesce(p_limit, 60), 100));
$$;

grant execute on function public.news_list_posts(integer) to authenticated;

create or replace function public.news_toggle_like(p_post_id uuid)
returns table (liked boolean, like_count bigint)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_liked boolean;
  v_count bigint;
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول أولًا'; end if;
  if not exists (select 1 from public.news_posts n where n.id = p_post_id and n.is_published = true) then
    raise exception 'المنشور غير متاح';
  end if;

  select exists(select 1 from public.news_post_likes l where l.post_id = p_post_id and l.user_id = auth.uid()) into v_liked;
  if v_liked then
    delete from public.news_post_likes where post_id = p_post_id and user_id = auth.uid();
    v_liked := false;
  else
    insert into public.news_post_likes(post_id, user_id) values (p_post_id, auth.uid()) on conflict do nothing;
    v_liked := true;
  end if;

  select count(*) into v_count from public.news_post_likes where post_id = p_post_id;
  return query select v_liked, v_count;
end;
$$;

grant execute on function public.news_toggle_like(uuid) to authenticated;

create or replace function public.news_add_comment(p_post_id uuid, p_body text)
returns table (
  id uuid,
  author_id uuid,
  name text,
  meta text,
  text text,
  created_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_name text;
  v_meta text;
  v_body text := trim(coalesce(p_body, ''));
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول أولًا'; end if;
  if not exists (select 1 from public.news_posts n where n.id = p_post_id and n.is_published = true) then
    raise exception 'المنشور غير متاح';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 280 then
    raise exception 'يجب أن يكون التعليق بين حرف واحد و280 حرفًا';
  end if;

  select coalesce(nullif(trim(concat_ws(' ', sp.first_name, sp.father_name, sp.family_name)), ''), 'طالب نبض'),
         coalesce(nullif(trim(concat_ws(' · ', sp.study_stage, 'طالب')), ''), 'مجتمع الأخبار')
    into v_name, v_meta
  from public.student_profiles sp
  where sp.user_id = auth.uid();

  insert into public.news_post_comments(post_id, author_id, author_name, author_meta, body)
  values (p_post_id, auth.uid(), coalesce(v_name, 'طالب نبض'), coalesce(v_meta, 'مجتمع الأخبار'), v_body)
  returning news_post_comments.id into v_id;

  return query
    select c.id, c.author_id, c.author_name, c.author_meta, c.body, c.created_at
    from public.news_post_comments c
    where c.id = v_id;
end;
$$;

grant execute on function public.news_add_comment(uuid, text) to authenticated;
