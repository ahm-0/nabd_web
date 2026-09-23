-- Ensure public/private chat and platform status changes are broadcast through Realtime.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='public_chat_messages') then alter publication supabase_realtime add table public.public_chat_messages; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='private_chat_messages') then alter publication supabase_realtime add table public.private_chat_messages; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='chat_platform_settings') then alter publication supabase_realtime add table public.chat_platform_settings; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='private_chat_requests') then alter publication supabase_realtime add table public.private_chat_requests; end if;
end $$;
