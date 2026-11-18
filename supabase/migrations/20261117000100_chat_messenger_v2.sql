-- نبض التفوق: طبقة بيانات الدردشة بأسلوب تطبيقات المراسلة (واتساب/تلجرام)
-- الهدف: صفحات رسائل مرقّمة بطلب واحد، عدّاد غير مقروء لكل محادثة، ردود وتفاعلات وتعديل وحذف
-- للرسائل العامة والخاصة، وإرسال متسامح مع إعادة المحاولة (idempotent).

-- 1) الرسائل العامة: صفحة واحدة تتضمن المرسل ومعاينة الرد والتفاعلات المجمّعة وتفاعلي أنا
create or replace function public.chat_list_public_v2(p_limit integer default 40, p_before timestamptz default null)
returns table(
  id uuid, sender_id uuid, body text, reply_to_id uuid, reply_body text, reply_name text,
  edited_at timestamptz, created_at timestamptz, pinned_at timestamptz,
  first_name text, father_name text, family_name text, study_stage text, avatar_url text,
  is_moderator boolean, reactions jsonb, my_reaction text
)
language sql stable security definer set search_path = public, pg_temp as $$
  select m.id, m.sender_id, m.body, m.reply_to_id, rm.body,
         nullif(trim(concat_ws(' ', rp.first_name, rp.father_name, rp.family_name)), ''),
         m.edited_at, m.created_at, m.pinned_at,
         sp.first_name, sp.father_name, sp.family_name, sp.study_stage, sp.avatar_url,
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

create or replace function public.chat_get_pinned_public()
returns table(id uuid, body text, sender_id uuid, sender_name text, pinned_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select m.id, m.body, m.sender_id,
         coalesce(nullif(trim(concat_ws(' ', sp.first_name, sp.father_name, sp.family_name)), ''), 'مستخدم'),
         m.pinned_at
  from public.public_chat_messages m
  left join public.student_profiles sp on sp.user_id = m.sender_id
  where auth.uid() is not null and m.pinned_at is not null and m.deleted_at is null
  order by m.pinned_at desc limit 1;
$$;

-- 2) المحادثات الخاصة: قائمة مع عدّاد غير المقروء وآخر مرسل
create or replace function public.chat_list_private_v2()
returns table(
  thread_id uuid, other_user_id uuid, other_name text, other_avatar text, other_stage text,
  other_is_moderator boolean, last_message text, last_sender_id uuid, last_message_at timestamptz, unread_count bigint
)
language sql stable security definer set search_path = public, pg_temp as $$
  select t.id, o.uid,
         coalesce(nullif(trim(concat_ws(' ', p.first_name, p.father_name, p.family_name)), ''), 'مستخدم'),
         p.avatar_url, p.study_stage,
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

-- 3) رسائل محادثة خاصة (صفحة مرقّمة مع معاينة الرد)
create or replace function public.chat_list_private_messages(p_thread uuid, p_limit integer default 40, p_before timestamptz default null)
returns table(
  id uuid, thread_id uuid, sender_id uuid, body text, reply_to_id uuid, reply_body text,
  reaction text, edited_at timestamptz, created_at timestamptz, read_at timestamptz
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not exists(select 1 from public.private_chat_threads t where t.id = p_thread and (t.user_a = auth.uid() or t.user_b = auth.uid())) then
    raise exception 'لا تملك صلاحية قراءة هذه المحادثة';
  end if;
  return query
    select m.id, m.thread_id, m.sender_id, m.body, m.reply_to_id, rm.body, m.reaction, m.edited_at, m.created_at, m.read_at
    from public.private_chat_messages m
    left join public.private_chat_messages rm on rm.id = m.reply_to_id and rm.deleted_at is null
    where m.thread_id = p_thread and m.deleted_at is null and (p_before is null or m.created_at < p_before)
    order by m.created_at desc
    limit greatest(1, least(coalesce(p_limit, 40), 100));
end; $$;

-- 4) إرسال رسالة خاصة مع رد اختياري ومعرّف من العميل (آمن عند إعادة المحاولة)
create or replace function public.chat_send_private_v2(p_thread_id uuid, p_body text, p_reply_to uuid default null, p_id uuid default null)
returns public.private_chat_messages
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_row public.private_chat_messages; v_body text := trim(coalesce(p_body, ''));
begin
  if auth.uid() is null or p_thread_id is null or char_length(v_body) not between 1 and 1000 then
    raise exception 'الرسالة الخاصة غير صالحة';
  end if;
  if not exists(select 1 from public.private_chat_threads t where t.id = p_thread_id and (t.user_a = auth.uid() or t.user_b = auth.uid())) then
    raise exception 'لا تملك صلاحية إرسال الرسالة';
  end if;
  if p_reply_to is not null and not exists(select 1 from public.private_chat_messages r where r.id = p_reply_to and r.thread_id = p_thread_id) then
    p_reply_to := null;
  end if;
  insert into public.private_chat_messages(id, thread_id, sender_id, body, reply_to_id)
  values (coalesce(p_id, gen_random_uuid()), p_thread_id, auth.uid(), v_body, p_reply_to)
  on conflict (id) do nothing
  returning * into v_row;
  if v_row.id is null then
    select * into v_row from public.private_chat_messages where id = p_id and sender_id = auth.uid();
  else
    update public.private_chat_threads set last_message_at = v_row.created_at where id = p_thread_id;
  end if;
  return v_row;
end; $$;

