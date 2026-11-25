const CACHE_VERSION = '2026-11-19-news-chat-v69';
const STATIC_CACHE = `nabd-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `nabd-runtime-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './about.html',
  './admin-dashboard.html',
  './chat.html',
  './private-chat.html',
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
  './saved-items.html',
  './settings.html',
  './success-limits.html',
  './supervision.html',
  './support-chat.html',
  './tests.html',
  './time-organizer.html',
  './universities.html',
  './university-admission-2026.html',
  './university-directory.html',
  './university-info.html',
  './university-majors.html',
  './premium.html',
  './premium-admin.html',
  './styles.css',
  './screening-exam.css',
  './nabd-theme.css',
  './nabd-navigation.js',
  './nabd-pro.css',
  './nabd-motion.css',
  './nabd-sections.css',
  './nabd-flat.css',
  './nabd-tools.css',
  './nabd-news-chat.css',
  './nabd-badges.js',
  './nabd-notifs.css',
  './nabd-premium.css',
  './nabd-points.js',
  './nabd-mentions.js',
  './lessons.css',
  './lessons.js',
  './points.html',
  './points.css',
  './points-page.js',
  './profile-level.js',
  './profile-level.css',
  './nabd-motion.js',
  './nabd-home.css',
  './nabd-material.css',
  './nabd-showcase.css',
  './auth-pro.css',
  './nabd-profile.css',
  './assets/bundle/all.min.e8e1e872.css',
  './assets/bundle/material-ui.82fe7dde.js',
  './assets/bundle/material-ui.962a81ab.css',
  './assets/bundle/nabd-app.3dab64e0.js',
  './assets/bundle/nabd-navigation.73210ac4.js',
  './assets/bundle/nabd-theme.9fcd0995.css',
  './assets/bundle/nabd-ui.79450694.css',
  './assets/bundle/pwa.b83d2ef2.js',
  './assets/bundle/supabase-client.291eac98.js',
  './assets/bundle/supabase.f9ccb1e9.js',
  './nabd-settings.css',
  './nabd-whatsapp.css',
  './nabd-news.css',
  './nabd-support-chat.js',
  './nabd-admin-portal.css',
  './nabd-smooth.js',
  './nabd-ui.css',
  './exam-card.css',
  './screen-guard.js',
  './assets/badge/verified.svg',
  './exam-card.js',
  './assets/exam-card/emblem.webp',
  './vendor/html2canvas/html2canvas.min.js',
  './vendor/chart/chart.umd.js',
  './curriculum-cards.css',
  './channels.css',
  './chat.css',
  './chat-app.css',
  './chat-app.js',
  './notifications.css',
  './nabd-admin-ui.css',
  './premium.css',
  './nabd-app.js',
  './auth.js',
  './premium.js',
  './premium-admin.js',
  './supabase-client.js',
  './pwa.js',
  './sw.js',
  './manifest.json',
  './material-ui.css',
  './material-ui.js',
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


const assetRefreshAt = new Map();
const ASSET_REVALIDATE_MS = 10 * 60 * 1000;
async function staleWhileRevalidateAsset(request, event) {
  const cached = await caches.match(request, { ignoreSearch: true });
  // الملفات المجزّأة (hash) ثابتة، وبقية الملفات لا نعيد جلبها أكثر من مرة كل 10 دقائق: لا طلبات شبكة تنافس الصفحة عند كل انتقال.
  if (cached) {
    const key = request.url; const hashed = /\/assets\/bundle\/.+\.[0-9a-f]{8}\.(?:css|js)$/i.test(key);
    if (hashed || Date.now() - (assetRefreshAt.get(key) || 0) < ASSET_REVALIDATE_MS) return cached;
    assetRefreshAt.set(key, Date.now());
  }
  const refresh = fetch(request).then(async response => {
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);
  if (cached) { event.waitUntil(refresh); return cached; }
  return (await refresh) || new Response('لا يتوفر ملف التصميم أو الشيفرة حاليًا.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

// لا نعيد تنزيل صفحة HTML الكبيرة عند كل تنقل: نحدّثها في الخلفية مرة كل 5 دقائق كحد أقصى.
const NAVIGATION_REVALIDATE_MS = 5 * 60 * 1000;
const lastNavigationRefresh = new Map();

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

  if (/\.(?:css|js)$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidateAsset(request, event));
    return;
  }

  if (request.mode === 'navigate') {
    const forceRefresh = url.searchParams.has('__sw_refresh');
    if (forceRefresh) {
      // بعد تفعيل عامل جديد، اطلب HTML من الشبكة حتى لا تعود الصفحة القديمة من الكاش.
      event.respondWith(networkFirstNavigation(request));
    } else {
      const key = url.pathname;
      const fresh = Date.now() - (lastNavigationRefresh.get(key) || 0) < NAVIGATION_REVALIDATE_MS;
      event.respondWith((async () => {
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached && fresh) return cached; // فوري تماماً، دون أي طلب شبكة
        lastNavigationRefresh.set(key, Date.now());
        const refresh = refreshNavigation(request).catch(() => null);
        event.waitUntil(refresh);
        return staleWhileRevalidateNavigation(request, refresh);
      })());
    }
    return;
  }

  event.respondWith(cacheFirst(request));
});
