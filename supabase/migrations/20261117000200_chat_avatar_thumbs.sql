-- نبض التفوق: صور مصغّرة لملفات الدردشة
-- صور الملفات الشخصية مخزّنة كـ base64 بمتوسط ~145KB (حتى 640KB)، وإرجاعها مع كل صفحة رسائل
-- كان السبب الرئيسي لبطء الدردشة. نضيف avatar_thumb (~8KB) يولّده العميل، وتعيد دوال الدردشة المصغّرة فقط.

alter table public.student_profiles add column if not exists avatar_thumb text;

-- عند تغيير الصورة الأصلية تُصفَّر المصغّرة ليعيد العميل توليدها
create or replace function public.student_profiles_reset_thumb()
returns trigger language plpgsql as $$
begin
  if new.avatar_url is distinct from old.avatar_url and new.avatar_thumb is not distinct from old.avatar_thumb then
    new.avatar_thumb := null;
  end if;
  return new;
end; $$;
drop trigger if exists student_profiles_reset_thumb on public.student_profiles;
create trigger student_profiles_reset_thumb before update on public.student_profiles
  for each row execute function public.student_profiles_reset_thumb();

-- الدوال الجديدة تغيّر أنواع الإرجاع، لذا نُسقط نسخ الجولة السابقة
drop function if exists public.chat_list_public_v2(integer, timestamptz);
drop function if exists public.chat_list_private_v2();

create or replace function public.chat_list_public_v2(p_limit integer default 40, p_before timestamptz default null)
returns table(
  id uuid, sender_id uuid, body text, reply_to_id uuid, reply_body text, reply_name text,
  edited_at timestamptz, created_at timestamptz, pinned_at timestamptz,
  first_name text, father_name text, family_name text, study_stage text, avatar_thumb text, has_avatar boolean,
  is_moderator boolean, reactions jsonb, my_reaction text
)
language sql stable security definer set search_path = public, pg_temp as $$
  select m.id, m.sender_id, m.body, m.reply_to_id, rm.body,
         nullif(trim(concat_ws(' ', rp.first_name, rp.father_name, rp.family_name)), ''),
         m.edited_at, m.created_at, m.pinned_at,
         sp.first_name, sp.father_name, sp.family_name, sp.study_stage, sp.avatar_thumb,
         (coalesce(sp.avatar_url, '') <> ''),
         (exists(select 1 from public.admin_users au where au.user_id = m.sender_id and au.is_active = true and au.role in ('admin','editor'))
          or exists(select 1 from public.chat_moderators cm where cm.user_id = m.sender_id)),
         coalesce((select jsonb_object_agg(r.reaction, r.cnt) from (select reaction, count(*) as cnt from public.public_chat_reactions where message_id = m.id group by reaction) r), '{}'::jsonb),
         (select pr.reaction from public.public_chat_reactions pr where pr.message_id = m.id and pr.user_id = auth.uid())
  from public.public_chat_messages m
  left join public.student_profiles sp on sp.user_id = m.sender_id
  left join public.public_chat_messages rm on rm.id = m.reply_to_id and rm.deleted_at is null
  left join public.student_profiles rp on rp.user_id = rm.sender_id
  where auth.uid() is not null and m.deleted_at is null and (p_before is null or m.created_at < p_before)
  order by m.created_at desc
  limit greatest(1, least(coalesce(p_limit, 40), 100));
$$;

create or replace function public.chat_list_private_v2()
returns table(
  thread_id uuid, other_user_id uuid, other_name text, other_avatar_thumb text, other_has_avatar boolean, other_stage text,
  other_is_moderator boolean, last_message text, last_sender_id uuid, last_message_at timestamptz, unread_count bigint
)
language sql stable security definer set search_path = public, pg_temp as $$
  select t.id, o.uid,
         coalesce(nullif(trim(concat_ws(' ', p.first_name, p.father_name, p.family_name)), ''), 'مستخدم'),
         p.avatar_thumb, (coalesce(p.avatar_url, '') <> ''), p.study_stage,
         (exists(select 1 from public.admin_users au where au.user_id = o.uid and au.is_active = true and au.role in ('admin','editor'))
          or exists(select 1 from public.chat_moderators cm where cm.user_id = o.uid)),
         lm.body, lm.sender_id, t.last_message_at,
         (select count(*) from public.private_chat_messages m
           where m.thread_id = t.id and m.sender_id <> auth.uid() and m.read_at is null and m.deleted_at is null)
  from public.private_chat_threads t
  cross join lateral (select case when t.user_a = auth.uid() then t.user_b else t.user_a end as uid) o
  left join public.student_profiles p on p.user_id = o.uid
  left join lateral (select m.body, m.sender_id from public.private_chat_messages m
                     where m.thread_id = t.id and m.deleted_at is null order by m.created_at desc limit 1) lm on true
  where auth.uid() is not null and (t.user_a = auth.uid() or t.user_b = auth.uid())
  order by t.last_message_at desc;
$$;

-- ملفات المشاركين بدفعة واحدة وبدون الصورة الكاملة
create or replace function public.chat_get_profiles_v2(p_user_ids uuid[])
returns table(user_id uuid, first_name text, father_name text, family_name text, study_stage text, province text,
              bio text, avatar_thumb text, has_avatar boolean, is_moderator boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select sp.user_id, sp.first_name, sp.father_name, sp.family_name, sp.study_stage, sp.province, sp.bio,
         sp.avatar_thumb, (coalesce(sp.avatar_url, '') <> ''),
         (exists(select 1 from public.admin_users au where au.user_id = sp.user_id and au.is_active = true and au.role in ('admin','editor'))
          or exists(select 1 from public.chat_moderators cm where cm.user_id = sp.user_id))
  from public.student_profiles sp
  where auth.uid() is not null and sp.user_id = any(p_user_ids);
$$;

-- الصورة الكاملة عند الحاجة فقط (للمستخدمين الذين لم تُولَّد لهم مصغّرة بعد)
create or replace function public.chat_get_avatar(p_user uuid)
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(sp.avatar_thumb, sp.avatar_url) from public.student_profiles sp where auth.uid() is not null and sp.user_id = p_user;
$$;

revoke all on function public.chat_list_public_v2(integer, timestamptz) from public, anon;
revoke all on function public.chat_list_private_v2() from public, anon;
revoke all on function public.chat_get_profiles_v2(uuid[]) from public, anon;
revoke all on function public.chat_get_avatar(uuid) from public, anon;
grant execute on function public.chat_list_public_v2(integer, timestamptz) to authenticated;
grant execute on function public.chat_list_private_v2() to authenticated;
grant execute on function public.chat_get_profiles_v2(uuid[]) to authenticated;
grant execute on function public.chat_get_avatar(uuid) to authenticated;
