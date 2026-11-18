-- شارة التوثيق تظهر في الدردشة وملفات المستخدمين وتعليقات الأخبار + إحصاءات المشرف في استدعاء واحد سريع.

-- 1) الدردشة العامة
drop function if exists public.chat_list_public_v2(integer, timestamptz);
create function public.chat_list_public_v2(p_limit integer default 40, p_before timestamptz default null)
returns table(id uuid, sender_id uuid, body text, reply_to_id uuid, reply_body text, reply_name text, edited_at timestamptz, created_at timestamptz, pinned_at timestamptz,
  first_name text, father_name text, family_name text, study_stage text, avatar_thumb text, has_avatar boolean, is_moderator boolean, reactions jsonb, my_reaction text,
  is_verified boolean, verification_type text)
language sql stable security definer set search_path = public, pg_temp as $$
  select m.id, m.sender_id, m.body, m.reply_to_id, rm.body,
         nullif(trim(concat_ws(' ', rp.first_name, rp.father_name, rp.family_name)), ''),
         m.edited_at, m.created_at, m.pinned_at,
         sp.first_name, sp.father_name, sp.family_name, sp.study_stage, sp.avatar_thumb,
         (coalesce(sp.avatar_url, '') <> ''),
         (exists(select 1 from public.admin_users au where au.user_id = m.sender_id and au.is_active = true and au.role in ('admin','editor'))
          or exists(select 1 from public.chat_moderators cm where cm.user_id = m.sender_id)),
         coalesce((select jsonb_object_agg(r.reaction, r.cnt) from (select reaction, count(*) as cnt from public.public_chat_reactions where message_id = m.id group by reaction) r), '{}'::jsonb),
         (select pr.reaction from public.public_chat_reactions pr where pr.message_id = m.id and pr.user_id = auth.uid()),
         coalesce(sp.is_verified, false), sp.verification_type
  from public.public_chat_messages m
  left join public.student_profiles sp on sp.user_id = m.sender_id
  left join public.public_chat_messages rm on rm.id = m.reply_to_id and rm.deleted_at is null
  left join public.student_profiles rp on rp.user_id = rm.sender_id
  where auth.uid() is not null and m.deleted_at is null and (p_before is null or m.created_at < p_before)
  order by m.created_at desc
  limit greatest(1, least(coalesce(p_limit, 40), 100));
$$;
revoke all on function public.chat_list_public_v2(integer, timestamptz) from public, anon;
grant execute on function public.chat_list_public_v2(integer, timestamptz) to authenticated;

-- 2) ملفات المستخدمين في الدردشة
drop function if exists public.chat_get_profiles_v2(uuid[]);
create function public.chat_get_profiles_v2(p_user_ids uuid[])
returns table(user_id uuid, first_name text, father_name text, family_name text, study_stage text, province text, bio text, avatar_thumb text, has_avatar boolean, is_moderator boolean,
  is_verified boolean, verification_type text)
language sql stable security definer set search_path = public, pg_temp as $$
  select sp.user_id, sp.first_name, sp.father_name, sp.family_name, sp.study_stage, sp.province, sp.bio,
         sp.avatar_thumb, (coalesce(sp.avatar_url, '') <> ''),
         (exists(select 1 from public.admin_users au where au.user_id = sp.user_id and au.is_active = true and au.role in ('admin','editor'))
          or exists(select 1 from public.chat_moderators cm where cm.user_id = sp.user_id)),
         coalesce(sp.is_verified, false), sp.verification_type
  from public.student_profiles sp
  where auth.uid() is not null and sp.user_id = any(p_user_ids);
$$;
revoke all on function public.chat_get_profiles_v2(uuid[]) from public, anon;
grant execute on function public.chat_get_profiles_v2(uuid[]) to authenticated;

