const CACHE_VERSION = '2026-08-25-23';
const STATIC_CACHE = `nabd-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `nabd-runtime-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './about.html',
  './admin-dashboard.html',
  './advertising.html',
  './assistant.html',
  './auth.html',
  './auth-ui.css',
  './baccalaureate-literary.html',
  './baccalaureate-science.html',
  './completion-program.html',
  './curriculum.html',
  './educational-sites.html',
  './elite.html',
  './exam-countdown.html',
  './free-channels.html',
  './gallery.html',
  './grade-calculator.html',
  './intensive-arabic.html',
  './intensive-math.html',
  './intensive-science.html',
  './lessons.html',
  './library.html',
  './news.html',
  './news-ui.css',
  './nine.html',
  './notifications.html',
  './pomodoro.html',
  './predictions.html',
  './privacy.html',
  './profile.html',
  './settings.html',
  './success-limits.html',
  './supervision.html',
  './support-chat.html',
  './tests.html',
  './time-organizer.html',
  './universities.html',
  './university-directory.html',
  './university-info.html',
  './university-majors.html',
  './premium.html',
  './premium-admin.html',
  './styles.css',
  './admin-ui.css',
  './premium.css',
  './app.js',
  './auth.js',
  './premium.js',
  './premium-admin.js',
  './supabase-client.js',
  './pwa.js',
  './sw.js',
  './manifest.json',
  './vendor/fontawesome/css/all.min.css',
  './vendor/fontawesome/webfonts/fa-brands-400.woff2',
  './vendor/fontawesome/webfonts/fa-regular-400.woff2',
  './vendor/fontawesome/webfonts/fa-solid-900.woff2',
  './vendor/fontawesome/webfonts/fa-v4compatibility.woff2',
  './vendor/supabase/supabase.js',
  './assets/nabd-logo.jpg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(async cache => {
        await Promise.all(APP_SHELL.map(async asset => {
          const response = await fetch(new Request(asset, { cache: 'reload' }));
          if (!response.ok) throw new Error(`تعذر تخزين المورد ${asset}`);
          await cache.put(asset, response);
        }));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('nabd-static-') || key.startsWith('nabd-runtime-'))
          .filter(key => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('لا يتوفر هذا المورد دون اتصال.', {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

const NAVIGATION_REFRESH_TIMEOUT = 8000;

async function fetchWithTimeout(request, timeout = NAVIGATION_REFRESH_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function refreshNavigation(request) {
  const response = await fetchWithTimeout(request);
  if (response.ok && response.type === 'basic') {
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstNavigation(request) {
  try {
    return await refreshNavigation(request);
  } catch (error) {
    return (await caches.match(request, { ignoreSearch: true }))
      || (await caches.match('./index.html'))
      || new Response('لا تتوفر صفحات التطبيق حاليًا.', {
        status: 503,
        statusText: 'Offline',
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
  }
}

async function staleWhileRevalidateNavigation(request, refresh) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  return (await refresh)
    || (await caches.match('./index.html'))
    || new Response('لا تتوفر صفحات التطبيق حاليًا.', {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    const forceRefresh = url.searchParams.has('__sw_refresh');
    if (forceRefresh) {
      // بعد تفعيل عامل جديد، اطلب HTML من الشبكة حتى لا تعود الصفحة القديمة من الكاش.
      event.respondWith(networkFirstNavigation(request));
    } else {
      const refresh = refreshNavigation(request).catch(() => null);
      // اعرض الصفحة المحلية فورًا في الاستخدام المعتاد، وحدّثها في الخلفية للعمل دون اتصال.
      event.waitUntil(refresh);
      event.respondWith(staleWhileRevalidateNavigation(request, refresh));
    }
    return;
  }

  event.respondWith(cacheFirst(request));
});
