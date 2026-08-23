/* Supabase public client and native bridge helpers for Nabd. */
window.NABD_SUPABASE_URL = 'https://vyjosbxjizttdwnrphza.supabase.co';
window.NABD_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5am9zYnhqaXp0dGR3bnJwaHphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2NTI5MTMsImV4cCI6MjA3NDIyODkxM30.wpur3ACC1Nw5WEsn11KgdfKs-3UQJWWLwe2yVpg8ZU0';

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

window.nabdSupabase = window.supabase.createClient(window.NABD_SUPABASE_URL, window.NABD_SUPABASE_ANON_KEY);
