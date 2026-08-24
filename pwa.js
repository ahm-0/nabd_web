(() => {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  let reloading = false;

  const requestUpdate = registration => {
    registration.update().catch(error => {
      console.debug('تعذر فحص تحديثات نبض التفوق حاليًا:', error);
    });
  };

  const watchForUpdates = registration => {
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          newWorker.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });
  };

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
        if (document.visibilityState === 'visible') requestUpdate(registration);
      });
    }).catch(error => {
      console.warn('تعذر تفعيل وضع العمل دون اتصال:', error);
    });
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
})();
