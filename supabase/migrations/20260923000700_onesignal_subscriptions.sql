-- Store one OneSignal subscription per user/device for future push notifications.
create table if not exists public.user_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  onesignal_id text not null,
  platform text not null default 'native',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, onesignal_id)
);
create index if not exists user_push_subscriptions_user_idx on public.user_push_subscriptions(user_id);
create index if not exists user_push_subscriptions_onesignal_idx on public.user_push_subscriptions(onesignal_id);
alter table public.user_push_subscriptions enable row level security;
drop policy if exists "push subscriptions own" on public.user_push_subscriptions;
create policy "push subscriptions own" on public.user_push_subscriptions for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
