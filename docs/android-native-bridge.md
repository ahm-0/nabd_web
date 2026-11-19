# ما يحتاجه تطبيق الأندرويد (Java/Kotlin) ليكتمل عمل الميزتين

الموقع جاهز ويستدعي دوال الجسر `NabdAndroid`. هذه الدوال يجب إضافتها في كود التطبيق نفسه (ملف الـ Activity الذي يحمل الـ WebView).

## 1) منع لقطات الشاشة (FLAG_SECURE)
يستدعيها الموقع في كل صفحة: `NabdAndroid.setSecureScreen(true|false)` بحسب إعداد القسم.

```kotlin
@JavascriptInterface
fun setSecureScreen(secure: Boolean) {
    runOnUiThread {
        if (secure) window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
        else window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
    }
}
```
بعد تفعيله تظهر لقطة الشاشة وتسجيل الشاشة وقائمة التطبيقات الأخيرة سوداء للقسم المحجوب.

## 2) تسجيل الدخول عبر Google داخل التطبيق
Google يرفض OAuth داخل WebView، لذا يلزم Google Sign-In الأصلي (Credential Manager) ثم تمرير رمز الهوية للصفحة:

```kotlin
@JavascriptInterface
fun googleSignIn() {
    runOnUiThread {
        // 1) نفّذ GetGoogleIdOption بـ Web Client ID (نفس المعرّف المضاف في Supabase → Auth → Google)
        // 2) عند النجاح:
        webView.evaluateJavascript("window.nabdGoogleIdToken(${JSONObject.quote(idToken)})", null)
        // عند الفشل أو الإلغاء:
        // webView.evaluateJavascript("window.nabdGoogleError('تعذر تسجيل الدخول عبر Google')", null)
    }
}
```

## 3) إعداد Supabase (لوحة التحكم)
- Authentication → Providers → Google: فعّله وأدخل Client ID و Client Secret من Google Cloud Console.
- Authentication → URL Configuration: أضف رابط الموقع (…/auth.html) إلى Redirect URLs.
- للتطبيق: فعّل «Skip nonce check» أو مرّر nonce مطابقاً.

## shareText(text) — مشاركة نص التطبيق (اختياري)
`window.NabdAndroid.shareText(text)` يفتح قائمة المشاركة بالنص كما هو (Intent.ACTION_SEND, text/plain). إن لم تتوفر تستخدم الصفحة `navigator.share`. تُمنح نقاط «نشر التطبيق» (50، مرة واحدة) فقط بعد مغادرة المستخدم التطبيق إلى تطبيق المشاركة والعودة؛ إغلاق القائمة دون اختيار تطبيق لا يمنح شيئًا.
