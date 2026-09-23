-- Keep the device subscription ID separately from the OneSignal user ID.
alter table public.user_push_subscriptions add column if not exists subscription_id text;
create index if not exists user_push_subscriptions_subscription_idx on public.user_push_subscriptions(subscription_id);
