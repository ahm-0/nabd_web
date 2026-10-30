const CACHE_VERSION = '2026-10-29-navy-sky-v2';
const STATIC_CACHE = `nabd-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `nabd-runtime-${CACHE_VERSION}`;
const FONT_CACHE = `nabd-fonts-${CACHE_VERSION}`;

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
  './styles.css',
  './nabd-ui.css',
  './material-ui.css',
  './material-ui.js',
  './app.js',
  './nabd-app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE && key !== RUNTIME_CACHE && key !== FONT_CACHE) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1. Cache-First strategy for Google Fonts (Cairo & Readex Pro) for instant typography rendering
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          const networkFetch = fetch(event.request)
            .then((response) => {
              if (response && response.status === 200) {
                cache.put(event.request, response.clone());
              }
              return response;
            })
            .catch(() => cached);
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  // 2. Skip caching for live Supabase API requests to preserve real-time student data integrity
  if (url.hostname.includes('supabase.co') || url.pathname.includes('/rest/v1/') || url.pathname.includes('/auth/v1/')) {
    return;
  }

  // 3. Stale-While-Revalidate for local CSS, JS, and HTML shell for fast load + fresh updates
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const networkFetch = fetch(event.request)
          .then((response) => {
            if (response && response.status === 200 && response.type === 'basic') {
              const clone = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => cached || caches.match('./index.html'));

        return cached || networkFetch;
      })
    );
  }
});
