window.NABD_SUPABASE_URL = 'https://vyjosbxjizttdwnrphza.supabase.co';
window.NABD_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5am9zYnhqaXp0dGR3bnJwaHphIiwiaWF0IjoxNzU4NjUyOTEzLCJleHAiOjIwNzQyMjg5MTN9.wpur3ACC1Nw5WEsn11KgdfKs-3UQJWWLwe2yVpg8ZU0';

window.nabdNativeReady = function nabdNativeReady() {
  try {
    const androidBridge = window.NabdAndroid;
    if (typeof androidBridge?.webReady === 'function') androidBridge.webReady();
    if (typeof window.android?.webReady === 'function') window.android.webReady();
  } catch (error) {
    console.warn('تعذر إرسال إشارة الجاهزية إلى Android', error);
  }
  try {
    const splash = window.Capacitor?.Plugins?.SplashScreen;
    if (typeof splash?.hide === 'function') splash.hide().catch(() => {});
  } catch (error) {
    console.warn('تعذر إخفاء شاشة البداية الأصلية', error);
  }
};

const supabaseLibrary = window.supabase;
if (supabaseLibrary && typeof supabaseLibrary.createClient === 'function') {
  window.nabdSupabase = supabaseLibrary.createClient(window.NABD_SUPABASE_URL, window.NABD_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'sb-vyjosbxjizttdwnrphza-auth-token'
    }
  });
} else {
  window.nabdSupabase = null;
  console.warn('مكتبة Supabase غير متاحة؛ ستعمل الأدوات المحلية دون مزامنة سحابية.');
}
