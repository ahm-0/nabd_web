(() => {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  let reloading = false;
  const refreshMarker = '__sw_refresh';

  const clearRefreshMarker = () => {
    const currentUrl = new URL(window.location.href);
    if (!currentUrl.searchParams.has(refreshMarker)) return;
    currentUrl.searchParams.delete(refreshMarker);
    const cleanUrl = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
    window.history.replaceState(null, document.title, cleanUrl);
  };

  const requestUpdate = registration => {
    registration.update().catch(error => {
      console.debug('تعذر فحص تحديثات نبض التفوق حاليًا:', error);
    });
  };

  const activateWaitingWorker = registration => {
    const waitingWorker = registration.waiting;
    if (!waitingWorker) return;
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  };

  const watchForUpdates = registration => {
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          activateWaitingWorker(registration);
        }
      });
    });

    // عالج تحديثًا اكتمل قبل فتح التطبيق؛ لا تنتظر دورة فتح جديدة.
    activateWaitingWorker(registration);
  };

  const reloadWithFreshNavigation = () => {
    if (reloading) return;
    reloading = true;
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set(refreshMarker, String(Date.now()));
    window.location.replace(nextUrl.toString());
  };

  clearRefreshMarker();

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', {
      scope: './',
      updateViaCache: 'none'
    }).then(registration => {
      watchForUpdates(registration);
      requestUpdate(registration);

      window.setInterval(() => requestUpdate(registration), 60 * 60 * 1000);
      window.addEventListener('online', () => requestUpdate(registration));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          activateWaitingWorker(registration);
          requestUpdate(registration);
        }
      });
    }).catch(error => {
      console.warn('تعذر تفعيل وضع العمل دون اتصال:', error);
    });
  });

  navigator.serviceWorker.addEventListener('controllerchange', reloadWithFreshNavigation);
})();