-- 5) تعديل رسالتي / حذف رسالتي / تفاعل (للعامة p_scope='public' وللخاصة p_scope='private')
create or replace function public.chat_edit_message(p_scope text, p_id uuid, p_body text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_body text := trim(coalesce(p_body, ''));
begin
  if auth.uid() is null or char_length(v_body) not between 1 and 1000 then raise exception 'نص الرسالة غير صالح'; end if;
  if p_scope = 'public' then
    if not public.chat_can_send_public() then raise exception 'الدردشة متوقفة أو حسابك محظور'; end if;
    update public.public_chat_messages set body = v_body, edited_at = now() where id = p_id and sender_id = auth.uid() and deleted_at is null;
  elsif p_scope = 'private' then
    update public.private_chat_messages set body = v_body, edited_at = now() where id = p_id and sender_id = auth.uid() and deleted_at is null;
  else raise exception 'نوع الدردشة غير معروف'; end if;
  return found;
end; $$;

create or replace function public.chat_delete_message(p_scope text, p_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'يلزم تسجيل الدخول'; end if;
  if p_scope = 'public' then
    update public.public_chat_messages set deleted_at = now() where id = p_id and sender_id = auth.uid() and deleted_at is null;
  elsif p_scope = 'private' then
    update public.private_chat_messages set deleted_at = now() where id = p_id and sender_id = auth.uid() and deleted_at is null;
  else raise exception 'نوع الدردشة غير معروف'; end if;
  return found;
end; $$;

-- تبديل التفاعل: نفس الرمز مرة ثانية يزيل التفاعل. يعيد التفاعل الحالي أو null
create or replace function public.chat_react(p_scope text, p_id uuid, p_emoji text)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare v_current text;
begin
  if auth.uid() is null then raise exception 'يلزم تسجيل الدخول'; end if;
  if p_emoji is null or p_emoji not in ('👍','❤️','😂','😮','😢','🙏') then raise exception 'التفاعل غير مدعوم'; end if;
  if p_scope = 'public' then
    if not exists(select 1 from public.public_chat_messages where id = p_id and deleted_at is null) then raise exception 'الرسالة غير موجودة'; end if;
    select reaction into v_current from public.public_chat_reactions where message_id = p_id and user_id = auth.uid();
    if v_current = p_emoji then
      delete from public.public_chat_reactions where message_id = p_id and user_id = auth.uid();
      return null;
    end if;
    insert into public.public_chat_reactions(message_id, user_id, reaction) values (p_id, auth.uid(), p_emoji)
    on conflict (message_id, user_id) do update set reaction = excluded.reaction, created_at = now();
    return p_emoji;
  elsif p_scope = 'private' then
    select m.reaction into v_current from public.private_chat_messages m
      join public.private_chat_threads t on t.id = m.thread_id
      where m.id = p_id and m.deleted_at is null and (t.user_a = auth.uid() or t.user_b = auth.uid());
    if not found then raise exception 'الرسالة غير موجودة'; end if;
    if v_current = p_emoji then
      update public.private_chat_messages set reaction = null where id = p_id;
      return null;
    end if;
    update public.private_chat_messages set reaction = p_emoji where id = p_id;
    return p_emoji;
  else raise exception 'نوع الدردشة غير معروف'; end if;
end; $$;

-- 6) احترام خيار «السماح بالدردشة الخاصة»: لا تُنشأ محادثة جديدة مع من أغلقها
create or replace function public.chat_get_or_create_thread(p_other_user uuid)
returns public.private_chat_threads
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_thread public.private_chat_threads; v_a uuid; v_b uuid; v_enabled boolean;
begin
  if auth.uid() is null or p_other_user is null or p_other_user = auth.uid() then raise exception 'مستخدم الدردشة غير صالح'; end if;
  v_a := least(auth.uid(), p_other_user); v_b := greatest(auth.uid(), p_other_user);
  select * into v_thread from public.private_chat_threads where user_a = v_a and user_b = v_b limit 1;
  if v_thread.id is null then
    select coalesce(private_chat_enabled, true) into v_enabled from public.chat_settings where user_id = p_other_user;
    if v_enabled is false then raise exception 'هذا الطالب لا يستقبل الدردشة الخاصة حاليًا'; end if;
    insert into public.private_chat_threads(user_a, user_b) values (v_a, v_b) returning * into v_thread;
  end if;
  return v_thread;
end; $$;

-- 7) صلاحيات التنفيذ
revoke all on function public.chat_list_public_v2(integer, timestamptz) from public, anon;
revoke all on function public.chat_get_pinned_public() from public, anon;
revoke all on function public.chat_list_private_v2() from public, anon;
revoke all on function public.chat_list_private_messages(uuid, integer, timestamptz) from public, anon;
revoke all on function public.chat_send_private_v2(uuid, text, uuid, uuid) from public, anon;
revoke all on function public.chat_edit_message(text, uuid, text) from public, anon;
revoke all on function public.chat_delete_message(text, uuid) from public, anon;
revoke all on function public.chat_react(text, uuid, text) from public, anon;
grant execute on function public.chat_list_public_v2(integer, timestamptz) to authenticated;
grant execute on function public.chat_get_pinned_public() to authenticated;
grant execute on function public.chat_list_private_v2() to authenticated;
grant execute on function public.chat_list_private_messages(uuid, integer, timestamptz) to authenticated;
grant execute on function public.chat_send_private_v2(uuid, text, uuid, uuid) to authenticated;
grant execute on function public.chat_edit_message(text, uuid, text) to authenticated;
grant execute on function public.chat_delete_message(text, uuid) to authenticated;
grant execute on function public.chat_react(text, uuid, text) to authenticated;

-- 8) بث تغييرات التفاعلات لحظيًا
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'public_chat_reactions') then
    alter publication supabase_realtime add table public.public_chat_reactions;
  end if;
end $$;
