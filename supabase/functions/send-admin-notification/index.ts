import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const responseJson = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const cleanText = (value: unknown) => String(value ?? "").trim();

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return responseJson({ error: "الطريقة غير مدعومة" }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return responseJson({ error: "يلزم تسجيل الدخول" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) return responseJson({ error: "إعدادات Supabase غير مكتملة" }, 500);

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return responseJson({ error: "جلسة المستخدم غير صالحة" }, 401);

  const { data: adminRecord, error: adminError } = await adminClient
    .from("admin_users")
    .select("role,is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  const isAdmin = Boolean(adminRecord?.is_active && ["admin", "editor"].includes(adminRecord.role));
  if (adminError || !isAdmin) return responseJson({ error: "لا تملك صلاحية إرسال الإشعارات" }, 403);

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return responseJson({ error: "بيانات الطلب غير صالحة" }, 400);
  }

  const title = cleanText(payload.title);
  const body = cleanText(payload.body);
  const imageUrl = cleanText(payload.image_url) || null;
  const actionUrl = cleanText(payload.action_url) || null;
  if (title.length < 1 || title.length > 120) return responseJson({ error: "عنوان الإشعار يجب أن يكون بين حرف واحد و120 حرفًا" }, 400);
  if (body.length < 1 || body.length > 2000) return responseJson({ error: "نص الإشعار يجب أن يكون بين حرف واحد و2000 حرف" }, 400);
  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) return responseJson({ error: "رابط الصورة غير صالح" }, 400);
  if (actionUrl && !/^https?:\/\//i.test(actionUrl)) return responseJson({ error: "رابط الإجراء غير صالح" }, 400);

  const { data: notification, error: saveError } = await adminClient
    .from("notifications")
    .insert({ title, body, image_url: imageUrl, action_url: actionUrl, created_by: user.id })
    .select("id,title,body,image_url,action_url,created_by,created_at,is_active")
    .single();
  if (saveError || !notification) return responseJson({ error: "تعذر حفظ الإشعار" }, 500);

  const oneSignalAppId = Deno.env.get("ONESIGNAL_APP_ID");
  const oneSignalApiKey = Deno.env.get("ONESIGNAL_APP_API_KEY");
  if (!oneSignalAppId || !oneSignalApiKey) {
    return responseJson({
      saved: true,
      push_sent: false,
      notification,
      code: "ONESIGNAL_NOT_CONFIGURED",
      error: "تم حفظ الإشعار داخل التطبيق، لكن إعدادات OneSignal غير مكتملة في Edge Function",
    });
  }

  const oneSignalPayload: Record<string, unknown> = {
    app_id: oneSignalAppId,
    target_channel: "push",
    included_segments: ["Subscribed Users"],
    headings: { en: title, ar: title },
    contents: { en: body, ar: body },
    data: { notification_id: notification.id, action_url: actionUrl || "" },
  };
  if (imageUrl) {
    oneSignalPayload.big_picture = imageUrl;
    oneSignalPayload.chrome_web_image = imageUrl;
    oneSignalPayload.ios_attachments = { image: imageUrl };
  }
  if (actionUrl) oneSignalPayload.url = actionUrl;

  let pushResponse: Response;
  try {
    pushResponse = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Key ${oneSignalApiKey}` },
      body: JSON.stringify(oneSignalPayload),
    });
  } catch {
    return responseJson({ saved: true, push_sent: false, notification, error: "تم حفظ الإشعار لكن تعذر الاتصال بخدمة OneSignal" });
  }

  const pushResult = await pushResponse.json().catch(() => ({}));
  if (!pushResponse.ok) {
    return responseJson({ saved: true, push_sent: false, notification, error: "تم حفظ الإشعار لكن رفضت خدمة OneSignal الطلب", details: pushResult });
  }

  return responseJson({ saved: true, push_sent: true, notification, push: pushResult });
});
