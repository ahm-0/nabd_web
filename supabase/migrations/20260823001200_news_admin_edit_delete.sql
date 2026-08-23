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

  if nullif(trim(coalesce(p_body, '')), '') is null and coalesce(cardinality(p_images), 0) = 0 then
    raise exception 'يجب كتابة نص أو إرفاق صورة';
  end if;

  if char_length(trim(coalesce(p_body, ''))) > 1200 then
    raise exception 'نص المنشور يتجاوز 1200 حرفًا';
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
