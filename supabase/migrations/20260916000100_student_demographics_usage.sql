-- بيانات اختيارية لتحليل الطلاب في بوابة المشرفين.
-- جميع الأعمدة قابلة للقيمة الفارغة للحفاظ على الحسابات القديمة.
alter table if exists public.student_profiles
  add column if not exists province text,
  add column if not exists governorate text,
  add column if not exists gender text,
  add column if not exists daily_usage_minutes numeric not null default 0,
  add column if not exists usage_day date,
  add column if not exists last_usage_at timestamptz;

create index if not exists student_profiles_province_idx on public.student_profiles (province);
create index if not exists student_profiles_study_stage_idx on public.student_profiles (study_stage);
create index if not exists student_profiles_usage_day_idx on public.student_profiles (usage_day);

create index if not exists student_profiles_gender_idx on public.student_profiles (gender);
