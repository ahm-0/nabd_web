-- الصورة المصغّرة يكتبها العميل وتُعرض عند مستخدمين آخرين؛ نقيّد صيغتها وحجمها في القاعدة.
alter table public.student_profiles drop constraint if exists student_profiles_avatar_thumb_format;
alter table public.student_profiles add constraint student_profiles_avatar_thumb_format
  check (avatar_thumb is null or (length(avatar_thumb) < 60000 and avatar_thumb ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$'));
