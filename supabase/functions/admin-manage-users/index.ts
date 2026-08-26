import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isAdminRecord = (record: { role?: string | null; is_active?: boolean | null } | null) =>
  Boolean(record?.is_active && ["admin", "editor"].includes(String(record.role)));

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "الطريقة غير مدعومة" }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "يلزم تسجيل الدخول" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "إعدادات Supabase غير مكتملة" }, 500);

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const currentUser = userData?.user;
  if (userError || !currentUser) return json({ error: "جلسة المستخدم غير صالحة" }, 401);

  const { data: adminRecord, error: adminError } = await adminClient
    .from("admin_users")
    .select("role,is_active")
    .eq("user_id", currentUser.id)
    .maybeSingle();
  if (adminError || !isAdminRecord(adminRecord)) return json({ error: "لا تملك صلاحية إدارة المستخدمين" }, 403);

  let payload: Record<string, unknown> = {};
  try { payload = await request.json(); } catch { /* list is the safe default */ }
  const action = String(payload.action || "list");

  if (action === "list") {
    const page = Math.max(1, Number(payload.page) || 1);
    const perPage = Math.min(100, Math.max(1, Number(payload.per_page) || 100));
    const { data: usersData, error: usersError } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (usersError) return json({ error: "تعذر تحميل المستخدمين" }, 500);

    const users = usersData?.users || [];
    const ids = users.map((user) => user.id);
    const { data: profiles, error: profilesError } = ids.length
      ? await adminClient.from("student_profiles").select("user_id,first_name,father_name,family_name,study_stage,avatar_url,created_at,updated_at").in("user_id", ids).limit(100)
      : { data: [], error: null };
    if (profilesError) return json({ error: "تعذر تحميل ملفات المستخدمين" }, 500);
    const profileMap = new Map((profiles || []).map((profile) => [profile.user_id, profile]));

    return json({
      users: users.map((user) => {
        const profile = profileMap.get(user.id) || {};
        return {
          id: user.id,
          email: user.email || "",
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at || null,
          name: [profile.first_name, profile.father_name, profile.family_name].filter(Boolean).join(" ") || user.email || "مستخدم",
          stage: profile.study_stage || "—",
          avatar_url: profile.avatar_url || null,
          is_admin: false,
        };
      }),
      page,
      per_page: perPage,
      total: usersData?.total || null,
    });
  }

  if (action === "delete") {
    const targetId = String(payload.user_id || "").trim();
    if (!targetId || !/^[0-9a-f-]{36}$/i.test(targetId)) return json({ error: "معرّف المستخدم غير صالح" }, 400);
    if (targetId === currentUser.id) return json({ error: "لا يمكن حذف حساب المشرف الحالي" }, 400);

    const { data: targetAdmin, error: targetAdminError } = await adminClient
      .from("admin_users")
      .select("user_id,role,is_active")
      .eq("user_id", targetId)
      .maybeSingle();
    if (targetAdminError) return json({ error: "تعذر التحقق من حساب المستخدم" }, 500);
    if (targetAdmin?.is_active) return json({ error: "لا يمكن حذف حساب مشرف نشط" }, 403);

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetId);
    if (deleteError) return json({ error: "تعذر حذف المستخدم" }, 500);
    return json({ deleted: true, user_id: targetId });
  }

  return json({ error: "الإجراء غير مدعوم" }, 400);
});
