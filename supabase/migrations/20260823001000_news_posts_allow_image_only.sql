alter table public.news_posts
  drop constraint if exists news_posts_body_length;

alter table public.news_posts
  add constraint news_posts_body_length check (
    char_length(trim(body)) between 1 and 1200
    or (char_length(trim(body)) = 0 and cardinality(images) > 0)
  );
