create or replace function public.premium_admin_get_catalog()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not private.is_premium_admin() then raise exception 'not authorized'; end if;
  return jsonb_build_object(
    'branches', coalesce((select jsonb_agg(to_jsonb(b) order by b.sort_order, b.name) from public.premium_branches b), '[]'::jsonb),
    'teachers', coalesce((select jsonb_agg(to_jsonb(t) order by t.sort_order, t.name) from public.premium_teachers t), '[]'::jsonb),
    'subjects', coalesce((select jsonb_agg(to_jsonb(s) order by s.sort_order, s.name) from public.premium_subjects s), '[]'::jsonb),
    'files', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'subject_id', f.subject_id, 'teacher_id', t.id, 'teacher_name', t.name, 'title', f.title, 'description', f.description, 'file_url', f.file_url, 'access_price', f.access_price, 'is_available', f.is_available, 'sort_order', f.sort_order, 'created_at', f.created_at, 'updated_at', f.updated_at) order by f.sort_order, f.title) from public.premium_files f join public.premium_subjects s on s.id = f.subject_id join public.premium_teachers t on t.id = s.teacher_id), '[]'::jsonb),
    'codes', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'code_hint', c.code_hint, 'code_type', c.code_type, 'file_id', c.file_id, 'teacher_id', c.teacher_id, 'price', c.price, 'max_uses', c.max_uses, 'uses_count', c.uses_count, 'is_active', c.is_active, 'expires_at', c.expires_at, 'created_at', c.created_at) order by c.created_at desc) from public.premium_access_codes c), '[]'::jsonb),
    'settings', coalesce((select to_jsonb(ps) from public.premium_settings ps where ps.id = 1), jsonb_build_object('id', 1, 'default_whatsapp', ''))
  );
end;
$$;
revoke execute on function public.premium_admin_get_catalog() from public, anon;
grant execute on function public.premium_admin_get_catalog() to authenticated;
