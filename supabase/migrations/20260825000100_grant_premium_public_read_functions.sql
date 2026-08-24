-- Allow anonymous visitors to browse the public premium catalog.
-- Protected file access, access-code redemption, and admin functions remain restricted.
GRANT EXECUTE ON FUNCTION public.premium_list_branches(text) TO anon;
GRANT EXECUTE ON FUNCTION public.premium_list_teachers(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.premium_list_subjects(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.premium_list_files(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.premium_check_file_access(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.premium_open_file(uuid) TO anon;