-- 3) تعليقات الأخبار: نوع التوثيق لكل معلّق
create or replace function public.news_list_posts(p_limit integer default 60)
returns table(id uuid, author_id uuid, author_name text, author_meta text, author_avatar_url text, body text, images text[], is_published boolean, created_at timestamptz, updated_at timestamptz, like_count bigint, liked_by_me boolean, comment_count bigint, comments jsonb)
language sql stable security definer set search_path = public, pg_temp as $$
  select n.id, n.author_id, n.author_name, n.author_meta, sp.avatar_url, n.body, n.images, n.is_published, n.created_at, n.updated_at,
    (select count(*) from public.news_post_likes l where l.post_id = n.id),
    exists(select 1 from public.news_post_likes me where me.post_id = n.id and me.user_id = auth.uid()),
    (select count(*) from public.news_post_comments cc where cc.post_id = n.id),
    coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'author_id', c.author_id, 'name', c.author_name, 'meta', c.author_meta, 'text', c.body, 'parent_id', c.parent_id, 'created_at', c.created_at,
                'verified', coalesce(csp.is_verified, false), 'vtype', csp.verification_type) order by c.created_at asc)
              from public.news_post_comments c left join public.student_profiles csp on csp.user_id = c.author_id where c.post_id = n.id), '[]'::jsonb)
  from public.news_posts n left join public.student_profiles sp on sp.user_id = n.author_id
  where n.is_published = true order by n.created_at desc limit greatest(1, least(coalesce(p_limit, 60), 100));
$$;

-- 4) إحصاءات المشرف: استدعاء واحد يعيد كل الأرقام والمخططات مجمّعة في القاعدة
create or replace function public.admin_analytics()
returns jsonb language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare r jsonb;
begin
  if not private.is_premium_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select jsonb_build_object(
    'total_users', (select count(*) from auth.users),
    'verified', (select count(*) from public.student_profiles where is_verified),
    'banned', (select count(*) from public.chat_user_bans b where b.expires_at is null or b.expires_at > now()),
    'online', (select count(*) from public.student_profiles where last_usage_at >= now() - interval '5 minutes'),
    'new_today', (select count(*) from auth.users where created_at >= date_trunc('day', now() at time zone 'Asia/Damascus') at time zone 'Asia/Damascus'),
    'new_7d', (select count(*) from auth.users where created_at >= now() - interval '7 days'),
    'regions', coalesce((select jsonb_agg(jsonb_build_array(k, c) order by c desc) from (select coalesce(nullif(trim(coalesce(province, governorate)), ''), 'غير محدد') k, count(*) c from public.student_profiles group by 1 order by 2 desc limit 8) x), '[]'),
    'stages', coalesce((select jsonb_agg(jsonb_build_array(k, c) order by c desc) from (select case
        when study_stage ilike '%أدبي%' or study_stage ilike '%ادبي%' then 'بكالوريا أدبي'
        when study_stage ilike '%علمي%' then 'بكالوريا علمي'
        when study_stage ~ 'بكالوريا|بكلوريا|ثانوي' then 'بكالوريا / ثانوي'
        when study_stage ~ 'تاسع|التاسع|أساسي|اساسي|إعدادي|اعدادي' then 'التاسع'
        when study_stage ~ 'جامع|معهد' then 'جامعي / معهد'
        else 'غير محدد' end k, count(*) c from public.student_profiles group by 1) x), '[]'),
    'gender', coalesce((select jsonb_agg(jsonb_build_array(k, c) order by c desc) from (select case when gender ~ 'ذكر|male' then 'ذكور' when gender ~ 'أنثى|انثى|female' then 'إناث' else 'غير محدد' end k, count(*) c from public.student_profiles group by 1) x), '[]'),
    'usage', coalesce((select jsonb_agg(jsonb_build_array(k, c) order by o) from (select case
        when extract(hour from last_usage_at at time zone 'Asia/Damascus') < 6 then '12–6 ص'
        when extract(hour from last_usage_at at time zone 'Asia/Damascus') < 12 then '6 ص–12 م'
        when extract(hour from last_usage_at at time zone 'Asia/Damascus') < 18 then '12–6 م'
        else '6 م–12 ص' end k,
        min(case when extract(hour from last_usage_at at time zone 'Asia/Damascus') < 6 then 1 when extract(hour from last_usage_at at time zone 'Asia/Damascus') < 12 then 2 when extract(hour from last_usage_at at time zone 'Asia/Damascus') < 18 then 3 else 4 end) o,
        count(*) c from public.student_profiles where last_usage_at is not null group by 1) x), '[]')
  ) into r;
  return r;
end; $$;
revoke all on function public.admin_analytics() from public, anon;
grant execute on function public.admin_analytics() to authenticated;
