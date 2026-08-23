alter table public.news_post_comments
  add column if not exists parent_id uuid references public.news_post_comments(id) on delete cascade;

create index if not exists news_post_comments_parent_created_idx
  on public.news_post_comments (post_id, parent_id, created_at asc);

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
             'parent_id', c.parent_id,
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

create or replace function public.news_add_comment_with_reply(p_post_id uuid, p_body text, p_parent_id uuid default null)
returns table (
  id uuid,
  parent_id uuid,
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
  if p_parent_id is not null and not exists (select 1 from public.news_post_comments c where c.id = p_parent_id and c.post_id = p_post_id) then
    raise exception 'التعليق الأصلي غير متاح';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 280 then
    raise exception 'يجب أن يكون التعليق بين حرف واحد و280 حرفًا';
  end if;

  select coalesce(nullif(trim(concat_ws(' ', sp.first_name, sp.father_name, sp.family_name)), ''), 'طالب نبض'),
         coalesce(nullif(trim(concat_ws(' · ', sp.study_stage, 'طالب')), ''), 'مجتمع الأخبار')
    into v_name, v_meta
  from public.student_profiles sp
  where sp.user_id = auth.uid();

  insert into public.news_post_comments(post_id, parent_id, author_id, author_name, author_meta, body)
  values (p_post_id, p_parent_id, auth.uid(), coalesce(v_name, 'طالب نبض'), coalesce(v_meta, 'مجتمع الأخبار'), v_body)
  returning news_post_comments.id into v_id;

  return query
    select c.id, c.parent_id, c.author_id, c.author_name, c.author_meta, c.body, c.created_at
    from public.news_post_comments c
    where c.id = v_id;
end;
$$;

grant execute on function public.news_add_comment_with_reply(uuid, text, uuid) to authenticated;
